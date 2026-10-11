import { NextResponse } from 'next/server';

import { listPendingShared } from '@/lib/ai-manju-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 给站长 Mac 上的同步脚本读的：AI 漫剧的追踪清单有哪些变更还没处理。
 * 放在 /api/cron 底下是因为这个前缀不需要登入（Mac 没有站台密码）。
 * 只能读、内容只有 YouTube 频道／播放清单的 id 和名称，不含任何使用者资料；
 * 写入要走需要登入的 /api/ai-manju/follows。
 */
export async function GET() {
  return NextResponse.json(
    {
      pending: listPendingShared().map(({ op, type, id, name }) => ({
        op,
        type,
        id,
        name,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
