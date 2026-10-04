import { AiManjuSource, feedUrl } from '@/lib/ai-manju-sources';

export interface AiManjuVideo {
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string;
  published: string;
  thumbnail: string;
  description: string;
  views: number | null;
  sourceKey: string;
  sourceName: string;
  /** 搜寻结果没有精确的时间与观看数，改用 YouTube 给的文字（例：「3 天前 · 观看次数：1.2万次」） */
  meta?: string;
}

/**
 * YouTube 会挡看起来像脚本的请求，headers 尽量贴近真实浏览器。
 * CONSENT cookie 是关键：机房 IP 常被导到「同意页」而拿不到真正内容，
 * 2026-08-29 本机实测，不带这个 cookie 抓频道页只会回 763 bytes 的同意页。
 */
export const YT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+917',
};

/** 取第一个匹配分组，取不到回空字符串 */
function pick(block: string, re: RegExp): string {
  return re.exec(block)?.[1] ?? '';
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 解析 YouTube 的 Atom feed。
 * 结构固定（yt:videoId / media:thumbnail / media:statistics），
 * edge runtime 没有可靠的 DOMParser，所以用正则拆。
 */
function parseFeed(xml: string, source: AiManjuSource): AiManjuVideo[] {
  const out: AiManjuVideo[] = [];
  const entries = xml.split('<entry>').slice(1);

  for (const raw of entries) {
    const block = raw.split('</entry>')[0];
    const videoId = pick(block, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!videoId) continue;

    const viewsRaw = pick(block, /<media:statistics views="(\d+)"/);

    out.push({
      videoId,
      title: decodeEntities(
        pick(block, /<media:title>([^<]*)<\/media:title>/) ||
          pick(block, /<title>([^<]*)<\/title>/)
      ),
      channel: decodeEntities(pick(block, /<name>([^<]*)<\/name>/)),
      channelUrl: pick(block, /<uri>([^<]*)<\/uri>/),
      published: pick(block, /<published>([^<]+)<\/published>/),
      thumbnail:
        pick(block, /<media:thumbnail url="([^"]+)"/) ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      description: decodeEntities(
        pick(block, /<media:description>([\s\S]*?)<\/media:description>/)
      ).slice(0, 200),
      views: viewsRaw ? Number(viewsRaw) : null,
      sourceKey: source.key,
      sourceName: source.name,
    });
  }

  return out;
}

export interface FetchResult {
  videos: AiManjuVideo[];
  /** feed 自带的标题：频道 feed 是频道名，播放列表 feed 是列表名 */
  feedTitle: string;
  /** 失败原因，成功时为 null。会回给前端，方便线上直接看到问题 */
  error: string | null;
}

/**
 * YouTube 的 RSS 端点很不稳：2026-10-03 实测同一个网址隔几秒打，
 * 约七成会回 404 / 500，跟请求频率无关。所以要重试，
 * 重试完还是失败就沿用上次成功抓到的结果。
 */
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 400;

/** 这段时间内抓过的来源直接用缓存，不再打 YouTube */
const FRESH_MS = 30 * 60 * 1000;

/** 上次成功的结果（存在伺服器记忆体，重启就清空） */
const lastGood = new Map<
  string,
  { videos: AiManjuVideo[]; feedTitle: string; at: number }
>();
/** 正在抓的来源，避免同一个来源同时被抓好几次 */
const inflight = new Map<string, Promise<FetchResult>>();

async function fetchOnce(source: AiManjuSource): Promise<FetchResult> {
  const res = await fetch(feedUrl(source), {
    headers: {
      ...YT_HEADERS,
      Accept: 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return { videos: [], feedTitle: '', error: `HTTP ${res.status}` };
  }

  const xml = await res.text();
  // 第一个 <entry> 之前的 <title> 才是 feed 本身的标题
  const feedTitle = decodeEntities(
    pick(xml.split('<entry>')[0], /<title>([^<]*)<\/title>/)
  );
  const videos = parseFeed(xml, source);
  if (videos.length === 0 && !xml.includes('<feed')) {
    // 拿到 200 但不是 feed，多半是被挡后回了同意页/验证页
    return {
      videos: [],
      feedTitle,
      error: `解析到 0 笔（回应 ${xml.length} 字元）`,
    };
  }
  // 是合法 feed 但 0 支影片（新频道 / 空列表）不算失败
  return { videos, feedTitle, error: null };
}

async function fetchWithRetry(source: AiManjuSource): Promise<FetchResult> {
  let last: FetchResult = { videos: [], feedTitle: '', error: '未知错误' };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
    try {
      last = await fetchOnce(source);
    } catch (e) {
      last = {
        videos: [],
        feedTitle: '',
        error: `${(e as Error).name}: ${(e as Error).message}`,
      };
    }
    if (last.error === null) {
      lastGood.set(source.id, {
        videos: last.videos,
        feedTitle: last.feedTitle,
        at: Date.now(),
      });
      return last;
    }
  }
  return { ...last, error: `${last.error}（已重试 ${MAX_ATTEMPTS} 次）` };
}

function refresh(source: AiManjuSource): Promise<FetchResult> {
  let p = inflight.get(source.id);
  if (!p) {
    p = fetchWithRetry(source).finally(() => inflight.delete(source.id));
    inflight.set(source.id, p);
  }
  return p;
}

/**
 * 抓一个来源。来源多了以后（内建就有几十个）不能每次开页都全部重抓：
 * - 30 分钟内抓过：直接回缓存
 * - 缓存过期：先回旧的，背景更新，下次开页就是新的
 * - 完全没缓存：等它抓完；失败就回报错误，不影响其他来源
 */
export async function fetchSource(source: AiManjuSource): Promise<FetchResult> {
  const cached = lastGood.get(source.id);
  if (cached) {
    if (Date.now() - cached.at > FRESH_MS) {
      refresh(source).catch(() => undefined);
    }
    // 缓存里的 sourceKey/sourceName 以这次请求的来源为准
    return {
      videos: cached.videos.map((v) => ({
        ...v,
        sourceKey: source.key,
        sourceName: source.name,
      })),
      feedTitle: cached.feedTitle,
      error: null,
    };
  }
  return refresh(source);
}

/** 限制同时抓几个，免得一次对 YouTube 发出几十个请求 */
export async function fetchSources(
  sources: AiManjuSource[],
  concurrency = 16
): Promise<FetchResult[]> {
  const results: FetchResult[] = new Array(sources.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, sources.length) }, async () => {
      while (next < sources.length) {
        const i = next++;
        results[i] = await fetchSource(sources[i]);
      }
    })
  );
  return results;
}
