import { NextRequest, NextResponse } from 'next/server';

import { decodeEntities, YT_HEADERS } from '@/lib/ai-manju-feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIDEO_ID = /^[\w-]{11}$/;

/** JSON 字串里的跳脱字元（&、\"）还原 */
function unescapeJson(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
}

/**
 * 贴网址播放用：查一支 YouTube 影片的标题与发布频道。
 * 标题／频道名先用 oEmbed（稳），频道 id 要从影片页面取（oEmbed 不给）。
 * 两边都只是补资料：查不到也回 200，前端照样能播，只是不能按「追踪此频道」。
 */
export async function GET(request: NextRequest) {
  const v = request.nextUrl.searchParams.get('v') ?? '';
  if (!VIDEO_ID.test(v)) {
    return NextResponse.json({ error: '影片 ID 不对' }, { status: 400 });
  }
  const watch = `https://www.youtube.com/watch?v=${v}`;

  const [oembed, page] = await Promise.all([
    fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`,
      { headers: YT_HEADERS, cache: 'no-store' }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{
      title?: string;
      author_name?: string;
    } | null>,
    fetch(watch, {
      headers: { ...YT_HEADERS, Accept: 'text/html,*/*;q=0.8' },
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ]);

  const channelId = /"channelId":"(UC[\w-]{22})"/.exec(page)?.[1] ?? '';
  const pageTitle = /"videoDetails":\{"videoId":"[\w-]{11}","title":"((?:[^"\\]|\\.)*)"/.exec(page)?.[1];
  const pageOwner = /"ownerChannelName":"((?:[^"\\]|\\.)*)"/.exec(page)?.[1];
  const views = /"viewCount":"(\d+)"/.exec(page)?.[1];
  const published = /"publishDate":"([^"]+)"/.exec(page)?.[1] ?? '';

  return NextResponse.json({
    videoId: v,
    title:
      oembed?.title ||
      (pageTitle ? unescapeJson(pageTitle) : '') ||
      '',
    channel:
      oembed?.author_name ||
      (pageOwner ? decodeEntities(unescapeJson(pageOwner)) : '') ||
      '',
    channelId,
    views: views ? Number(views) : null,
    published,
  });
}
