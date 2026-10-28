import { NextResponse } from 'next/server';

import { listFbPending } from '@/lib/fb-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 给站长 Mac 上的同步脚本读的：「FB 影片」还没处理的追踪变更。
 * /api/cron 底下不需要登入；内容只有粉专名称。写入走需要登入的 /api/facebook/follows。
 */
export async function GET() {
  return NextResponse.json(
    { pending: listFbPending().map(({ op, page }) => ({ op, page })) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
