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
