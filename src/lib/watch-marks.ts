/**
 * 「标记，下次继续看」：AI 漫剧和 TikTok 漫剧共用。纯函数，存取 localStorage 的部分在 use-watch-marks.ts。
 * 线上是 localstorage 模式、没有伺服器端资料库，所以标记存在浏览器里，每台装置各自一份。
 */
export interface WatchMark<T> {
  id: string;
  /** 重新播放需要的影片资料 */
  video: T;
  /** 看到第几秒；拿不到进度时是 0 */
  seconds: number;
  /** 标记的时间，Unix 毫秒 */
  at: number;
}

export const MAX_MARKS = 50;

/** 从 localStorage 读回来的东西不可信，格式不对的丢掉 */
export function sanitizeMarks<T>(raw: unknown): WatchMark<T>[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is WatchMark<T> =>
        m &&
        typeof m.id === 'string' &&
        m.id !== '' &&
        typeof m.video === 'object' &&
        m.video !== null
    )
    .map((m) => ({
      id: m.id,
      video: m.video,
      seconds: Number.isFinite(m.seconds) && m.seconds > 0 ? m.seconds : 0,
      at: Number.isFinite(m.at) ? m.at : 0,
    }))
    .slice(0, MAX_MARKS);
}

/** 新增或更新一笔，最新的排最前面；超过上限丢最旧的 */
export function upsertMark<T>(
  list: WatchMark<T>[],
  mark: WatchMark<T>,
  max = MAX_MARKS
): WatchMark<T>[] {
  return [mark, ...list.filter((m) => m.id !== mark.id)].slice(0, max);
}

export function removeMark<T>(
  list: WatchMark<T>[],
  id: string
): WatchMark<T>[] {
  return list.filter((m) => m.id !== id);
}

/** 125 → 「2:05」；3725 → 「1:02:05」 */
export function formatPosition(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** 续播时往回退几秒，免得接不上剧情 */
export function resumeFrom(seconds: number): number {
  return Math.max(0, Math.floor(seconds) - 3);
}

export type PlayerKind = 'youtube' | 'tiktok';

/**
 * 从嵌入播放器丢出来的 postMessage 里读出目前播到第几秒；不是进度讯息回 null。
 * YouTube 丢的是 JSON 字串 {event:'infoDelivery', info:{currentTime}}，
 * TikTok 丢的是物件 {'x-tiktok-player':true, type:'onCurrentTime', value:{currentTime}}。
 */
export function parsePlayerTime(
  kind: PlayerKind,
  data: unknown
): number | null {
  let msg: any = data; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object') return null;
  const t =
    kind === 'youtube'
      ? msg.event === 'infoDelivery'
        ? msg.info?.currentTime
        : undefined
      : msg['x-tiktok-player'] && msg.type === 'onCurrentTime'
      ? msg.value?.currentTime
      : undefined;
  return typeof t === 'number' && Number.isFinite(t) && t >= 0 ? t : null;
}
