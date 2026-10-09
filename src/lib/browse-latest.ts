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
  vod_hits?: number | string;
  vod_hits_day?: number | string;
  vod_hits_week?: number | string;
  vod_hits_month?: number | string;
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
  /** 热门榜才有：这个月的点击数 */
  hits?: number;
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

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * 这个来源的点击数可不可信。
 * 很多来源的点击数是随机填的：总点击、月、周、日四个数字各自乱数，会出现
 * 「本周点击比总点击还多」这种不可能的情况。真的计数器一定是 日 ≤ 周 ≤ 月 ≤ 总。
 * 九成以上的片符合这个关系才算可信。
 */
export function hitsLookReal(list: LatestRaw[]): boolean {
  const withHits = list.filter((x) => num(x.vod_hits) > 0);
  if (withHits.length < 5) return false;
  const consistent = withHits.filter((x) => {
    const total = num(x.vod_hits);
    const month = num(x.vod_hits_month);
    const week = num(x.vod_hits_week);
    const day = num(x.vod_hits_day);
    return day <= week && week <= month && month <= total;
  });
  return consistent.length / withHits.length >= 0.9;
}

/**
 * 热门榜：只用点击数可信的来源，按本月点击数排。
 * 没有任何来源可信时回空阵列（宁可不显示，也不要拿乱数排名）。
 */
export function mergeHot(
  batches: { source: string; source_name: string; list: LatestRaw[] }[],
  limit = 40
): LatestItem[] {
  const byTitle = new Map<string, LatestItem>();
  for (const b of batches) {
    if (!hitsLookReal(b.list)) continue;
    for (const raw of b.list) {
      const title = raw.vod_name?.trim();
      const id = raw.vod_id?.toString();
      const hits = num(raw.vod_hits_month) || num(raw.vod_hits);
      if (!title || !id || hits <= 0) continue;
      const key = normTitle(title);
      const cur = byTitle.get(key);
      if (cur && (cur.hits ?? 0) >= hits) continue;
      byTitle.set(key, {
        id,
        title,
        poster: raw.vod_pic || '',
        year: raw.vod_year?.match(/\d{4}/)?.[0] || '',
        remarks: raw.vod_remarks || '',
        source: b.source,
        source_name: b.source_name,
        added: addedAt(raw),
        hits,
      });
    }
  }
  return Array.from(byTitle.values())
    .sort((a, b) => (b.hits ?? 0) - (a.hits ?? 0))
    .slice(0, limit);
}
