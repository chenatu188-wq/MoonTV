/**
 * AI 漫剧「追剧」：追的是一部剧（剧名＋发片频道），不是整个频道。
 * 打开 AI 漫剧页时，用「找全季／全集」同一支搜寻把这部剧现在有的集数抓回来，
 * 跟上次看过的比对，多出来的就是新集，在页面上标「新」。
 * 名单只存在这台装置（localStorage）。纯函数，hook 在 use-series-follows.ts。
 */

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
export const MAX_SERIES_FOLLOWS = 50;
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
