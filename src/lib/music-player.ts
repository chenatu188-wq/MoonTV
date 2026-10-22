/**
 * 音乐分区的连续播放。纯函数。
 *
 * 不靠网页自己监听「播完了」再换下一首：手机切到背景、锁萤幕时网页的程式会被暂停，
 * 换不了歌。改用 YouTube 嵌入播放器自带的 playlist 参数，把后面的歌一起交给它，
 * 播完由播放器自己接下一首。网页只负责从播放器回报的讯息知道现在播到哪一首。
 */

/** 网址太长 YouTube 会拒绝，一次最多交给它这么多首 */
export const MAX_QUEUE = 150;
const ID = /^[\w-]{11}$/;

/**
 * 从第 index 首开始播。loop：整份清单播完再从头（包含 index 前面的歌）。
 */
export function musicEmbedUrl(
  ids: string[],
  index: number,
  loop: boolean
): string {
  const list = ids.filter((id) => ID.test(id));
  const i = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
  const first = list[i];
  const after = list.slice(i + 1);
  const rest = loop ? [...after, ...list.slice(0, i)] : after;
  const q = new URLSearchParams({
    autoplay: '1',
    enablejsapi: '1',
    rel: '0',
    playsinline: '1',
  });
  // playlist 参数：第一首（网址路径那首）播完后依序播这些
  const playlist = (loop ? [first, ...rest] : rest).slice(0, MAX_QUEUE);
  if (playlist.length) q.set('playlist', playlist.join(','));
  if (loop) q.set('loop', '1');
  return `https://www.youtube.com/embed/${first}?${q}`;
}

/**
 * YouTube 播放器回报的讯息（要先送 listening 它才会回报）。
 * 回传现在播的影片 id、播放状态（0 播完、1 播放中、2 暂停…）；看不懂回 null。
 */
export function parseYtMessage(
  data: unknown
): { videoId: string | null; state: number | null } | null {
  let msg: { event?: string; info?: unknown };
  try {
    msg = typeof data === 'string' ? JSON.parse(data) : (data as typeof msg);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  const info = (msg.info ?? null) as Record<string, unknown> | number | null;
  if (msg.event === 'onStateChange' && typeof info === 'number') {
    return { videoId: null, state: info };
  }
  if (msg.event !== 'infoDelivery' || !info || typeof info !== 'object')
    return null;
  const vd = info.videoData as { video_id?: unknown } | undefined;
  const videoId =
    typeof vd?.video_id === 'string' && ID.test(vd.video_id)
      ? vd.video_id
      : null;
  const state = typeof info.playerState === 'number' ? info.playerState : null;
  if (videoId === null && state === null) return null;
  return { videoId, state };
}
