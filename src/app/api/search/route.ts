import { NextResponse } from 'next/server';

import { toSimplified } from '@/lib/cn-converter';
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

  // 中國採集站標題以簡體儲存，把繁體查詢轉成簡體再搜
  const simplifiedQuery = toSimplified(query);

  const apiSites = await getAvailableApiSites();
  const searchPromises = apiSites.map((site) =>
    searchFromApi(site, simplifiedQuery)
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
