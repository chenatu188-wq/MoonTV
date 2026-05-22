import { NextResponse } from 'next/server';

import { toSimplified } from '@/lib/cn-converter';
import { getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { toJapanese } from '@/lib/jp-converter';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) return NextResponse.json({ results: [] });

  const config = await getConfig();
  const adultSites = (config.SourceConfig || [])
    .filter((s) => !s.disabled && s.group === '🔞')
    .map((s) => ({ key: s.key, name: s.name, api: s.api, detail: s.detail }));

  if (adultSites.length === 0) return NextResponse.json({ results: [] });

  // 繁體 → 簡體（大陸採集站以簡體儲存）
  const simplifiedQuery = toSimplified(query);
  // 部分採集站用日文新字體儲存演員名（三上悠亜 / 吉沢明歩）
  const japaneseQuery = toJapanese(query);

  // 番號（SSIS-001 / ABP-456）：額外加搜片商前綴提升命中率
  const codeMatch = simplifiedQuery.match(/^([A-Za-z]{2,5})[-_ ]?(\d+)$/);
  const extraQueries: string[] = [];
  if (
    codeMatch &&
    codeMatch[1].toUpperCase() !== simplifiedQuery.toUpperCase()
  ) {
    extraQueries.push(codeMatch[1].toUpperCase());
  }

  const querySet = new Set<string>();
  querySet.add(simplifiedQuery);
  if (japaneseQuery !== simplifiedQuery) querySet.add(japaneseQuery);
  extraQueries.forEach((q) => querySet.add(q));

  const allQueries = Array.from(querySet);
  const searchPromises = adultSites.flatMap((site) =>
    allQueries.map((q) => searchFromApi(site, q))
  );

  try {
    const seen = new Set<string>();
    const dedupedResults = (await Promise.all(searchPromises))
      .flat()
      .filter((r) => {
        const key = `${r.source}|${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: dedupedResults },
      { headers: { 'Cache-Control': `public, max-age=${cacheTime}` } }
    );
  } catch {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
