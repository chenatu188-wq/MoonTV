import { NextResponse } from 'next/server';

import { listPendingDouyin } from '@/lib/douyin-drama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 给站长 Mac 上的同步脚本读的：抖音追剧有哪些变更还没处理。
 * 放在 /api/cron 底下是因为这个前缀不需要登入（Mac 没有站台密码）。
 * 只能读、内容只有抖音合集／影片编号和剧名，不含任何使用者资料；
 * 写入要走需要登入的 /api/tiktok-manju/douyin。
 */
export async function GET() {
  return NextResponse.json(
    {
      pending: listPendingDouyin().map(({ op, ref, name }) => ({
        op,
        ref,
        name,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
