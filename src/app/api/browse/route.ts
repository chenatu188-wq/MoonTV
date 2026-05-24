import { NextResponse } from 'next/server';

import { API_CONFIG, getAvailableApiSites, getCacheTime } from '@/lib/config';

export const runtime = 'edge';

const TV_KEYWORDS = ['电视剧', '連續劇', '连续剧'];
const DJ_KEYWORDS = ['短剧', '短劇'];

function matchCat(
  cats: Array<{ type_id: number; type_name: string }>,
  keywords: string[]
) {
  for (const kw of keywords) {
    const c = cats.find((c) => c.type_name.includes(kw));
    if (c) return c;
  }
  return null;
}

type RawItem = {
  vod_id?: unknown;
  vod_name?: string;
  vod_pic?: string;
  vod_year?: string;
  vod_remarks?: string;
  vod_douban_score?: number;
  vod_score?: number;
};

function mapItems(list: RawItem[], siteKey: string, siteName: string) {
  const mapped = list.map((item) => {
    const ds = item.vod_douban_score ?? 0;
    const ss = item.vod_score ?? 0;
    return {
      id: item.vod_id?.toString(),
      title: item.vod_name?.trim(),
      poster: item.vod_pic,
      year: item.vod_year?.match(/\d{4}/)?.[0] || '',
      remarks: item.vod_remarks || '',
      score: ds > 0 ? ds : ss > 0 ? ss : undefined,
      source: siteKey,
      source_name: siteName,
      episodes: [],
    };
  });
  mapped.sort(
    (
      a: { score?: number; year?: string },
      b: { score?: number; year?: string }
    ) => {
      const as = a.score ?? 0;
      const bs = b.score ?? 0;
      if (bs !== as) return bs - as;
      return (b.year ?? '') > (a.year ?? '') ? 1 : -1;
    }
  );
  return mapped;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const year = searchParams.get('year') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const category = searchParams.get('category') || 'duanju'; // duanju | tv | adult

  const sites = await getAvailableApiSites();
  const site = sites.find((s) => s.key === sourceKey);
  if (!site)
    return NextResponse.json({ error: 'source not found' }, { status: 404 });

  const yearParam = year ? `&y=${year}` : '';
  const cacheTime = await getCacheTime();

  try {
    let browseUrl: string;

    if (category === 'adult') {
      // Browse all content without type filtering
      browseUrl = `${site.api}?ac=videolist${yearParam}&pg=${page}`;
    } else {
      const keywords = category === 'tv' ? TV_KEYWORDS : DJ_KEYWORDS;
      const listResp = await fetch(`${site.api}?ac=list`, {
        headers: API_CONFIG.search.headers,
      });
      const listData = await listResp.json();
      const cats: Array<{ type_id: number; type_name: string }> =
        listData.class || [];
      const djCat = matchCat(cats, keywords);
      if (!djCat)
        return NextResponse.json({ results: [], total: 0, pagecount: 0 });
      browseUrl = `${site.api}?ac=videolist&t=${djCat.type_id}${yearParam}&pg=${page}`;
    }

    const browseResp = await fetch(browseUrl, {
      headers: API_CONFIG.search.headers,
    });
    const data = await browseResp.json();

    return NextResponse.json(
      {
        results: mapItems(data.list || [], site.key, site.name),
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
