import { NextResponse } from 'next/server';

import { expandCdramaSearchQueries } from '@/lib/cdrama-aliases';
import {
  getAvailableApiSites,
  getCacheTime,
  hasAdultKeyword,
  isFamilyApiSite,
} from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      { headers: { 'Cache-Control': `public, max-age=${cacheTime}` } }
    );
  }
  if (hasAdultKeyword([query])) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      { headers: { 'Cache-Control': `public, max-age=${cacheTime}` } }
    );
  }

  // 陸劇別名詞庫展開：繁簡 / 英文名 / 常見別名一起搜
  const expandedQueries = expandCdramaSearchQueries(query);

  const apiSites = await getAvailableApiSites();
  const searchPromises = expandedQueries.flatMap((q) =>
    apiSites.map((site) => searchFromApi(site, q))
  );

  try {
    const seen = new Set<string>();
    const dedupedResults = (await Promise.all(searchPromises))
      .flat()
      .filter((r) =>
        isFamilyApiSite({
          key: r.source,
          name: r.source_name,
          group: r.source_group,
        })
      )
      .filter(
        (r) =>
          !hasAdultKeyword([
            r.title,
            r.source_name,
            r.source_group,
            r.class,
            r.type_name,
            r.desc,
          ])
      )
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
