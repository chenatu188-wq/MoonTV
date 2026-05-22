import { NextResponse } from 'next/server';

import { API_CONFIG, getAvailableApiSites, getCacheTime } from '@/lib/config';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const year = searchParams.get('year') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const sites = await getAvailableApiSites();
  const site = sourceKey
    ? sites.find((s) => s.key === sourceKey)
    : sites.find((s) => s.group === '短劇');
  if (!site)
    return NextResponse.json({ error: 'source not found' }, { status: 404 });

  try {
    // Step 1: get category list to find 短剧 type_id
    const listResp = await fetch(`${site.api}?ac=list`, {
      headers: API_CONFIG.search.headers,
    });
    const listData = await listResp.json();
    const cats: Array<{ type_id: number; type_name: string }> =
      listData.class || [];
    const djCat = cats.find(
      (c) => c.type_name.includes('短剧') || c.type_name.includes('短劇')
    );
    if (!djCat)
      return NextResponse.json({ results: [], total: 0, pagecount: 0 });

    // Step 2: browse by type + year + page
    const yearParam = year ? `&y=${year}` : '';
    const browseUrl = `${site.api}?ac=videolist&t=${djCat.type_id}${yearParam}&pg=${page}`;
    const browseResp = await fetch(browseUrl, {
      headers: API_CONFIG.search.headers,
    });
    const data = await browseResp.json();

    const cacheTime = await getCacheTime();
    return NextResponse.json(
      {
        results: (data.list || []).map(
          (item: {
            vod_id?: unknown;
            vod_name?: string;
            vod_pic?: string;
            vod_year?: string;
            vod_remarks?: string;
            vod_douban_score?: number;
            vod_score?: number;
          }) => ({
            id: item.vod_id?.toString(),
            title: item.vod_name?.trim(),
            poster: item.vod_pic,
            year: item.vod_year?.match(/\d{4}/)?.[0] || '',
            remarks: item.vod_remarks || '',
            score: (() => {
              const ds = item.vod_douban_score ?? 0;
              const ss = item.vod_score ?? 0;
              return ds > 0 ? ds : ss > 0 ? ss : undefined;
            })(),
            source: site.key,
            source_name: site.name,
            episodes: [],
          })
        ),
        total: data.total || 0,
        pagecount: data.pagecount || 1,
        source_name: site.name,
        source_key: site.key,
      },
      { headers: { 'Cache-Control': `public, max-age=${cacheTime}` } }
    );
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
