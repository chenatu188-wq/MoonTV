/**
 * AI 漫剧「播完自动接下一集」：从搜寻结果挑出同一个频道、同一部剧的下一集。纯函数。
 */
import { episodeOf, seasonOf } from '@/lib/ai-manju-series';
import type { SearchHit } from '@/lib/ai-manju-series-follow';

export const AUTO_NEXT_KEY = 'moontv_ai_manju_auto_next';

const channelOf = (url: string) =>
  /\/channel\/(UC[\w-]{22})/.exec(url)?.[1] ?? url;

/**
 * 现在播的这集（看标题）的下一集：同频道、片名吻合、同一季里集数比现在大的最小那集
 * （中间缺集就跳到有的那集）；这季没有了就接下一季最前面那集。找不到回 null。
 */
export function nextEpisodeOf(
  current: { videoId: string; title: string; channelUrl: string },
  hits: SearchHit[]
): SearchHit | null {
  const ep = episodeOf(current.title);
  if (ep === null) return null;
  const season = seasonOf(current.title) ?? 1;
  const channel = channelOf(current.channelUrl);
  const pool = hits.filter(
    (h) =>
      h.match &&
      h.episode !== null &&
      h.videoId !== current.videoId &&
      channelOf(h.channelUrl) === channel
  );
  const pick = (list: SearchHit[]) =>
    list.reduce<SearchHit | null>(
      (best, h) =>
        !best ||
        (h.season ?? 1) < (best.season ?? 1) ||
        ((h.season ?? 1) === (best.season ?? 1) &&
          (h.episode as number) < (best.episode as number))
          ? h
          : best,
      null
    );
  return (
    pick(
      pool.filter(
        (h) => (h.season ?? 1) === season && (h.episode as number) > ep
      )
    ) ?? pick(pool.filter((h) => (h.season ?? 1) > season))
  );
}
