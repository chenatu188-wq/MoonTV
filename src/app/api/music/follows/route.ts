import { NextResponse } from 'next/server';

import {
  type SharedFollow,
  addPendingMusic,
  applyPending,
  listPendingMusic,
  MAX_MUSIC_FOLLOWS,
  MAX_PENDING_MUSIC,
  sanitizeFollow,
  sanitizeFollows,
  settleMusic,
} from '@/lib/music-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mac 推上来的共用追踪清单（跟 TikTok 资料放同一个分支） */
const DATA_URL =
  'https://raw.githubusercontent.com/chenatu188-wq/MoonTV/tiktok-data/music-follows.json';
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
  const fresh = listPendingMusic().length > 0 ? FRESH_PENDING_MS : FRESH_MS;
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
  settleMusic(follows);
  return follows;
}

async function state() {
  const confirmed = await shared();
  const pending = listPendingMusic();
  return {
    follows: applyPending(confirmed, pending),
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
  const pending = listPendingMusic();
  const already = pending.some((p) => p.id === follow.id && p.op === op);
  if (!already) {
    if (pending.length >= MAX_PENDING_MUSIC)
      return json({ error: '待处理的变更太多，请稍后再试' }, 429);
    if (
      op === 'add' &&
      applyPending(confirmed, pending).length >= MAX_MUSIC_FOLLOWS &&
      !confirmed.some((f) => f.id === follow.id)
    )
      return json({ error: `最多追踪 ${MAX_MUSIC_FOLLOWS} 个，请先移除不听的` }, 400);
    addPendingMusic(op, follow);
  }
  return json(await state());
}
