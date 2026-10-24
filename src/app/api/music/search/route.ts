import { NextRequest, NextResponse } from 'next/server';

import { searchAll, YtVideo } from '@/lib/ai-manju-youtube';
import { rankMusic } from '@/lib/music-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 同一个关键字短时间内结果不会变，缓存半小时 */
const FRESH_MS = 30 * 60 * 1000;
const cache = new Map<string, { videos: YtVideo[]; at: number }>();

/** 音乐分区的 YouTube 搜寻：以音乐为主（见 rankMusic） */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 80) {
    return NextResponse.json(
      { error: '请输入要搜寻的歌名或歌手' },
      { status: 400 }
    );
  }
  try {
    let hit = cache.get(q);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      const [plain, music] = await Promise.all([
        searchAll(q),
        searchAll(`${q} 歌曲`).catch(() => [] as YtVideo[]),
      ]);
      hit = { videos: rankMusic(plain, music), at: Date.now() };
      cache.set(q, hit);
      if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    }
    return NextResponse.json(
      { q, videos: hit.videos },
      { headers: { 'Cache-Control': 'private, max-age=600' } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: `搜寻失败：${(e as Error).message}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
