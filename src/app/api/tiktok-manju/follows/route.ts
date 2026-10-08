import { NextResponse } from 'next/server';

import {
  addPending,
  listPending,
  MAX_ACCOUNTS,
  MAX_PENDING,
  parseHandle,
} from '@/lib/tiktok-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

export async function GET() {
  return json({ pending: listPending() });
}

/**
 * body: { op: 'add' | 'rm', handle: string, total?: number }
 * handle 可以是 @帐号 或 TikTok 网址；total 是前端目前看到的追踪数，用来挡超量。
 */
export async function POST(req: Request) {
  let body: { op?: string; handle?: string; total?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: '格式错误' }, 400);
  }

  const op = body.op;
  if (op !== 'add' && op !== 'rm') return json({ error: '格式错误' }, 400);

  const handle = parseHandle(String(body.handle ?? ''));
  if (!handle) {
    return json(
      {
        error:
          '认不出这个帐号。请贴 @帐号 或帐号主页网址（https://www.tiktok.com/@帐号）；分享用的短网址不行',
      },
      400
    );
  }

  const pending = listPending();
  const already = pending.some((p) => p.handle === handle && p.op === op);
  if (!already) {
    if (pending.length >= MAX_PENDING)
      return json({ error: '待处理的变更太多，请稍后再试' }, 429);
    const adding = pending.filter((p) => p.op === 'add').length;
    if (op === 'add' && (Number(body.total) || 0) + adding >= MAX_ACCOUNTS)
      return json(
        { error: `最多追踪 ${MAX_ACCOUNTS} 个帐号，请先移除不看的` },
        400
      );
    addPending(op, handle);
  }
  return json({ handle, pending: listPending() });
}
