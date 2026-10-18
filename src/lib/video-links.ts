/**
 * AI 漫剧、TikTok 漫剧、抖音追剧的影片是在页面上的播放器里播的，本来没有自己的网址。
 * 这里给每支影片一个网址（页面网址带参数），卡片做成连结后，
 * 右键「在新分页开启」开的新分页一载入就直接打开那支影片的播放器。纯函数。
 */
import type { AiManjuVideo } from '@/lib/ai-manju-feed';

const YT_ID = /^[\w-]{11}$/;
const YT_CHANNEL = /^UC[\w-]{22}$/;
const NUM_ID = /^\d{8,25}$/;
const HANDLE = /^[a-z0-9._]{2,24}$/;

const clip = (s: string | null | undefined, max: number) =>
  Array.from((s ?? '').trim())
    .filter((c) => c >= ' ' && c !== '\u007f')
    .slice(0, max)
    .join('');

function query(params: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return q.toString();
}

// ── AI 漫剧（YouTube） ─────────────────────────────────────────

export function aiManjuHref(
  v: Pick<AiManjuVideo, 'videoId' | 'title' | 'channel' | 'channelUrl'>
): string {
  const ch = /\/channel\/(UC[\w-]{22})/.exec(v.channelUrl ?? '')?.[1] ?? '';
  return `/ai-manju?${query({
    v: v.videoId,
    t: clip(v.title, 100),
    c: clip(v.channel, 40),
    ch,
  })}`;
}

/** 网址带的影片；没带或格式不对回 null。标题、频道只是显示用，可能被改过，所以只当文字 */
export function aiManjuFromSearch(search: string): AiManjuVideo | null {
  const q = new URLSearchParams(search);
  const id = q.get('v') ?? '';
  if (!YT_ID.test(id)) return null;
  const ch = q.get('ch') ?? '';
  const channel = clip(q.get('c'), 40);
  return {
    videoId: id,
    title: clip(q.get('t'), 100),
    channel,
    channelUrl: YT_CHANNEL.test(ch)
      ? `https://www.youtube.com/channel/${ch}`
      : '',
    published: '',
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    description: '',
    views: null,
    sourceKey: '',
    sourceName: channel,
  };
}

// ── TikTok 漫剧 ───────────────────────────────────────────────

export interface TiktokLinkVideo {
  id: string;
  handle: string;
  name: string;
  title: string;
}

export function tiktokHref(v: TiktokLinkVideo): string {
  return `/tiktok-manju?${query({
    v: v.id,
    h: v.handle,
    n: clip(v.name, 40),
    t: clip(v.title, 100),
  })}`;
}

export function tiktokFromSearch(search: string): TiktokLinkVideo | null {
  const q = new URLSearchParams(search);
  const id = q.get('v') ?? '';
  const handle = (q.get('h') ?? '').toLowerCase();
  if (!NUM_ID.test(id) || !HANDLE.test(handle)) return null;
  return {
    id,
    handle,
    name: clip(q.get('n'), 40) || handle,
    title: clip(q.get('t'), 100),
  };
}

// ── 抖音追剧 ─────────────────────────────────────────────────

export function douyinHref(dramaId: string, episodeId: string): string {
  return `/tiktok-manju?${query({ dy: dramaId, ep: episodeId })}`;
}

export function douyinFromSearch(
  search: string
): { dramaId: string; episodeId: string } | null {
  const q = new URLSearchParams(search);
  const dramaId = q.get('dy') ?? '';
  const episodeId = q.get('ep') ?? '';
  if (!NUM_ID.test(dramaId) || !NUM_ID.test(episodeId)) return null;
  return { dramaId, episodeId };
}

/** 关掉播放器时把网址上的影片参数拿掉，重新整理才不会又跳出来 */
export function clearVideoParams(keys: string[]): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const k of keys) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, '', url.toString());
}
