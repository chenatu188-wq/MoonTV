/**
 * TikTok 漫剧上方的「新片榜」：各帐号最新一支，以及近期最多人看的。纯函数。
 */
import { seriesNameOf } from '@/lib/ai-manju-series';
import { toSimplifiedFull } from '@/lib/t2s-table';

export interface TiktokLike {
  id: string;
  handle: string;
  title: string;
  /** Unix 秒 */
  published: number;
  views: number | null;
}

export interface TiktokHotItem<T> {
  video: T;
  /** 认得出剧名就用剧名，否则 null（显示时用影片标题） */
  series: string | null;
  views: number;
  count: number;
}

/** 每个帐号各取最新的一支，新的排前面 */
export function latestPerAccount<T extends TiktokLike>(videos: T[]): T[] {
  const newest = new Map<string, T>();
  for (const v of videos) {
    const cur = newest.get(v.handle);
    if (!cur || v.published > cur.published) newest.set(v.handle, v);
  }
  return Array.from(newest.values()).sort((a, b) => b.published - a.published);
}

/**
 * 按观看数排名。同一个帐号发的同一部剧（连载）并成一格，免得一部剧洗满榜单。
 * @param days 只算最近几天发布的；null = 不限
 */
export function hotTiktok<T extends TiktokLike>(
  videos: T[],
  days: number | null,
  limit = 30,
  now = Date.now()
): TiktokHotItem<T>[] {
  const groups = new Map<string, TiktokHotItem<T>>();
  for (const v of videos) {
    if (v.views == null || v.views <= 0) continue;
    if (days !== null && now - v.published * 1000 > days * 86400000) continue;

    const series = seriesNameOf(v.title);
    const key = series
      ? `s:${v.handle}:${toSimplifiedFull(series)}`
      : `v:${v.id}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { video: v, series, views: v.views, count: 1 });
      continue;
    }
    g.views += v.views;
    g.count += 1;
    if (v.views > (g.video.views ?? 0)) g.video = v;
  }
  return Array.from(groups.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}
