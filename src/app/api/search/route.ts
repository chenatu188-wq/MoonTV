import { NextResponse } from 'next/server';

import { toSimplified } from '@/lib/cn-converter';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { toJapanese } from '@/lib/jp-converter';

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
  const simplifiedQuery = toSimplified(query);
  // 部分採集站用日文新字體儲存日本演員名 / 片名（三上悠亜 / 吉沢明歩）
  // 把繁體再轉一份日文版，三路一起搜
  const japaneseQuery = toJapanese(query);

  // 番號（如 SSIS-001 / ABP-456）拆解：原文命中率低時，再用片商代號（前綴）多搜一次提升命中率
  // 規則：2-5 個英文字母 + 連字 + 數字 → 額外加搜「英文字母前綴」
  const codeMatch = simplifiedQuery.match(/^([A-Za-z]{2,5})[-_ ]?(\d+)$/);
  const extraQueries: string[] = [];
  if (
    codeMatch &&
    codeMatch[1].toUpperCase() !== simplifiedQuery.toUpperCase()
  ) {
    extraQueries.push(codeMatch[1].toUpperCase());
  }

  // 收集所有要搜的 query，去重（簡體和日文常常一樣，避免重複請求）
  const querySet = new Set<string>();
  querySet.add(simplifiedQuery);
  if (japaneseQuery !== simplifiedQuery) querySet.add(japaneseQuery);
  extraQueries.forEach((q) => querySet.add(q));

  const apiSites = await getAvailableApiSites();
  const allQueries = Array.from(querySet);
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
