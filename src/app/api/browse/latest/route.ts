import { NextResponse } from 'next/server';

import {
  ANIME_3D_KEYWORDS,
  ANIME_3D_REGION_KEYWORDS,
  matchCategories,
} from '@/lib/browse-category';
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
 * 动漫分区的「最新上架榜」：每个动漫来源各抓最近更新的两页，合起来按上架时间排。
 * 来源多（二十几个）而且常有挂掉的，所以每个请求限时、结果放记忆体缓存。
 */
const FRESH_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 7000;
const PAGES = 2;
let cache: { items: LatestItem[]; at: number } | null = null;
let inflight: Promise<LatestItem[]> | null = null;

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: API_CONFIG.search.headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadSource(site: {
  key: string;
  name: string;
  api: string;
  group?: string;
}): Promise<LatestRaw[]> {
  try {
    const listData = await getJson(`${site.api}?ac=list`);
    const cats: { type_id: number; type_name: string }[] = (
      listData.class || []
    ).filter(
      (c: { type_name?: string }) =>
        c.type_name && !isAdultCategoryName(c.type_name)
    );
    const keywords =
      ANIME_3D_REGION_KEYWORDS[site.group || ''] || ANIME_3D_KEYWORDS;
    // 跟浏览页同一套挑分类的规则：第一个抓得到东西的分类为准
    for (const cat of matchCategories(cats, keywords)) {
      const pages = await Promise.all(
        Array.from({ length: PAGES }, (_, i) =>
          getJson(
            `${site.api}?ac=videolist&t=${cat.type_id}&pg=${i + 1}`
          ).catch(() => null)
        )
      );
      const list = pages.flatMap((p) =>
        p && Array.isArray(p.list) ? (p.list as LatestRaw[]) : []
      );
      if (list.length > 0) return list;
    }
  } catch {
    // 这个来源挂了，跳过
  }
  return [];
}

async function load(): Promise<LatestItem[]> {
  // 家庭区：getAvailableApiSites 已经只放行家庭分类、排除成人来源
  const sites = (await getAvailableApiSites()).filter((s) =>
    (s.group || '').startsWith('3D動漫')
  );
  // 同一个上游被登记成好几个来源（中国／日本／欧美各一份）时只抓一次
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
      list: await loadSource(s),
    }))
  );
  const items = mergeLatest(batches, 40);
  if (items.length === 0) throw new Error('所有来源都抓不到');
  return items;
}

export async function GET() {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    try {
      inflight ??= load().finally(() => {
        inflight = null;
      });
      cache = { items: await inflight, at: Date.now() };
    } catch (e) {
      if (!cache) {
        return NextResponse.json(
          { error: `读不到最新上架：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { items: cache.items, updated: Math.floor(cache.at / 1000) },
    { headers: { 'Cache-Control': 'private, max-age=600' } }
  );
}
