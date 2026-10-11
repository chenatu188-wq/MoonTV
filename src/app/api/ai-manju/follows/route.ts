import { NextResponse } from 'next/server';

import {
  type SharedFollow,
  addPendingShared,
  applyPending,
  listPendingShared,
  MAX_PENDING_SHARED,
  MAX_SHARED,
  sanitizeFollow,
  sanitizeFollows,
  settleShared,
} from '@/lib/ai-manju-shared';
import { AI_MANJU_SOURCES } from '@/lib/ai-manju-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mac 推上来的共用追踪清单（跟 TikTok 资料放同一个分支） */
const DATA_URL =
  'https://raw.githubusercontent.com/chenatu188-wq/MoonTV/tiktok-data/ai-manju-follows.json';
const FRESH_MS = 5 * 60 * 1000;
/** 有变更在等的时候勤一点去看 */
const FRESH_PENDING_MS = 45 * 1000;
let cache: { follows: SharedFollow[]; at: number } | null = null;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

async function shared(): Promise<SharedFollow[]> {
  const fresh = listPendingShared().length > 0 ? FRESH_PENDING_MS : FRESH_MS;
  if (!cache || Date.now() - cache.at > fresh) {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      // 档案还没建立（第一次用）当成空清单
      const follows =
        res.status === 404
          ? []
          : res.ok
          ? sanitizeFollows((await res.json())?.follows)
          : null;
      if (follows) cache = { follows, at: Date.now() };
    } catch {
      // GitHub 一时抓不到就沿用旧的
    }
  }
  const follows = cache?.follows ?? [];
  settleShared(follows);
  return follows;
}

async function state() {
  const confirmed = await shared();
  const pending = listPendingShared();
  // 已经收进内建来源的不用再列
  const builtin = new Set(AI_MANJU_SOURCES.map((s) => s.id));
  return {
    follows: applyPending(confirmed, pending).filter((f) => !builtin.has(f.id)),
    /** 已经写进共用清单的 id：前端用来判断自己补送的新增是不是已经生效 */
    confirmed: confirmed.map((f) => f.id),
    pending: pending.map(({ op, id }) => ({ op, id })),
  };
}

export async function GET() {
  return json(await state());
}

/** body: { op: 'add' | 'rm', type, id, name } */
export async function POST(req: Request) {
  let body: { op?: string } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '格式错误' }, 400);
  }
  const op = body.op;
  const follow = sanitizeFollow(body);
  if ((op !== 'add' && op !== 'rm') || !follow) {
    return json({ error: '格式错误' }, 400);
  }

  const confirmed = await shared();
  const pending = listPendingShared();
  const already = pending.some((p) => p.id === follow.id && p.op === op);
  if (!already) {
    if (pending.length >= MAX_PENDING_SHARED)
      return json({ error: '待处理的变更太多，请稍后再试' }, 429);
    if (
      op === 'add' &&
      applyPending(confirmed, pending).length >= MAX_SHARED &&
      !confirmed.some((f) => f.id === follow.id)
    )
      return json({ error: `最多追踪 ${MAX_SHARED} 个，请先移除不看的` }, 400);
    addPendingShared(op, follow);
  }
  return json(await state());
}
