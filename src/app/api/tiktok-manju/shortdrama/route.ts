/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import {
  type ShortDrama,
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

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
/** 每个分页抓两页，一页 20 部 */
const PAGES = 2;
/** 封面网址约两天过期，片单本身变动不快，2 小时抓一次 */
const FRESH_MS = 2 * 60 * 60 * 1000;
let cache: { lists: ShortDramaList[]; at: number } | null = null;
let inflight: Promise<ShortDramaList[]> | null = null;

async function fetchPage(theme: number, cursor: string): Promise<any> {
  const q = new URLSearchParams({
    aid: '1988',
    app_name: 'tiktok_web',
    device_platform: 'web_pc',
    app_language: 'zh-Hant-TW',
    language: 'zh-Hant-TW',
    region: 'TW',
    priority_region: 'TW',
    storeRegion: 'TW',
    coverFormat: '2',
    count: '20',
    cursor,
    themeType: String(theme),
  });
  const res = await fetch(
    `https://www.tiktok.com/api/drama/theme/drama_list/?${q}`,
    {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.tiktok.com/shortdrama',
      },
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`TikTok 回应 HTTP ${res.status}`);
  // 被挡的时候会回 200 但内容是空的
  const text = await res.text();
  if (!text) throw new Error('TikTok 回了空内容（可能被挡）');
  return JSON.parse(text);
}

async function loadTab(theme: number): Promise<ShortDrama[]> {
  const out: ShortDrama[] = [];
  const seen = new Set<string>();
  let cursor = '0';
  for (let page = 0; page < PAGES; page++) {
    const data = await fetchPage(theme, cursor);
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
