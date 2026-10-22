/**
 * 音乐分区追踪的 YouTube 频道／播放列表：全站共用的清单。
 * 做法跟 AI 漫剧的共用追踪（lib/ai-manju-shared.ts）一样：网页上的追踪／移除先记在伺服器记忆体，
 * 站长的 Mac 每 5 分钟来问（/api/cron/music-follows），写进 tiktok-data 分支的 music-follows.json，
 * 所有装置就都看得到。格式检查、套用待办的纯函数直接沿用 AI 漫剧那一份。
 */
import {
  type PendingShared,
  type SharedFollow,
  PENDING_SHARED_TTL_MS,
} from '@/lib/ai-manju-shared';

export {
  applyPending,
  sanitizeFollow,
  sanitizeFollows,
} from '@/lib/ai-manju-shared';
export type { PendingShared, SharedFollow };

export const MAX_MUSIC_FOLLOWS = 60;
export const MAX_PENDING_MUSIC = 60;

// 两支 API 路由可能被打包成不同模块，用 globalThis 确保共用同一份
const store = globalThis as unknown as {
  __musicFollowQueue?: Map<string, PendingShared>;
};
const queue = (store.__musicFollowQueue ??= new Map());

export function listPendingMusic(now = Date.now()): PendingShared[] {
  queue.forEach((p, id) => {
    if (now - p.at > PENDING_SHARED_TTL_MS) queue.delete(id);
  });
  return Array.from(queue.values()).sort((a, b) => a.at - b.at);
}

/** 同一个来源只留最后一次的决定 */
export function addPendingMusic(
  op: 'add' | 'rm',
  follow: SharedFollow,
  at = Date.now()
): void {
  queue.delete(follow.id);
  queue.set(follow.id, { ...follow, op, at });
}

export function clearPendingMusic(): void {
  queue.clear();
}

/** 拿最新的共用清单对一遍：已经生效的待办就划掉 */
export function settleMusic(follows: SharedFollow[]): void {
  const ids = new Set(follows.map((f) => f.id));
  queue.forEach((p, id) => {
    const present = ids.has(id);
    if ((p.op === 'add' && present) || (p.op === 'rm' && !present))
      queue.delete(id);
  });
}
