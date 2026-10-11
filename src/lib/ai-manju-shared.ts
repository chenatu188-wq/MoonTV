/**
 * AI 漫剧「你追踪的」频道：全站共用的清单。
 *
 * 网站没有资料库，所以共用清单放在 repo 的 tiktok-data 分支（ai-manju-follows.json），
 * 由站长的 Mac 负责改：网页上按追踪／移除时，变更先记在伺服器记忆体里，
 * Mac 每 5 分钟来问一次（/api/cron/ai-manju-follows），改好推上去，所有装置就都看得到。
 * 做法跟 TikTok 漫剧的追踪名单（lib/tiktok-follows.ts）一样。
 * Mac 还没处理之前，这台伺服器先把待办套在清单上回给前端，所以按了马上看得到。
 */
import { isValidSourceId, MAX_CUSTOM_SOURCES } from '@/lib/ai-manju-sources';

export interface SharedFollow {
  type: 'channel' | 'playlist';
  id: string;
  name: string;
}

export interface PendingShared extends SharedFollow {
  op: 'add' | 'rm';
  /** Unix 毫秒 */
  at: number;
}

export const MAX_SHARED = MAX_CUSTOM_SOURCES;
export const MAX_PENDING_SHARED = 60;
/** 超过这么久还没被处理就放弃（Mac 关机之类） */
export const PENDING_SHARED_TTL_MS = 24 * 60 * 60 * 1000;

/** 使用者送来的、或从档案读回来的一笔追踪；格式不对回 null */
export function sanitizeFollow(raw: unknown): SharedFollow | null {
  const r = raw as Partial<SharedFollow> | null;
  if (!r || (r.type !== 'channel' && r.type !== 'playlist')) return null;
  if (typeof r.id !== 'string' || !isValidSourceId(r.type, r.id)) return null;
  const name =
    typeof r.name === 'string'
      ? Array.from(r.name)
          .filter((c) => c >= ' ' && c !== '\u007f') // 去掉控制字元
          .join('')
          .trim()
          .slice(0, 80)
      : '';
  return { type: r.type, id: r.id, name: name || r.id };
}

export function sanitizeFollows(raw: unknown): SharedFollow[] {
  const out: SharedFollow[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const f = sanitizeFollow(x);
    if (f && !seen.has(f.id)) {
      seen.add(f.id);
      out.push(f);
    }
  }
  return out;
}

// 两支 API 路由可能被打包成不同模块，用 globalThis 确保共用同一份
const store = globalThis as unknown as {
  __aiManjuFollowQueue?: Map<string, PendingShared>;
};
const queue = (store.__aiManjuFollowQueue ??= new Map());

export function listPendingShared(now = Date.now()): PendingShared[] {
  queue.forEach((p, id) => {
    if (now - p.at > PENDING_SHARED_TTL_MS) queue.delete(id);
  });
  return Array.from(queue.values()).sort((a, b) => a.at - b.at);
}

/** 同一个来源只留最后一次的决定 */
export function addPendingShared(
  op: 'add' | 'rm',
  follow: SharedFollow,
  at = Date.now()
): void {
  queue.delete(follow.id);
  queue.set(follow.id, { ...follow, op, at });
}

export function clearPendingShared(): void {
  queue.clear();
}

/** 拿最新的共用清单对一遍：已经生效的待办就划掉 */
export function settleShared(follows: SharedFollow[]): void {
  const ids = new Set(follows.map((f) => f.id));
  queue.forEach((p, id) => {
    const present = ids.has(id);
    if ((p.op === 'add' && present) || (p.op === 'rm' && !present))
      queue.delete(id);
  });
}

/** 共用清单套上还没处理的待办 = 使用者现在应该看到的清单 */
export function applyPending(
  follows: SharedFollow[],
  pending: PendingShared[]
): SharedFollow[] {
  const removed = new Set(
    pending.filter((p) => p.op === 'rm').map((p) => p.id)
  );
  const out = follows.filter((f) => !removed.has(f.id));
  const have = new Set(out.map((f) => f.id));
  for (const p of pending) {
    if (p.op === 'add' && !have.has(p.id)) {
      have.add(p.id);
      out.push({ type: p.type, id: p.id, name: p.name });
    }
  }
  return out;
}
