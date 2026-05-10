import { NextResponse } from 'next/server';

import { toSimplified } from '@/lib/cn-converter';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  }

  // 中國採集站標題以簡體儲存，把繁體查詢轉成簡體再搜，台灣使用者打繁體也搜得到
  const searchQuery = toSimplified(query);

  // 番號（如 SSIS-001 / ABP-456）拆解：原文命中率低時，再用片商代號（前綴）多搜一次提升命中率
  // 規則：2-5 個英文字母 + 連字 + 數字 → 額外加搜「英文字母前綴」
  const codeMatch = searchQuery.match(/^([A-Za-z]{2,5})[-_ ]?(\d+)$/);
  const extraQueries: string[] = [];
  if (codeMatch && codeMatch[1].toUpperCase() !== searchQuery.toUpperCase()) {
    extraQueries.push(codeMatch[1].toUpperCase());
  }

  const apiSites = await getAvailableApiSites();
  const allQueries = [searchQuery, ...extraQueries];
  const searchPromises = apiSites.flatMap((site) =>
    allQueries.map((q) => searchFromApi(site, q))
  );

  try {
    const results = await Promise.all(searchPromises);
    const flattenedResults = results.flat();
    // 番號搜尋會跨多個 query 命中同一影片，依 source+id 去重
    const seen = new Set<string>();
    const dedupedResults = flattenedResults.filter((r) => {
      const key = `${r.source}|${r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      { results: dedupedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
