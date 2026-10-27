import type { AiManjuVideo } from '@/lib/ai-manju-feed';

/** 各频道热门那一排的排法：hot＝YouTube 的热门顺序，long＝片长由长到短，date＝由新到旧 */
export type TopSort = 'hot' | 'long' | 'date';

/** 从 meta（例：「1:08:35 · 3 個月前 · 觀看次數：7091次」）读出片长秒数；读不到回 -1 */
export function durationOf(v: Pick<AiManjuVideo, 'meta'>): number {
  const m = (v.meta ?? '').match(
    /(?:^|·\s*)(\d{1,3}(?::\d{2}){1,2})(?:\s*·|$)/
  );
  if (!m) return -1;
  return m[1].split(':').reduce((s, n) => s * 60 + Number(n), 0);
}

/** 排序不改原阵列；分不出先后的维持热门顺序 */
export function sortTop<T extends AiManjuVideo>(list: T[], by: TopSort): T[] {
  if (by === 'hot') return list;
  const key = (v: T) =>
    by === 'long' ? durationOf(v) : Date.parse(v.published) || 0;
  return list
    .map((v, i) => ({ v, i, k: key(v) }))
    .sort((a, b) => b.k - a.k || a.i - b.i)
    .map((x) => x.v);
}
