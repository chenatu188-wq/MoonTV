import { NextResponse } from 'next/server';

import { parseHandle } from '@/lib/tiktok-follows';
import {
  fetchCreatorDramaPage,
  fetchDramaPage,
  parseDramaList,
  resolveCreator,
} from '@/lib/tiktok-shortdrama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 免登入的检查用端点：这台伺服器抓不抓得到 TikTok 短剧片单。
 * TikTok 会挡部分机房 IP，部署后用这支确认；只回笔数，不回内容。
 */
export async function GET(request: Request) {
  // 带 handle 时改测「某个上传者的短剧」那条路（帐号的 secUid 靠 Mac 推上来的资料）
  const handle = parseHandle(
    new URL(request.url).searchParams.get('handle') ?? ''
  );
  try {
    const count = parseDramaList(
      handle
        ? await fetchCreatorDramaPage(
            (
              await resolveCreator(handle)
            ).secUid,
            '0'
          )
        : await fetchDramaPage(2, '0')
    ).length;
    return NextResponse.json(
      { ok: count > 0, count },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
