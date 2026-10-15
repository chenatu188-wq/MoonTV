import { NextResponse } from 'next/server';

import {
  type DouyinData,
  type DouyinLink,
  addPendingDouyin,
  classifyDouyinUrl,
  hasRef,
  isDouyinHost,
  isDouyinRef,
  listPendingDouyin,
  MAX_DOUYIN_DRAMAS,
  MAX_PENDING_DOUYIN,
  sanitizeDouyinData,
  settleDouyin,
  visibleDramas,
} from '@/lib/douyin-drama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mac 推上来的抖音追剧资料（跟 TikTok 资料放同一个分支） */
const DATA_URL =
  'https://raw.githubusercontent.com/chenatu188-wq/MoonTV/tiktok-data/douyin.json';
const FRESH_MS = 10 * 60 * 1000;
/** 有变更在等的时候勤一点去看 */
const FRESH_PENDING_MS = 45 * 1000;
const EMPTY: DouyinData = { updated: 0, dramas: [], failed: [] };
let cache: { data: DouyinData; at: number } | null = null;

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

async function load(): Promise<DouyinData> {
  const fresh = listPendingDouyin().length > 0 ? FRESH_PENDING_MS : FRESH_MS;
  if (!cache || Date.now() - cache.at > fresh) {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      // 档案还没建立（还没人追过剧）当成空的
      const data =
        res.status === 404
          ? EMPTY
          : res.ok
          ? sanitizeDouyinData(await res.json())
          : null;
      if (data) cache = { data, at: Date.now() };
    } catch {
      // GitHub 一时抓不到就沿用旧的
    }
  }
  const data = cache?.data ?? EMPTY;
  settleDouyin(data);
  return data;
}

async function state() {
  const data = await load();
  const pending = listPendingDouyin();
  return {
    updated: data.updated,
    dramas: visibleDramas(data, pending),
    failed: data.failed.filter(
      (f) => !pending.some((p) => p.op === 'rm' && p.ref === f.ref)
    ),
    pending: pending.map(({ op, ref, name }) => ({ op, ref, name })),
  };
}

/** v.douyin.com 短网址要跟着转址才知道是哪一集；只跟着转到抖音的网域，最多跳 4 次 */
async function expandShort(url: string): Promise<DouyinLink | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    const next = res.headers.get('location');
    if (!next) return null;
    const target = new URL(next, current);
    if (!isDouyinHost(target.hostname)) return null;
    const found = classifyDouyinUrl(target.href);
    if (found?.kind === 'ref') return found;
    current = target.href;
  }
  return null;
}

export async function GET() {
  return json(await state());
}

/** body: { op: 'add', url } 或 { op: 'rm', ref, name } */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '格式错误' }, 400);
  }
  const op = body.op;
  const name = typeof body.name === 'string' ? body.name : '';
  let ref = '';

  if (op === 'add') {
    let link = classifyDouyinUrl(String(body.url ?? '').slice(0, 2000));
    if (!link)
      return json({ error: '认不出这个连结：请贴抖音短剧／合集或其中任一集的分享连结' }, 400);
    if (link.kind === 'short') {
      try {
        link = await expandShort(link.url);
      } catch {
        link = null;
      }
      if (!link) return json({ error: '这个抖音短网址打不开，可能已经失效' }, 404);
    }
    if (link.kind !== 'ref') return json({ error: '格式错误' }, 400);
    ref = link.ref;
  } else if (op === 'rm') {
    ref = String(body.ref ?? '');
    if (!isDouyinRef(ref)) return json({ error: '格式错误' }, 400);
  } else {
    return json({ error: '格式错误' }, 400);
  }

  const data = await load();
  const pending = listPendingDouyin();
  const already =
    pending.some((p) => p.ref === ref && p.op === op) ||
    (op === 'add' && hasRef(data, ref) && !pending.some((p) => p.ref === ref));
  if (!already) {
    if (pending.length >= MAX_PENDING_DOUYIN)
      return json({ error: '待处理的变更太多，请稍后再试' }, 429);
    const adding = pending.filter((p) => p.op === 'add').length;
    if (op === 'add' && data.dramas.length + adding >= MAX_DOUYIN_DRAMAS)
      return json({ error: `最多追 ${MAX_DOUYIN_DRAMAS} 部，请先移除不看的` }, 400);
    addPendingDouyin(op, ref, name);
  }
  return json({ ...(await state()), ref });
}
