/**
 * 判断搜寻栏里贴的是不是 YouTube 网址。纯函数，前后端共用。
 * - video：影片网址（watch?v=、youtu.be/、/shorts/、/live/、/embed/）→ 直接播
 * - channel：频道网址、@帐号、播放列表网址 → 直接加进追踪
 * - null：不是 YouTube 网址，照旧当剧名搜寻
 */
export type YoutubePaste =
  | { kind: 'video'; videoId: string }
  | { kind: 'channel'; input: string };

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);
const VIDEO_ID = /^[\w-]{11}$/;

export function youtubePasteOf(raw: string): YoutubePaste | null {
  const q = raw.trim();
  if (!q || q.length > 300 || /\s/.test(q)) return null;
  if (/^@[^\s/]{2,60}$/.test(q)) return { kind: 'channel', input: q };

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(q) ? q : `https://${q}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const path = u.pathname;

  let videoId = '';
  if (host === 'youtu.be') videoId = path.slice(1).split('/')[0];
  else if (path === '/watch') videoId = u.searchParams.get('v') ?? '';
  else videoId = /^\/(?:shorts|live|embed)\/([\w-]+)/.exec(path)?.[1] ?? '';
  if (VIDEO_ID.test(videoId)) return { kind: 'video', videoId };

  if (
    /^\/(channel\/UC[\w-]{22}|@[^/]+|c\/[^/]+|user\/[^/]+)/.test(path) ||
    (path === '/playlist' && u.searchParams.get('list'))
  ) {
    return { kind: 'channel', input: q };
  }
  return null;
}
