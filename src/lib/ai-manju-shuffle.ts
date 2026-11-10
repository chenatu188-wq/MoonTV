/**
 * AI 漫剧播放器「像滑抖音一样」往上滑换一部：从现有影片里随机挑，
 * 最近看过的先跳过；全部都看过就只排除正在播的那支。
 */
export const SHUFFLE_RECENT = 50;

export function pickRandom<T extends { videoId: string }>(
  pool: T[],
  recent: string[],
  current: string | null,
  rand: () => number = Math.random
): T | null {
  const seen = new Set(recent.slice(-SHUFFLE_RECENT));
  let cands = pool.filter((v) => v.videoId !== current && !seen.has(v.videoId));
  if (!cands.length) cands = pool.filter((v) => v.videoId !== current);
  if (!cands.length) return null;
  return cands[Math.floor(rand() * cands.length)] ?? null;
}

/** 手指在画面上滑动：往上滑（像抖音）→ 'next'，往下滑 → 'prev'，不够明显 → null */
export function swipeOf(
  dx: number,
  dy: number,
  min = 60
): 'next' | 'prev' | null {
  if (Math.abs(dy) < min || Math.abs(dy) < Math.abs(dx) * 1.5) return null;
  return dy < 0 ? 'next' : 'prev';
}
