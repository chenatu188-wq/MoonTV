import { NextResponse } from 'next/server';

import {
  type ShortDrama,
  fetchDramaPage,
  parseDramaList,
  SHORT_DRAMA_TABS,
} from '@/lib/tiktok-shortdrama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ShortDramaList {
  key: string;
  name: string;
  items: ShortDrama[];
}

/** 每个分页抓两页，一页 20 部 */
const PAGES = 2;
/** 封面网址约两天过期，片单本身变动不快，2 小时抓一次 */
const FRESH_MS = 2 * 60 * 60 * 1000;
let cache: { lists: ShortDramaList[]; at: number } | null = null;
let inflight: Promise<ShortDramaList[]> | null = null;

async function loadTab(theme: number): Promise<ShortDrama[]> {
  const out: ShortDrama[] = [];
  const seen = new Set<string>();
  let cursor = '0';
  for (let page = 0; page < PAGES; page++) {
    const data = await fetchDramaPage(theme, cursor);
    for (const d of parseDramaList(data)) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        out.push(d);
      }
    }
    if (!data.hasMore || !data.cursor) break;
    cursor = String(data.cursor);
  }
  return out;
}

async function load(): Promise<ShortDramaList[]> {
  const lists = await Promise.all(
    SHORT_DRAMA_TABS.map(async (t) => ({
      key: t.key,
      name: t.name,
      items: await loadTab(t.theme).catch(() => []),
    }))
  );
  const ok = lists.filter((l) => l.items.length > 0);
  if (ok.length === 0) throw new Error('TikTok 短剧片单全部抓不到');
  return ok;
}

export async function GET() {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    try {
      inflight ??= load().finally(() => {
        inflight = null;
      });
      cache = { lists: await inflight, at: Date.now() };
    } catch (e) {
      // 一时抓不到就沿用旧的；连旧的都没有才报错
      if (!cache) {
        return NextResponse.json(
          { error: `读不到短剧片单：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { lists: cache.lists, updated: Math.floor(cache.at / 1000) },
    { headers: { 'Cache-Control': 'private, max-age=1800' } }
  );
}
