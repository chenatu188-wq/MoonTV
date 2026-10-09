import { NextResponse } from 'next/server';

import { fetchDramaPage, parseDramaList } from '@/lib/tiktok-shortdrama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 免登入的检查用端点：这台伺服器抓不抓得到 TikTok 短剧片单。
 * TikTok 会挡部分机房 IP，部署后用这支确认；只回笔数，不回内容。
 */
export async function GET() {
  try {
    const count = parseDramaList(await fetchDramaPage(2, '0')).length;
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
