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
