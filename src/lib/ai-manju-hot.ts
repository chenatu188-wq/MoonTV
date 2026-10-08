/**
 * 追踪频道热播榜：从已经抓回来的影片里，按观看数排出近期最多人看的剧。纯函数，前端直接用。
 * 同一部剧（标题认得出剧名的）合并成一格，免得一部连载剧把整个榜单洗满。
 */
import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { seriesNameOf } from '@/lib/ai-manju-series';
import { toSimplifiedFull } from '@/lib/t2s-table';

export interface HotItem {
  /** 剧名；标题认不出剧名时为 null，显示时用影片标题 */
  series: string | null;
  /** 这部剧里观看数最高的那支，点了就播它 */
  video: AiManjuVideo;
  /** 榜单期间内这部剧所有影片的观看数总和 */
  views: number;
  /** 榜单期间内这部剧有几支影片 */
  count: number;
}

const DAY_MS = 86400000;

/**
 * @param days 只算最近几天发布的影片；null = 不限
 */
export function hotRank(
  videos: AiManjuVideo[],
  days: number | null,
  limit = 30,
  now = Date.now()
): HotItem[] {
  const groups = new Map<string, HotItem>();

  for (const v of videos) {
    if (v.views == null || v.views <= 0) continue;
    if (days !== null) {
      const age = now - new Date(v.published).getTime();
      if (Number.isNaN(age) || age > days * DAY_MS) continue;
    }

    const series = seriesNameOf(v.title);
    // 繁简写法不同的同一部剧要并在一起
    const key = series ? `s:${toSimplifiedFull(series)}` : `v:${v.videoId}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { series, video: v, views: v.views, count: 1 });
      continue;
    }
    // 同一支影片可能同时出现在频道和播放清单两个来源，只算一次
    if (g.video.videoId === v.videoId) continue;
    g.views += v.views;
    g.count += 1;
    if (v.views > (g.video.views ?? 0)) g.video = v;
  }

  return Array.from(groups.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/** 每个来源（频道／播放清单）各取最新的一支，新的排前面 */
export function latestPerSource(videos: AiManjuVideo[]): AiManjuVideo[] {
  const newest = new Map<string, AiManjuVideo>();
  const seen = new Set<string>();
  const time = (v: AiManjuVideo) => new Date(v.published).getTime() || 0;

  for (const v of videos) {
    const cur = newest.get(v.sourceKey);
    if (!cur || time(v) > time(cur)) newest.set(v.sourceKey, v);
  }

  return Array.from(newest.values())
    .sort((a, b) => time(b) - time(a))
    .filter((v) => {
      // 同一支影片同时是两个来源的最新一支时只留一格
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });
}
