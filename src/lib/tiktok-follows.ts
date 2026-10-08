/**
 * TikTok 漫剧的「追踪变更」待办。
 *
 * TikTok 的影片清单只能在站长的 Mac 上用 yt-dlp 抓，追踪名单也在那台 Mac 上。
 * 网站没有资料库，所以在网页上按追踪／移除时，只是把变更记在伺服器记忆体里；
 * Mac 每 5 分钟来问一次（/api/cron/tiktok-follows），照着改名单、重抓、推新资料。
 * 新资料里看得到结果了，这笔待办就算完成。
 *
 * 记忆体会在重新部署时清空，所以浏览器自己也留一份待办，下次开页会补送。
 */

export type FollowOp = 'add' | 'rm';
export interface PendingFollow {
  op: FollowOp;
  handle: string;
  /** Unix 毫秒 */
  at: number;
}

export const MAX_ACCOUNTS = 40;
export const MAX_PENDING = 30;
/** 超过这么久还没被处理就放弃（Mac 关机之类） */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;

/**
 * 从使用者贴的东西取出帐号：@帐号、帐号、主页网址、影片网址都可以。
 * 认不出来回 null。
 */
export function parseHandle(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  const url = /tiktok\.com\/@([^/?#\s]+)/i.exec(s);
  if (url) s = url[1];
  else if (/^https?:\/\//i.test(s) || s.includes('/')) return null; // 短网址等认不出帐号
  s = s.replace(/^@/, '');
  if (!HANDLE_RE.test(s) || s.endsWith('.')) return null;
  return s.toLowerCase();
}

// 两支 API 路由可能被打包成不同模块，用 globalThis 确保共用同一份
const store = globalThis as unknown as {
  __tiktokFollowQueue?: Map<string, PendingFollow>;
};
const queue = (store.__tiktokFollowQueue ??= new Map());

export function listPending(now = Date.now()): PendingFollow[] {
  queue.forEach((p, handle) => {
    if (now - p.at > PENDING_TTL_MS) queue.delete(handle);
  });
  return Array.from(queue.values()).sort((a, b) => a.at - b.at);
}

/** 同一个帐号只留最后一次的决定 */
export function addPending(
  op: FollowOp,
  handle: string,
  at = Date.now()
): void {
  queue.delete(handle);
  queue.set(handle, { op, handle, at });
}

export function clearPending(): void {
  queue.clear();
}

/**
 * 拿最新资料对一遍：已经生效的待办就划掉。
 * known = 资料里出现的帐号（抓成功的和抓失败的都算，代表 Mac 已经处理过）
 */
export function settle(known: Iterable<string>): void {
  const set = new Set(Array.from(known, (h) => h.toLowerCase()));
  queue.forEach((p, handle) => {
    const present = set.has(handle);
    if ((p.op === 'add' && present) || (p.op === 'rm' && !present))
      queue.delete(handle);
  });
}
