import { NextResponse } from 'next/server';

import { BROWSE_RANK_CONFIG, matchCategories } from '@/lib/browse-category';
import {
  type LatestItem,
  type LatestRaw,
  isAdultCategoryName,
  mergeHot,
  mergeLatest,
} from '@/lib/browse-latest';
import { API_CONFIG, getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 各分区的「最新上架榜」：这个分区的每个来源，各抓几个对应分类最近更新的一页，
 * 合起来按上架时间排。来源多（二三十个）而且常有挂掉的，所以每个请求限时、
 * 结果放记忆体缓存。
 * 带 source=来源 key 时只看那一个来源：多抓一页，另外回热门榜（点击数可信才有）。
 */
const FRESH_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 7000;
/** 每个来源最多看几个上游分类（电影、电视剧会对到好几个） */
const MAX_CATEGORIES = 4;
/** 单一来源的榜单只有它自己的片，每个分类多抓一页 */
const SOURCE_PAGES = 2;
type Ranks = { items: LatestItem[]; hot: LatestItem[] };
const cache = new Map<string, { data: Ranks; at: number }>();
const inflight = new Map<string, Promise<Ranks>>();

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
  keywords: string[],
  pageCount = 1
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
      matched.flatMap((cat) =>
        Array.from({ length: pageCount }, (_, i) =>
          getJson(
            `${site.api}?ac=videolist&t=${cat.type_id}&pg=${i + 1}`
          ).catch(() => null)
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

async function load(category: string, source: string): Promise<Ranks> {
  const cfg = BROWSE_RANK_CONFIG[category];
  // getAvailableApiSites 已经排除停用的和成人来源
  const sites = (await getAvailableApiSites()).filter(
    (s) => cfg.matchGroup(s.group || '') && (!source || s.key === source)
  );
  // 这个分区没有这个来源
  if (source && sites.length === 0) return { items: [], hot: [] };
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
      list: await loadSource(
        s,
        cfg.keywords(s.group || ''),
        source ? SOURCE_PAGES : 1
      ),
    }))
  );
  const items = mergeLatest(batches, 40);
  if (items.length === 0 && !source) throw new Error('所有来源都抓不到');
  // 分区的热门榜另外用豆瓣／红果；单一来源才用它自己的点击数
  return { items, hot: source ? mergeHot(batches, 40) : [] };
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const category = sp.get('category') || 'anime3d';
  const source = sp.get('source') || '';
  if (!BROWSE_RANK_CONFIG[category] || !/^[\w.-]{0,60}$/.test(source)) {
    return NextResponse.json({ error: 'unknown category' }, { status: 400 });
  }

  const key = source ? `${category}|${source}` : category;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      let job = inflight.get(key);
      if (!job) {
        job = load(category, source).finally(() => inflight.delete(key));
        inflight.set(key, job);
      }
      hit = { data: await job, at: Date.now() };
      cache.set(key, hit);
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
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
    {
      items: hit.data.items,
      // latest 是给各来源一列的榜单用的（跟彩虹频道同一个元件）
      latest: hit.data.items,
      hot: hit.data.hot,
      updated: Math.floor(hit.at / 1000),
    },
    { headers: { 'Cache-Control': 'private, max-age=600' } }
  );
}
