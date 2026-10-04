import { NextRequest, NextResponse } from 'next/server';

import { isValidSourceId } from '@/lib/ai-manju-sources';
import { listSource, VideoPage } from '@/lib/ai-manju-youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 单一来源的完整影片清单（可翻页）。
 * 首页的总列表走 RSS，每个来源只有最新 15 支；点进某个频道时改用这支。
 */
const FRESH_MS = 30 * 60 * 1000;
const cache = new Map<string, { page: VideoPage; at: number }>();

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get('type') === 'playlist' ? 'playlist' : 'channel';
  const id = sp.get('id') ?? '';
  const name = (sp.get('name') ?? '').slice(0, 80);
  const cont = sp.get('cont') ?? undefined;
  if (!isValidSourceId(type, id) || (cont && cont.length > 20000)) {
    return NextResponse.json({ error: '参数不正确' }, { status: 400 });
  }

  const key = `${type}:${id}:${cont ?? ''}`;
  try {
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      hit = { page: await listSource(type, id, name, cont), at: Date.now() };
      cache.set(key, hit);
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    }
    return NextResponse.json(hit.page, {
      headers: { 'Cache-Control': 'private, max-age=600' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `读不到频道影片：${(e as Error).message}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
