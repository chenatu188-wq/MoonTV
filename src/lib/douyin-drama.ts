/**
 * 抖音追剧：在「TikTok 漫剧」页贴抖音短剧／合集的连结，整部剧的集数列出来，用抖音官方嵌入播放器播。
 *
 * 抖音的资料要浏览器跑过它的 JS 才拿得到，网站伺服器抓不了，所以跟 TikTok 追踪名单一样：
 * 网页上按追剧／移除 → 变更先记在伺服器记忆体 → 站长的 Mac 每 5 分钟来问（/api/cron/douyin-follows），
 * 改好名单、用无头浏览器抓完集数，推到 tiktok-data 分支的 douyin.json，两个站从那里读。
 * 只追「剧」不追帐号：帐号的作品列表要登入抖音才给，合集的集数清单是公开的。
 */

export interface DouyinEpisode {
  /** 抖音影片编号，给嵌入播放器用 */
  id: string;
  /** 第几集 */
  ep: number;
  title: string;
  cover: string;
  /** 秒 */
  duration: number;
}

export interface DouyinDrama {
  /** 追剧时用的写法：series:<合集编号> 或 video:<影片编号> */
  ref: string;
  /** 同一部剧用别的连结也追过的写法 */
  alias: string[];
  /** 合集编号 */
  id: string;
  name: string;
  author: string;
  cover: string;
  /** 抖音上目前更新到第几集 */
  total: number;
  paid: boolean;
  /** 这次没抓到，沿用上次的资料 */
  stale: boolean;
  episodes: DouyinEpisode[];
}

export interface DouyinFailed {
  ref: string;
  error: string;
}

export interface DouyinData {
  /** Unix 秒 */
  updated: number;
  dramas: DouyinDrama[];
  failed: DouyinFailed[];
}

export interface PendingDouyin {
  op: 'add' | 'rm';
  ref: string;
  name: string;
  /** Unix 毫秒 */
  at: number;
}

export const MAX_DOUYIN_DRAMAS = 30;
export const MAX_PENDING_DOUYIN = 30;
/** 超过这么久还没被处理就放弃（Mac 关机之类） */
export const PENDING_DOUYIN_TTL_MS = 24 * 60 * 60 * 1000;

const REF_RE = /^(series|video):\d{8,25}$/;
export const isDouyinRef = (ref: string) => REF_RE.test(ref);

/** 只认这几个网域，伺服器也只会跟着转址到这几个网域 */
const HOST_RE = /^(?:www\.|m\.|v\.)?(?:douyin|iesdouyin)\.com$/i;
const SHORT_HOST_RE = /^v\.douyin\.com$/i;
export const isDouyinHost = (host: string) => HOST_RE.test(host);

export type DouyinLink = { kind: 'short'; url: string } | { kind: 'ref'; ref: string };

/** 分享文字里常夹着别的字（抖音的分享文案很长），取出第一个抖音网址认出是哪部剧／哪一集 */
export function classifyDouyinUrl(text: string): DouyinLink | null {
  for (const raw of text.normalize('NFKC').match(/https?:\/\/[^\s<>"'，。、）)]+/gi) ??
    []) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (!isDouyinHost(url.hostname)) continue;
    const path = url.pathname;
    if (SHORT_HOST_RE.test(url.hostname)) {
      const m = /^\/[\w-]{4,20}\/?$/.exec(path);
      return m ? { kind: 'short', url: `https://v.douyin.com${path}` } : null;
    }
    let m = /^\/(?:collection|series|share\/mix\/detail|share\/series)\/(\d{8,25})/.exec(path);
    if (m) return { kind: 'ref', ref: `series:${m[1]}` };
    m = /^\/(?:video|share\/video)\/(\d{8,25})/.exec(path);
    if (m) return { kind: 'ref', ref: `video:${m[1]}` };
    // 精选页、个人主页上点开影片时，网址是 ?modal_id=<影片编号>
    const modal = url.searchParams.get('modal_id') ?? '';
    if (/^\d{8,25}$/.test(modal)) return { kind: 'ref', ref: `video:${modal}` };
    return null;
  }
  return null;
}

export const douyinEmbedUrl = (videoId: string) =>
  `https://open.douyin.com/player/video?vid=${videoId}&autoplay=1`;

export const douyinPageUrl = (drama: Pick<DouyinDrama, 'id'>) =>
  `https://www.douyin.com/collection/${drama.id}`;

const text = (v: unknown, max: number) =>
  typeof v === 'string'
    ? Array.from(v)
        .filter((c) => c >= ' ' && c !== '\u007f') // 去掉控制字元
        .join('')
        .trim()
        .slice(0, max)
    : '';
const httpsUrl = (v: unknown) =>
  typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : '';
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/** Mac 推上来的 douyin.json；读回来的东西当不可信资料重新验证 */
export function sanitizeDouyinData(raw: unknown): DouyinData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const dramas: DouyinDrama[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(r.dramas) ? r.dramas : []) {
    const d = (x ?? {}) as Record<string, unknown>;
    const ref = String(d.ref ?? '');
    const id = String(d.id ?? '');
    if (!isDouyinRef(ref) || !/^\d{8,25}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const episodes: DouyinEpisode[] = [];
    for (const e of Array.isArray(d.episodes) ? d.episodes : []) {
      const ep = (e ?? {}) as Record<string, unknown>;
      const vid = String(ep.id ?? '');
      if (!/^\d{8,25}$/.test(vid)) continue;
      episodes.push({
        id: vid,
        ep: num(ep.ep),
        title: text(ep.title, 80),
        cover: httpsUrl(ep.cover),
        duration: num(ep.duration),
      });
    }
    if (!episodes.length) continue;
    dramas.push({
      ref,
      alias: (Array.isArray(d.alias) ? d.alias : [])
        .map(String)
        .filter(isDouyinRef),
      id,
      name: text(d.name, 60) || id,
      author: text(d.author, 40),
      cover: httpsUrl(d.cover) || episodes[0].cover,
      total: Math.max(num(d.total), episodes.length),
      paid: d.paid === true,
      stale: d.stale === true,
      episodes,
    });
  }
  const failed: DouyinFailed[] = [];
  for (const x of Array.isArray(r.failed) ? r.failed : []) {
    const f = (x ?? {}) as Record<string, unknown>;
    const ref = String(f.ref ?? '');
    if (isDouyinRef(ref)) failed.push({ ref, error: text(f.error, 80) });
  }
  return { updated: num(r.updated), dramas, failed };
}

/** 这个追剧写法已经在资料里了吗（抓到了、或抓过但失败） */
export function hasRef(data: DouyinData, ref: string): boolean {
  return (
    data.dramas.some((d) => d.ref === ref || d.alias.includes(ref)) ||
    data.failed.some((f) => f.ref === ref)
  );
}

// 两支 API 路由可能被打包成不同模块，用 globalThis 确保共用同一份
const store = globalThis as unknown as {
  __douyinFollowQueue?: Map<string, PendingDouyin>;
};
const queue = (store.__douyinFollowQueue ??= new Map());

export function listPendingDouyin(now = Date.now()): PendingDouyin[] {
  queue.forEach((p, ref) => {
    if (now - p.at > PENDING_DOUYIN_TTL_MS) queue.delete(ref);
  });
  return Array.from(queue.values()).sort((a, b) => a.at - b.at);
}

/** 同一个连结只留最后一次的决定 */
export function addPendingDouyin(
  op: 'add' | 'rm',
  ref: string,
  name = '',
  at = Date.now()
): void {
  queue.delete(ref);
  queue.set(ref, { op, ref, name: text(name, 60), at });
}

export function clearPendingDouyin(): void {
  queue.clear();
}

/** 拿最新的 douyin.json 对一遍：已经生效的待办就划掉 */
export function settleDouyin(data: DouyinData): void {
  queue.forEach((p, ref) => {
    const present = hasRef(data, ref);
    if ((p.op === 'add' && present) || (p.op === 'rm' && !present))
      queue.delete(ref);
  });
}

/** 资料套上还没处理的移除 = 使用者现在应该看到的剧 */
export function visibleDramas(
  data: DouyinData,
  pending: PendingDouyin[]
): DouyinDrama[] {
  const removed = new Set(
    pending.filter((p) => p.op === 'rm').map((p) => p.ref)
  );
  return data.dramas.filter(
    (d) => !removed.has(d.ref) && !d.alias.some((a) => removed.has(a))
  );
}
