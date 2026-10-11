import { NextRequest, NextResponse } from 'next/server';

import {
  type HongguoSearchItem,
  cleanHongguoQuery,
  parseHongguoSearch,
} from '@/lib/hongguo-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 用红果官网的搜寻把「口令／关键字」换成剧名。
 * 官网只有片单、不能播放，查到剧名后前端再拿去 YouTube 找。
 */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const FRESH_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { items: HongguoSearchItem[]; at: number }>();

export async function GET(request: NextRequest) {
  const q = cleanHongguoQuery(request.nextUrl.searchParams.get('q'));
  if (!q) {
    return NextResponse.json({ error: '请输入口令或关键字' }, { status: 400 });
  }

  let hit = cache.get(q);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      const res = await fetch(
        `https://hongguoduanju.com/search/${encodeURIComponent(q)}`,
        {
          headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
          signal: AbortSignal.timeout(15000),
          cache: 'no-store',
        }
      );
      if (!res.ok) throw new Error(`红果回应 HTTP ${res.status}`);
      hit = { items: parseHongguoSearch(await res.text()), at: Date.now() };
      cache.set(q, hit);
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      // 一时抓不到就沿用旧的；连旧的都没有才报错
      if (!hit) {
        return NextResponse.json(
          { error: `红果搜寻失败：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { q, items: hit.items },
    { headers: { 'Cache-Control': 'private, max-age=1800' } }
  );
}
