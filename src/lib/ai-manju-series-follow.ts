/**
 * AI 漫剧「追剧」：追的是一部剧（剧名＋发片频道），不是整个频道。
 * 打开 AI 漫剧页时，用「找全季／全集」同一支搜寻把这部剧现在有的集数抓回来，
 * 跟上次看过的比对，多出来的就是新集，在页面上标「新」。
 * 名单只存在这台装置（localStorage）。纯函数，hook 在 use-series-follows.ts。
 */
import { stripSeason } from '@/lib/ai-manju-series';

export interface SeriesEpisode {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelUrl: string;
  season: number | null;
  episode: number | null;
}

export interface SeriesFollow {
  /** 剧名（seriesNameOf 认出来的，已去掉季数） */
  name: string;
  /** 发片频道；搜寻时会一起在这个频道里找，各季才找得齐 */
  channelId: string | null;
  channel: string;
  /** 已经知道的集数（影片编号）：追剧当下有的、或后来看过的 */
  known: string[];
  /** 还没看过的新集 */
  newIds: string[];
  /** 目前最新的一集 */
  latest: SeriesEpisode | null;
  /** 上次检查的时间（Unix 毫秒），0 表示还没检查过 */
  checkedAt: number;
  /** 追剧的时间（Unix 毫秒） */
  addedAt: number;
}

export const SERIES_FOLLOWS_KEY = 'moontv_ai_manju_series_follows';
export const MAX_SERIES_FOLLOWS = 100;
const MAX_KNOWN = 400;
/** 搜寻结果伺服器会缓存一小时，太常查也拿不到新的 */
export const RECHECK_MS = 30 * 60 * 1000;

export const followKey = (f: Pick<SeriesFollow, 'name' | 'channelId'>) =>
  `${f.name}|${f.channelId ?? ''}`;

const VIDEO_ID = /^[\w-]{11}$/;
const CHANNEL_ID = /^UC[\w-]{22}$/;

const text = (v: unknown, max: number) =>
  typeof v === 'string'
    ? Array.from(v)
        .filter((c) => c >= ' ' && c !== '\u007f')
        .join('')
        .trim()
        .slice(0, max)
    : '';
const ids = (v: unknown) =>
  Array.isArray(v)
    ? Array.from(new Set(v.filter((x) => typeof x === 'string' && VIDEO_ID.test(x)))).slice(-MAX_KNOWN)
    : [];
const numOrNull = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const time = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

function sanitizeEpisode(raw: unknown): SeriesEpisode | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const videoId = String(r.videoId ?? '');
  if (!VIDEO_ID.test(videoId)) return null;
  return {
    videoId,
    title: text(r.title, 200),
    thumbnail:
      typeof r.thumbnail === 'string' && /^https:\/\//.test(r.thumbnail)
        ? r.thumbnail
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    channel: text(r.channel, 80),
    channelUrl:
      typeof r.channelUrl === 'string' &&
      /^https:\/\/www\.youtube\.com\//.test(r.channelUrl)
        ? r.channelUrl
        : '',
    season: numOrNull(r.season),
    episode: numOrNull(r.episode),
  };
}

/** 从 localStorage 读回来的、或新加的一笔；格式不对回 null */
export function sanitizeSeriesFollow(raw: unknown): SeriesFollow | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = text(r.name, 40);
  if (name.length < 2) return null;
  const channelId =
    typeof r.channelId === 'string' && CHANNEL_ID.test(r.channelId)
      ? r.channelId
      : null;
  const known = ids(r.known);
  return {
    name,
    channelId,
    channel: text(r.channel, 80),
    known,
    newIds: ids(r.newIds).filter((id) => !known.includes(id)),
    latest: sanitizeEpisode(r.latest),
    checkedAt: time(r.checkedAt),
    addedAt: time(r.addedAt),
  };
}

export function sanitizeSeriesFollows(raw: unknown): SeriesFollow[] {
  const out: SeriesFollow[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const f = sanitizeSeriesFollow(x);
    if (f && !seen.has(followKey(f))) {
      seen.add(followKey(f));
      out.push(f);
    }
  }
  return out.slice(0, MAX_SERIES_FOLLOWS);
}

/** 搜寻结果里算是这部剧的集数（片名吻合的） */
export interface SearchHit extends SeriesEpisode {
  match: boolean;
}

/**
 * 最新的一集：有写季数、集数的取最大的；都没写就取搜寻排第一个吻合的。
 * 没写季数的当第 1 季（第一季常常不写）。
 */
export function latestOf(hits: SearchHit[]): SeriesEpisode | null {
  const matched = hits.filter((h) => h.match);
  if (!matched.length) return null;
  let best = matched[0];
  for (const h of matched) {
    const a = [h.season ?? 1, h.episode ?? 0];
    const b = [best.season ?? 1, best.episode ?? 0];
    if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) best = h;
  }
  const { match: _match, ...ep } = best;
  return ep;
}

/** 检查完：多出来的集数记成新集。第一次检查只建立基准，不算新集 */
export function applyCheck(
  f: SeriesFollow,
  hits: SearchHit[],
  now = Date.now()
): SeriesFollow {
  const found = Array.from(
    new Set(hits.filter((h) => h.match).map((h) => h.videoId))
  );
  const latest = latestOf(hits) ?? f.latest;
  if (f.checkedAt === 0 && f.known.length === 0) {
    return { ...f, known: found.slice(-MAX_KNOWN), newIds: [], latest, checkedAt: now };
  }
  const known = new Set(f.known);
  const newIds = Array.from(
    new Set([...f.newIds, ...found.filter((id) => !known.has(id))])
  );
  return { ...f, newIds, latest, checkedAt: now };
}

/** 看过了：指定的几集（没给就是全部新集）收进 known */
export function markSeen(f: SeriesFollow, videoIds?: string[]): SeriesFollow {
  const seen = videoIds ?? f.newIds;
  if (!seen.length) return f;
  return {
    ...f,
    known: Array.from(new Set([...f.known, ...seen])).slice(-MAX_KNOWN),
    newIds: f.newIds.filter((id) => !seen.includes(id)),
  };
}

/** 有新集的排前面，其次最近追的在前 */
export function sortFollows(list: SeriesFollow[]): SeriesFollow[] {
  return [...list].sort(
    (a, b) =>
      Number(b.newIds.length > 0) - Number(a.newIds.length > 0) ||
      b.addedAt - a.addedAt
  );
}

export function episodeLabel(ep: Pick<SeriesEpisode, 'season' | 'episode'>): string {
  const s = ep.season !== null ? `第 ${ep.season} 季` : '';
  const e = ep.episode !== null ? `第 ${ep.episode} 集` : '';
  return [s, e].filter(Boolean).join(' ') || '最新一支';
}

// ── 网友推荐：批次贴上剧名 ───────────────────────────────────────

/** 不是剧名的字：推荐文常见的标题、说明 */
const NOT_TITLE =
  /^(网友推荐|網友推薦|推荐|推薦|必看|好看|强推|強推|分享|合集|片单|片單|ai漫剧|ai漫劇|漫剧|漫劇|动漫|動漫|短剧|短劇|更新中|已完结|已完結|完结|完結)$/i;

function cleanTitle(raw: string): string {
  const t = stripSeason(
    raw
      .replace(/https?:\/\/\S+/g, '')
      .replace(/#\S+/g, '')
      // 括号里的说明：（全80集）（已完结）(推荐)
      .replace(/[（([【][^）)\]】]{0,20}[）)\]】]/g, '')
      .replace(/^[\s\d]{1,3}[.、．)）:：\s]+/, '') // 前面的编号 1. 2、 3)
      .replace(/\p{So}|\p{Sk}|\p{Cs}|\u200d|\ufe0f/gu, '') // 表情符号
      .replace(/[-—–_·•*~～|｜:：!！?？。，,、;；"'“”‘’「」『』]+/g, ' ')
      .replace(/(全|共)\s*\d+\s*[集话話]|\d+\s*[集话話]全?|更新至.*$|已?完结|已?完結/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
  return Array.from(t).slice(0, 30).join('').trim();
}

/**
 * 从一段推荐文字挑出剧名（照出现顺序、去重）：
 * 有《》的只取书名号里的；没有的一行一部（同一行用、，；/ 隔开的拆成多部），
 * 去掉编号、表情、hashtag、（全80集）这类说明，以及「第二季」这种季数。
 */
export function extractTitles(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const t = cleanTitle(raw);
    const cjk = (t.match(/[\u3400-\u9fff]/g) ?? []).length;
    if (cjk < 2 && t.length < 3) return;
    if (NOT_TITLE.test(t.replace(/\s/g, ''))) return;
    const key = t.replace(/\s/g, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  for (const raw of text.normalize('NFKC').split(/\r?\n/)) {
    // 网址先拿掉，免得被下面的「/」拆成好几段
    const line = raw.replace(/(https?:\/\/|www\.)\S+/g, ' ');
    const quoted = Array.from(line.matchAll(/《([^》]{1,40})》/g)).map((m) => m[1]);
    if (quoted.length) {
      quoted.forEach(add);
      continue;
    }
    line.split(/[、，,；;／/]/).forEach(add);
  }
  return out;
}
