import { NextRequest, NextResponse } from 'next/server';

import { isValidSourceId } from '@/lib/ai-manju-sources';
import { type YtVideo,listPopular } from '@/lib/ai-manju-youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 单一频道观看数最高的 20 支。前端一个频道一排、卷到才来要，
 * 所以这里一次只处理一个频道。热门排序变动很慢，12 小时抓一次。
 */
const LIMIT = 20;
const FRESH_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { videos: YtVideo[]; at: number }>();
const inflight = new Map<string, Promise<YtVideo[]>>();

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!isValidSourceId('channel', id)) {
    return NextResponse.json({ error: '参数不正确' }, { status: 400 });
  }

  let hit = cache.get(id);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      let p = inflight.get(id);
      if (!p) {
        p = listPopular(id, LIMIT).finally(() => inflight.delete(id));
        inflight.set(id, p);
      }
      hit = { videos: await p, at: Date.now() };
      cache.set(id, hit);
      if (cache.size > 400) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      // 一时抓不到就沿用旧的；连旧的都没有才报错
      if (!hit) {
        return NextResponse.json(
          { error: `读不到频道热门：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { videos: hit.videos },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  );
}
