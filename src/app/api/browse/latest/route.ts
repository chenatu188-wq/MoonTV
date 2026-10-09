import { NextResponse } from 'next/server';

import { BROWSE_RANK_CONFIG, matchCategories } from '@/lib/browse-category';
import {
  type LatestItem,
  type LatestRaw,
  isAdultCategoryName,
  mergeLatest,
} from '@/lib/browse-latest';
import { API_CONFIG, getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 各分区的「最新上架榜」：这个分区的每个来源，各抓几个对应分类最近更新的一页，
 * 合起来按上架时间排。来源多（二三十个）而且常有挂掉的，所以每个请求限时、
 * 结果放记忆体缓存。
 */
const FRESH_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 7000;
/** 每个来源最多看几个上游分类（电影、电视剧会对到好几个） */
const MAX_CATEGORIES = 4;
const cache = new Map<string, { items: LatestItem[]; at: number }>();
const inflight = new Map<string, Promise<LatestItem[]>>();

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: API_CONFIG.search.headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadSource(
  site: { api: string; group?: string },
  keywords: string[]
): Promise<LatestRaw[]> {
  try {
    const listData = await getJson(`${site.api}?ac=list`);
    const cats: { type_id: number; type_name: string }[] = (
      listData.class || []
    ).filter(
      (c: { type_name?: string }) =>
        c.type_name && !isAdultCategoryName(c.type_name)
    );
    const matched = matchCategories(cats, keywords).slice(0, MAX_CATEGORIES);
    const pages = await Promise.all(
      matched.map((cat) =>
        getJson(`${site.api}?ac=videolist&t=${cat.type_id}&pg=1`).catch(
          () => null
        )
      )
    );
    return pages.flatMap((p) =>
      p && Array.isArray(p.list) ? (p.list as LatestRaw[]) : []
    );
  } catch {
    return []; // 这个来源挂了，跳过
  }
}

async function load(category: string): Promise<LatestItem[]> {
  const cfg = BROWSE_RANK_CONFIG[category];
  // getAvailableApiSites 已经排除停用的和成人来源
  const sites = (await getAvailableApiSites()).filter((s) =>
    cfg.matchGroup(s.group || '')
  );
  // 同一个上游被登记成好几个来源时只抓一次
  const seenApi = new Set<string>();
  const unique = sites.filter((s) => {
    const k = `${s.api}|${s.group}`;
    if (seenApi.has(k)) return false;
    seenApi.add(k);
    return true;
  });
  const batches = await Promise.all(
    unique.map(async (s) => ({
      source: s.key,
      source_name: s.name,
      list: await loadSource(s, cfg.keywords(s.group || '')),
    }))
  );
  const items = mergeLatest(batches, 40);
  if (items.length === 0) throw new Error('所有来源都抓不到');
  return items;
}

export async function GET(request: Request) {
  const category =
    new URL(request.url).searchParams.get('category') || 'anime3d';
  if (!BROWSE_RANK_CONFIG[category]) {
    return NextResponse.json({ error: 'unknown category' }, { status: 400 });
  }

  let hit = cache.get(category);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      let job = inflight.get(category);
      if (!job) {
        job = load(category).finally(() => inflight.delete(category));
        inflight.set(category, job);
      }
      hit = { items: await job, at: Date.now() };
      cache.set(category, hit);
    } catch (e) {
      if (!hit) {
        return NextResponse.json(
          { error: `读不到最新上架：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { items: hit.items, updated: Math.floor(hit.at / 1000) },
    { headers: { 'Cache-Control': 'private, max-age=600' } }
  );
}
