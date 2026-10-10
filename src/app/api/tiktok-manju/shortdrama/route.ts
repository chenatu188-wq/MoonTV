import { NextRequest, NextResponse } from 'next/server';

import {
  type DramaCategoryGroup,
  type DramaFilter,
  type ShortDrama,
  fetchCategories,
  fetchDramaPage,
  FILTER_THEME,
  parseDramaList,
  parseFilter,
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

async function loadTab(
  theme: number,
  filter?: DramaFilter
): Promise<ShortDrama[]> {
  const out: ShortDrama[] = [];
  const seen = new Set<string>();
  let cursor = '0';
  for (let page = 0; page < PAGES; page++) {
    const data = await fetchDramaPage(theme, cursor, filter);
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

/** 筛选选项几乎不变，一天抓一次；抓不到就不给筛选，片单照常显示 */
const CATEGORY_FRESH_MS = 24 * 60 * 60 * 1000;
let categories: { groups: DramaCategoryGroup[]; at: number } | null = null;

async function getCategories(): Promise<DramaCategoryGroup[]> {
  if (!categories || Date.now() - categories.at > CATEGORY_FRESH_MS) {
    try {
      const groups = await fetchCategories();
      if (groups.length > 0) categories = { groups, at: Date.now() };
    } catch {
      // 沿用旧的
    }
  }
  return categories?.groups ?? [];
}

/** 筛选结果：组合很多，各自缓存，满了就丢最旧的 */
const filtered = new Map<string, { items: ShortDrama[]; at: number }>();

async function getFiltered(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const allowed = new Set(
    (await getCategories()).flatMap((g) => g.items.map((i) => i.id))
  );
  const filter = parseFilter(sp.get('tags'), sp.get('days'), allowed);
  if (filter.tags.length === 0 && !filter.days) {
    return NextResponse.json({ error: '没有筛选条件' }, { status: 400 });
  }

  const key = `${filter.tags.slice().sort().join(',')}|${filter.days ?? ''}`;
  let hit = filtered.get(key);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      hit = { items: await loadTab(FILTER_THEME, filter), at: Date.now() };
      filtered.set(key, hit);
      if (filtered.size > 200) {
        filtered.delete(filtered.keys().next().value as string);
      }
    } catch (e) {
      if (!hit) {
        return NextResponse.json(
          { error: `读不到短剧片单：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { items: hit.items },
    { headers: { 'Cache-Control': 'private, max-age=1800' } }
  );
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.has('tags') || sp.has('days')) return getFiltered(request);

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
    {
      lists: cache.lists,
      categories: await getCategories(),
      updated: Math.floor(cache.at / 1000),
    },
    { headers: { 'Cache-Control': 'private, max-age=1800' } }
  );
}
