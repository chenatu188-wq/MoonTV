import { NextRequest, NextResponse } from 'next/server';

import { isValidSourceId } from '@/lib/ai-manju-sources';
import { type YtVideo, listPopular } from '@/lib/ai-manju-youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 单一频道观看数最高的影片，一次给 20 支。前端一个频道一排、卷到才来要，
 * 所以这里一次只处理一个频道。热门排序变动很慢，12 小时抓一次。
 * ?page=0 是前 20 名；按「换一批」才带 page=1、2…，这时才往下多抓到 100 名，
 * 平常开页不用多打 YouTube。
 */
const PAGE_SIZE = 20;
const POOL = 100;
const FRESH_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { videos: YtVideo[]; at: number }>();
const inflight = new Map<string, Promise<YtVideo[]>>();

async function popular(id: string, limit: number): Promise<YtVideo[]> {
  const key = `${id}:${limit}`;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      let p = inflight.get(key);
      if (!p) {
        p = listPopular(id, limit).finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      hit = { videos: await p, at: Date.now() };
      cache.set(key, hit);
      if (cache.size > 400) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      // 一时抓不到就沿用旧的；连旧的都没有才报错
      if (!hit) throw e;
    }
  }
  return hit.videos;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!isValidSourceId('channel', id)) {
    return NextResponse.json({ error: '参数不正确' }, { status: 400 });
  }
  const page = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get('page')) || 0, 0),
    POOL / PAGE_SIZE - 1
  );

  let videos: YtVideo[];
  try {
    videos = await popular(id, page === 0 ? PAGE_SIZE : POOL);
  } catch (e) {
    return NextResponse.json(
      { error: `读不到频道热门：${(e as Error).message}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  // 第 0 页只抓了 20 支，还不知道总共几页；pages 只有翻过页才准
  const pages = page === 0 ? null : Math.ceil(videos.length / PAGE_SIZE);
  return NextResponse.json(
    {
      videos: videos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
      page,
      pages,
    },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  );
}
