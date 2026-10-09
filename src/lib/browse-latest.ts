/**
 * 分区的「最新上架榜」：把各来源最近更新的片合起来，按上架时间排。纯函数，方便测试。
 */

export interface LatestRaw {
  vod_id?: unknown;
  vod_name?: string;
  vod_pic?: string;
  vod_year?: string;
  vod_remarks?: string;
  /** 最后更新时间，「2026-10-09 11:52:03」 */
  vod_time?: string;
  /** 上架时间，Unix 秒 */
  vod_time_add?: number | string;
}

export interface LatestItem {
  id: string;
  title: string;
  poster: string;
  year: string;
  remarks: string;
  source: string;
  source_name: string;
  /** 上架时间，Unix 秒 */
  added: number;
}

/** 上游分类名里有这些字的不碰（魔都有「里番动漫」这种成人分类） */
const ADULT_CATEGORY_RE = /里番|伦理|倫理|福利|成人|情色|18禁/;
export const isAdultCategoryName = (name: string) =>
  ADULT_CATEGORY_RE.test(name);

/** 上架时间；来源没给就退回用最后更新时间。都没有回 0 */
export function addedAt(item: LatestRaw): number {
  const add = Number(item.vod_time_add);
  if (Number.isFinite(add) && add > 0) return Math.floor(add);
  if (item.vod_time) {
    // 来源给的是北京时间
    const t = Date.parse(`${item.vod_time.replace(' ', 'T')}+08:00`);
    if (!Number.isNaN(t)) return Math.floor(t / 1000);
  }
  return 0;
}

const normTitle = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * @param batches 每个来源抓回来的清单
 * @param now Unix 秒；上架时间在未来的（来源乱填）不要
 */
export function mergeLatest(
  batches: { source: string; source_name: string; list: LatestRaw[] }[],
  limit = 40,
  now = Math.floor(Date.now() / 1000)
): LatestItem[] {
  const byTitle = new Map<string, LatestItem>();
  for (const b of batches) {
    for (const raw of b.list) {
      const title = raw.vod_name?.trim();
      const id = raw.vod_id?.toString();
      const added = addedAt(raw);
      if (!title || !id || added <= 0 || added > now + 86400) continue;
      const key = normTitle(title);
      const cur = byTitle.get(key);
      // 同一部片多个来源都有：只留一格，上架时间取最早的（那才是真正的上架日）
      if (cur) {
        if (added < cur.added) cur.added = added;
        continue;
      }
      byTitle.set(key, {
        id,
        title,
        poster: raw.vod_pic || '',
        year: raw.vod_year?.match(/\d{4}/)?.[0] || '',
        remarks: raw.vod_remarks || '',
        source: b.source,
        source_name: b.source_name,
        added,
      });
    }
  }
  return Array.from(byTitle.values())
    .sort((a, b) => b.added - a.added)
    .slice(0, limit);
}
