import { NextResponse } from 'next/server';

import { listPending } from '@/lib/tiktok-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 给站长 Mac 上的同步脚本读的：目前有哪些追踪变更还没处理。
 * 放在 /api/cron 底下是因为这个前缀不需要登入（Mac 没有站台密码）。
 * 只能读、内容只有 TikTok 帐号名称，不含任何使用者资料；写入要走需要登入的
 * /api/tiktok-manju/follows。
 */
export async function GET() {
  return NextResponse.json(
    { pending: listPending().map(({ op, handle }) => ({ op, handle })) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
