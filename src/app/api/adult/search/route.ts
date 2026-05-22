import { NextResponse } from 'next/server';

import { toSimplified } from '@/lib/cn-converter';
import { getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

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

  const simplifiedQuery = toSimplified(query);

  const searchPromises = adultSites.map((site) =>
    searchFromApi(site, simplifiedQuery)
  );

  try {
    const results = await Promise.all(searchPromises);
    const seen = new Set<string>();
    const dedupedResults = results.flat().filter((r) => {
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
