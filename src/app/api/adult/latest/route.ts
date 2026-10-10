import { NextResponse } from 'next/server';

import { isPigavSite } from '@/lib/adapters/pigav';
import {
  type LatestItem,
  type LatestRaw,
  mergeHot,
  mergeLatest,
} from '@/lib/browse-latest';
import { API_CONFIG, getConfig, isAdultGroup } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 彩虹频道各地区的「最新上架榜」和「热门榜」。
 * region = all 或来源群组（🔞 = 日本、🔞韓國、🔞歐美）。
 * 每个来源抓最近更新的两页，合起来：最新榜按上架时间排，热门榜只用点击数可信的来源。
 * 带 source=来源 key 时只看那一个来源（多抓几页，榜单才排得满）。
 */
const FRESH_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 7000;
const PAGES = 2;
/** 单一来源的榜单只有它自己的片，多抓几页 */
const SOURCE_PAGES = 5;

// 跟 api/browse/route.ts 的同名对照表一致：这几个来源有独立的韩国分类
const KOREAN_CATEGORY_IDS: Record<string, number> = {
  kuaiche_korea: 57,
  zuidazy_korea: 57,
  wujin_korea: 48,
  sdzy_korea: 57,
};

type Ranks = { latest: LatestItem[]; hot: LatestItem[] };
const cache = new Map<string, { data: Ranks; at: number }>();
const inflight = new Map<string, Promise<Ranks>>();

async function loadSource(
  site: {
    key: string;
    api: string;
    group?: string;
  },
  pageCount = PAGES
): Promise<LatestRaw[]> {
  const koreanId = KOREAN_CATEGORY_IDS[site.key];
  const query = koreanId
    ? `&t=${koreanId}`
    : site.group === '🔞韓國'
    ? `&wd=${encodeURIComponent('韩国')}`
    : '';
  const pages = await Promise.all(
    Array.from({ length: pageCount }, async (_, i) => {
      try {
        const res = await fetch(
          `${site.api}?ac=videolist${query}&pg=${i + 1}`,
          {
            headers: API_CONFIG.search.headers,
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: 'no-store',
          }
        );
        return res.ok ? await res.json() : null;
      } catch {
        return null; // 这个来源挂了，跳过
      }
    })
  );
  return pages.flatMap((p) =>
    p && Array.isArray(p.list) ? (p.list as LatestRaw[]) : []
  );
}

async function load(region: string, source: string): Promise<Ranks> {
  const config = await getConfig();
  const sites = (config.SourceConfig || []).filter(
    (s) =>
      !s.disabled &&
      isAdultGroup(s.group) &&
      !isPigavSite(s.api) && // PeerTube 来源不是苹果 CMS 格式
      (source ? s.key === source : region === 'all' || s.group === region)
  );
  // 不是彩虹频道的来源（或 PeerTube 来源）没有榜单
  if (sites.length === 0) return { latest: [], hot: [] };
  const batches = await Promise.all(
    sites.map(async (s) => ({
      source: s.key,
      source_name: s.name,
      list: await loadSource(s, source ? SOURCE_PAGES : PAGES),
    }))
  );
  const latest = mergeLatest(batches, 40);
  if (latest.length === 0) throw new Error('所有来源都抓不到');
  return { latest, hot: mergeHot(batches, 40) };
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const region = sp.get('region') || 'all';
  const source = sp.get('source') || '';
  if (
    (region !== 'all' && !isAdultGroup(region)) ||
    !/^[\w.-]{0,60}$/.test(source)
  ) {
    return NextResponse.json({ error: 'unknown region' }, { status: 400 });
  }

  const key = source ? `s:${source}` : region;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > FRESH_MS) {
    try {
      let job = inflight.get(key);
      if (!job) {
        job = load(region, source).finally(() => inflight.delete(key));
        inflight.set(key, job);
      }
      hit = { data: await job, at: Date.now() };
      cache.set(key, hit);
    } catch (e) {
      if (!hit) {
        return NextResponse.json(
          { error: `读不到榜单：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { ...hit.data, updated: Math.floor(hit.at / 1000) },
    { headers: { 'Cache-Control': 'private, max-age=600' } }
  );
}
