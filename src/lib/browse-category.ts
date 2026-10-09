export type UpstreamCategory = {
  type_id: number;
  type_name: string;
};

export function matchCategories(
  categories: UpstreamCategory[],
  keywords: string[]
) {
  const matched: UpstreamCategory[] = [];
  const seen = new Set<number>();

  for (const keyword of keywords) {
    const category = categories.find((item) =>
      item.type_name.includes(keyword)
    );
    if (category && !seen.has(category.type_id)) {
      seen.add(category.type_id);
      matched.push(category);
    }
  }

  return matched;
}

export async function firstNonEmpty<TCandidate, TResult>(
  candidates: TCandidate[],
  load: (candidate: TCandidate) => Promise<TResult[]>
) {
  let lastResult: TResult[] = [];

  for (const candidate of candidates) {
    lastResult = await load(candidate);
    if (lastResult.length > 0) {
      return { candidate, result: lastResult };
    }
  }

  return { candidate: null, result: lastResult };
}

export const ANIME_3D_KEYWORDS = ['3D动漫', '3D動畫', '动漫', '動畫', '动画'];
export const ANIME_3D_REGION_KEYWORDS: Record<string, string[]> = {
  '3D動漫-中國': [
    '3D动漫',
    '3D動畫',
    '中国动漫',
    '国产动漫',
    '國產動漫',
    '动漫',
    '動畫',
    '动画',
  ],
  '3D動漫-日本': [
    '3D动漫',
    '3D動畫',
    '日本动漫',
    '日韩动漫',
    '日韓動漫',
    '动漫',
    '動畫',
    '动画',
  ],
  '3D動漫-歐美': [
    '3D动漫',
    '3D動畫',
    '欧美动漫',
    '歐美動漫',
    '海外动漫',
    '动漫',
    '動畫',
    '动画',
  ],
};

/**
 * 分区榜单（最新上架榜／热门榜）用的设定。
 * 关键字跟 api/browse/route.ts 里各分区的是同一套；那边两个分支写法不同所以没有共用，
 * 改关键字时两边要一起改。
 */
export interface BrowseRankConfig {
  /** 这个分区的来源属于哪个群组 */
  matchGroup: (group: string) => boolean;
  /** 挑上游分类用的关键字 */
  keywords: (group: string) => string[];
}

export const BROWSE_RANK_CONFIG: Record<string, BrowseRankConfig> = {
  movie: {
    matchGroup: (g) => g === '電影',
    keywords: () => [
      '电影片',
      '电影',
      '電影',
      '动作片',
      '剧情片',
      '劇情片',
      '科幻片',
      '喜剧片',
    ],
  },
  hollywood: {
    matchGroup: (g) => g === '好萊塢',
    keywords: () => [
      '欧美电影',
      '科幻片',
      '动作片',
      '战争片',
      '喜剧片',
      '剧情片',
      '电影',
      '電影',
    ],
  },
  duanju: {
    matchGroup: (g) => g === '短劇',
    keywords: () => ['短剧', '短劇'],
  },
  tv: {
    matchGroup: (g) => g === '電視劇',
    keywords: () => [
      '国产剧',
      '大陆剧',
      '电视剧',
      '連續劇',
      '连续剧',
      '欧美剧',
      '美国剧',
      '香港剧',
      '台湾剧',
      '韩剧',
      '韩国剧',
      '日剧',
      '日本剧',
    ],
  },
  tv_korean: {
    matchGroup: (g) => g === '電視劇',
    keywords: () => ['韩剧', '韩国剧', '韓劇', '韓國劇'],
  },
  anime3d: {
    matchGroup: (g) => g.startsWith('3D動漫'),
    keywords: (g) => ANIME_3D_REGION_KEYWORDS[g] || ANIME_3D_KEYWORDS,
  },
};
