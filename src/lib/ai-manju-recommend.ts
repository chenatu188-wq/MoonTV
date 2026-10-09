/**
 * 推荐榜：从 YouTube 搜寻结果里挑出「还没追踪的频道」发的漫剧，一个频道一支。纯函数。
 */
import type { YtVideo } from '@/lib/ai-manju-youtube';

/** 太短的多半是预告、切片，不值得为它追踪一个频道 */
const MIN_SECONDS = 5 * 60;

/**
 * @param batches 每组关键字各自的搜寻结果（顺序就是 YouTube 排的相关度）
 * @param tracked 已追踪的频道 ID
 */
export function pickRecommended(
  batches: YtVideo[][],
  tracked: Iterable<string>,
  limit = 40
): YtVideo[] {
  const skip = new Set(tracked);
  const byChannel = new Map<
    string,
    { video: YtVideo; hits: number; order: number }
  >();
  let order = 0;

  for (const batch of batches) {
    const seenInBatch = new Set<string>();
    for (const v of batch) {
      order += 1;
      if (!v.channelId || skip.has(v.channelId)) continue;
      if (v.seconds < MIN_SECONDS) continue;
      const cur = byChannel.get(v.channelId);
      if (!cur) {
        byChannel.set(v.channelId, { video: v, hits: 1, order });
        seenInBatch.add(v.channelId);
        continue;
      }
      // 同一个频道在越多组关键字里出现，越可能是专门做漫剧的频道
      if (!seenInBatch.has(v.channelId)) {
        cur.hits += 1;
        seenInBatch.add(v.channelId);
      }
      // 代表影片取片长最长的（比较可能是全集）
      if (v.seconds > cur.video.seconds) cur.video = v;
    }
  }

  return Array.from(byChannel.values())
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.video);
}
