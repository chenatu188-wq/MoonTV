import { NextRequest, NextResponse } from 'next/server';

import { searchAll, YtVideo } from '@/lib/ai-manju-youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 同一个关键字短时间内结果不会变，缓存半小时 */
const FRESH_MS = 30 * 60 * 1000;
const cache = new Map<string, { videos: YtVideo[]; at: number }>();

/** 两份结果交错合并去重，原本排前面的仍排前面 */
function merge(...lists: YtVideo[][]): YtVideo[] {
  const seen = new Set<string>();
  const out: YtVideo[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      const v = l[i];
      if (!v || seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      out.push(v);
    }
  }
  return out;
}

/** 舞蹈分区的 YouTube 搜寻：多搜一次「关键字 + 舞蹈」让舞蹈影片排前面 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 80) {
    return NextResponse.json({ error: '请输入要搜寻的关键字' }, { status: 400 });
  }
  try {
    let hit = cache.get(q);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      const [dance, plain] = await Promise.all([
        searchAll(`${q} 舞蹈`).catch(() => [] as YtVideo[]),
        searchAll(q),
      ]);
      hit = { videos: merge(dance, plain), at: Date.now() };
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
