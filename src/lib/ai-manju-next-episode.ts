/**
 * AI 漫剧「播完自动接下一集」：从搜寻结果挑出同一个频道、同一部剧的下一段。纯函数。
 * YouTube 上一支一集的很少，多数是「第1~50集」合集或一季一支，三种都认：
 * 单集接下一集、合集接下一段、整季接下一季。
 */
import { episodeOf, seasonOf } from '@/lib/ai-manju-series';
import type { SearchHit } from '@/lib/ai-manju-series-follow';

export const AUTO_NEXT_KEY = 'moontv_ai_manju_auto_next';

const channelOf = (url: string) =>
  /\/channel\/(UC[\w-]{22})/.exec(url)?.[1] ?? url;

/** 合集的集数范围：「第1~50集」「1-23合集」；「1-2季」不算 */
const RANGE_RE =
  /(第\s*)?(\d{1,4})\s*[~～\-—至到]\s*(\d{1,4})(?!\d)\s*(集|话|話|合集|全集)?/;

/** 这支影片是第几季的第几集到第几集；from/to 都是 null 表示整季（或看不出来） */
export interface EpisodeSpan {
  season: number;
  from: number | null;
  to: number | null;
  /** 标题有写季数 */
  hasSeason: boolean;
}

export function spanOf(title: string): EpisodeSpan {
  const s = seasonOf(title);
  const season = s ?? 1;
  const ep = episodeOf(title);
  if (ep !== null) return { season, from: ep, to: ep, hasSeason: s !== null };
  const m = RANGE_RE.exec(title);
  if (m && (m[1] || m[4])) {
    const from = Number(m[2]);
    const to = Number(m[3]);
    if (to > from) return { season, from, to, hasSeason: s !== null };
  }
  return { season, from: null, to: null, hasSeason: s !== null };
}

/** 按钮上显示：第 19 集／第 51~100 集／第 2 季 */
export function spanLabel(span: EpisodeSpan): string {
  if (span.from === null) return `第 ${span.season} 季`;
  if (span.from === span.to) return `第 ${span.from} 集`;
  return `第 ${span.from}~${span.to} 集`;
}

/** 这支之后要接的那支，搜寻时先直接搜这个（整部搜寻常常搜不到后面的集） */
export function nextQuery(series: string, title: string): string {
  const span = spanOf(title);
  return span.to !== null
    ? `${series} 第${span.to + 1}集`
    : `${series} 第${span.season + 1}季`;
}

/**
 * 现在播的这支的下一支，找不到回 null。只看同频道、片名吻合的：
 * - 有集数（单集或合集）：同一季里开头集数比现在结尾大的最小那支（缺集就跳到有的）；
 *   这季没有了就接下一季最前面那支
 * - 整季一支：下一季最前面那支
 */
export function nextEpisodeOf(
  current: { videoId: string; title: string; channelUrl: string },
  hits: SearchHit[]
): SearchHit | null {
  const cur = spanOf(current.title);
  const channel = channelOf(current.channelUrl);
  const pool = hits
    .filter(
      (h) =>
        h.match &&
        h.videoId !== current.videoId &&
        channelOf(h.channelUrl) === channel
    )
    .map((h) => ({ h, span: spanOf(h.title) }));
  const first = (list: typeof pool) =>
    list.reduce<(typeof pool)[number] | null>(
      (best, x) =>
        !best ||
        x.span.season < best.span.season ||
        (x.span.season === best.span.season &&
          (x.span.from ?? 0) < (best.span.from ?? 0))
          ? x
          : best,
      null
    )?.h ?? null;

  if (cur.to !== null) {
    const inSeason = pool.filter(
      (x) =>
        x.span.season === cur.season &&
        x.span.from !== null &&
        x.span.from > (cur.to as number)
    );
    if (inSeason.length) return first(inSeason);
  }
  // 下一季：要标题明写季数，免得把没写季数的第一季当成下一季
  return first(
    pool.filter((x) => x.span.hasSeason && x.span.season > cur.season)
  );
}
