import { NextResponse } from 'next/server';

import { listPendingMusic } from '@/lib/music-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 给站长 Mac 上的同步脚本读的：音乐分区的追踪清单有哪些变更还没处理。
 * 放在 /api/cron 底下是因为这个前缀不需要登入（Mac 没有站台密码）。
 * 只能读、内容只有 YouTube 频道／播放列表的 id 和名称，不含任何使用者资料；
 * 写入要走需要登入的 /api/music/follows。
 */
export async function GET() {
  return NextResponse.json(
    {
      pending: listPendingMusic().map(({ op, type, id, name }) => ({
        op,
        type,
        id,
        name,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
