import { NextRequest, NextResponse } from 'next/server';

import { parseHandle } from '@/lib/tiktok-follows';
import {
  type DramaCreator,
  type ShortDrama,
  fetchCreator,
  fetchCreatorDramaPage,
  parseDramaList,
} from '@/lib/tiktok-shortdrama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 某个 TikTok 帐号在短剧专区上传的剧。
 * 短剧专区的上传帐号没有一般影片，追踪了也抓不到东西；改列出他的短剧。
 */
const PAGES = 3;
const FRESH_MS = 2 * 60 * 60 * 1000;
type Result = { name: string; items: ShortDrama[] };
const cache = new Map<string, { data: Result; at: number }>();
const inflight = new Map<string, Promise<Result>>();
/** 帐号的 secUid 不会变，查到就一直用 */
const creators = new Map<string, DramaCreator>();

async function load(handle: string): Promise<Result> {
  let creator = creators.get(handle);
  if (!creator) {
    creator = await fetchCreator(handle);
    creators.set(handle, creator);
  }
  const items: ShortDrama[] = [];
  const seen = new Set<string>();
  let cursor = '0';
  for (let page = 0; page < PAGES; page++) {
    const data = await fetchCreatorDramaPage(creator.secUid, cursor);
    for (const d of parseDramaList(data)) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        items.push(d);
      }
    }
    if (!data.hasMore || !data.cursor) break;
    cursor = String(data.cursor);
  }
  return { name: creator.name, items };
}

export async function GET(request: NextRequest) {
  const handle = parseHandle(request.nextUrl.searchParams.get('handle') ?? '');
  if (!handle) {
    return NextResponse.json({ error: '参数不正确' }, { status: 400 });
  }

  let hit = cache.get(handle);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      let job = inflight.get(handle);
      if (!job) {
        job = load(handle).finally(() => inflight.delete(handle));
        inflight.set(handle, job);
      }
      hit = { data: await job, at: Date.now() };
      cache.set(handle, hit);
      if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      // 一时抓不到就沿用旧的；连旧的都没有才报错
      if (!hit) {
        return NextResponse.json(
          { error: `读不到这个帐号的短剧：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(hit.data, {
    headers: { 'Cache-Control': 'private, max-age=1800' },
  });
}
