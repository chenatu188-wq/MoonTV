import { NextResponse } from 'next/server';

import { toSimplified } from '@/lib/cn-converter';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

const ADULT_QUERY_PATTERNS: RegExp[] = [
  /\b(?:SSIS|IPX|MIDE|JUQ|ABP|MIAA|STARS|PRED|ADN|MIDV|MEYD|SNIS|SAME)\b/i,
  /\b[a-z]{2,6}[-_ ]?\d{2,5}\b/i,
  /无码av|無碼|有码|自拍偷拍|人妻|巨乳|爆乳|做爱|做愛|性奴|乱伦|淫|AV片|成人|porn|jav/i,
];

const ADULT_RESULT_PATTERNS: RegExp[] = [
  /无码av|無碼|有码|自拍偷拍|人妻|巨乳|爆乳|做爱|做愛|性奴|乱伦|淫|AV片|成人|porn|jav/i,
];

function isAdultLikeQuery(query: string): boolean {
  const q = query.trim();
  return ADULT_QUERY_PATTERNS.some((p) => p.test(q));
}

function isAdultLikeResult(input: { title?: string; desc?: string }): boolean {
  const text = `${input.title || ''} ${input.desc || ''}`;
  return ADULT_RESULT_PATTERNS.some((p) => p.test(text));
}

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

  // 外層搜尋硬擋成人向查詢
  if (isAdultLikeQuery(query)) {
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
      .filter((r) => {
        const key = `${r.source}|${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((r) => !isAdultLikeResult({ title: r.title, desc: r.desc }));
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      { results: dedupedResults },
      { headers: { 'Cache-Control': `public, max-age=${cacheTime}` } }
    );
  } catch {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
