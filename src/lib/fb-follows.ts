/**
 * 「FB 影片」的追踪变更待办，做法跟 lib/tiktok-follows.ts 一样：
 * FB 的影片清单只能在站长的 Mac 上用无头浏览器抓，追踪名单（fb.txt）也在那台 Mac 上。
 * 网页上按追踪／移除只记在伺服器记忆体，Mac 每 5 分钟来问 /api/cron/fb-follows。
 */

export type FbFollowOp = 'add' | 'rm';
export interface PendingFbFollow {
  op: FbFollowOp;
  /** 粉专代号：网址上的名称（例 NASA）或 profile.php?id= 的数字编号 */
  page: string;
  /** Unix 毫秒 */
  at: number;
}

export const MAX_FB_PAGES = 30;
export const MAX_FB_PENDING = 30;
export const FB_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const PAGE_RE = /^(?:[A-Za-z0-9.]{2,80}|\d{8,25})$/;
/** facebook.com/ 后面接这些的不是粉专 */
const NOT_PAGE = new Set([
  'watch',
  'reel',
  'reels',
  'share',
  'groups',
  'events',
  'stories',
  'photo',
  'photo.php',
  'video.php',
  'story.php',
  'permalink.php',
  'login',
  'home.php',
  'pages',
  'people',
  'plugins',
  'hashtag',
  'marketplace',
  'gaming',
]);

/**
 * 从使用者贴的东西取出粉专代号：粉专名称、粉专网址、粉专的影片网址、profile.php?id= 都可以。
 * 分享短网址（facebook.com/share/…）认不出是哪个粉专，回 null。
 */
export function parseFbPage(input: string): string | null {
  let s = input
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .trim();
  if (!s) return null;
  if (/^(https?:\/\/)?([\w-]+\.)?(facebook|fb)\.com\b/i.test(s)) {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const id = url.searchParams.get('id');
    if (url.pathname.startsWith('/profile.php'))
      return id && /^\d{8,25}$/.test(id) ? id : null;
    s = decodeURIComponent(url.pathname.split('/').filter(Boolean)[0] ?? '');
    if (NOT_PAGE.has(s.toLowerCase())) return null;
  } else if (/^https?:\/\//i.test(s) || s.includes('/')) {
    return null;
  }
  s = s.replace(/^@/, '');
  return PAGE_RE.test(s) ? s : null;
}

const store = globalThis as unknown as {
  __fbFollowQueue?: Map<string, PendingFbFollow>;
};
const queue = (store.__fbFollowQueue ??= new Map());

export function listFbPending(now = Date.now()): PendingFbFollow[] {
  queue.forEach((p, k) => {
    if (now - p.at > FB_PENDING_TTL_MS) queue.delete(k);
  });
  return Array.from(queue.values()).sort((a, b) => a.at - b.at);
}

/** 同一个粉专只留最后一次的决定；粉专名称不分大小写 */
export function addFbPending(
  op: FbFollowOp,
  page: string,
  at = Date.now()
): void {
  queue.delete(page.toLowerCase());
  queue.set(page.toLowerCase(), { op, page, at });
}

export function clearFbPending(): void {
  queue.clear();
}

/** known = 新资料里出现的粉专（抓成功和失败的都算） */
export function settleFb(known: Iterable<string>): void {
  const set = new Set(Array.from(known, (p) => p.toLowerCase()));
  queue.forEach((p, k) => {
    const present = set.has(k);
    if ((p.op === 'add' && present) || (p.op === 'rm' && !present))
      queue.delete(k);
  });
}
