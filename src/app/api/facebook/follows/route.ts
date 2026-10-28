import { NextResponse } from 'next/server';

import {
  addFbPending,
  listFbPending,
  MAX_FB_PAGES,
  MAX_FB_PENDING,
  parseFbPage,
} from '@/lib/fb-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  return json({ pending: listFbPending() });
}

/** body: { op: 'add' | 'rm', page: string, total?: number }；page 可以是粉专名称或网址 */
export async function POST(req: Request) {
  let body: { op?: string; page?: string; total?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: '格式错误' }, 400);
  }
  const op = body.op;
  if (op !== 'add' && op !== 'rm') return json({ error: '格式错误' }, 400);

  const page = parseFbPage(String(body.page ?? ''));
  if (!page) {
    return json(
      {
        error:
          '认不出这个粉专。请贴粉专主页网址（例 https://www.facebook.com/NASA）；分享短网址认不出是哪个粉专',
      },
      400
    );
  }

  const pending = listFbPending();
  const already = pending.some(
    (p) => p.page.toLowerCase() === page.toLowerCase() && p.op === op
  );
  if (!already) {
    if (pending.length >= MAX_FB_PENDING)
      return json({ error: '待处理的变更太多，请稍后再试' }, 429);
    const adding = pending.filter((p) => p.op === 'add').length;
    if (op === 'add' && (Number(body.total) || 0) + adding >= MAX_FB_PAGES)
      return json(
        { error: `最多追踪 ${MAX_FB_PAGES} 个粉专，请先移除不看的` },
        400
      );
    addFbPending(op, page);
  }
  return json({ page, pending: listFbPending() });
}
