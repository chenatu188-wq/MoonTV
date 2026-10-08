import { NextResponse } from 'next/server';

import { type CatalogItem, newestFirst, parseCatalog } from '@/lib/hongguo-new';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface HongguoRankItem {
  rank: number;
  seriesId: string;
  title: string;
  cover: string;
  /** 例：「7047万」 */
  heat: string;
  /** 取代热度显示的说明（新上线榜用：「10/05 上线 · 全197集」） */
  note?: string;
}

export interface HongguoRankList {
  key: string;
  name: string;
  items: HongguoRankItem[];
}

/**
 * 红果短剧官网的热播榜。官网只有片单、不能播放（播放键是「下载 App」），
 * 所以这里只拿榜单当「该找哪部剧」的依据，实际播放走 YouTube。
 */
const LISTS = [
  { key: 'ai', name: 'AI剧热播榜', path: '/rank/hot-ai-drama' },
  { key: 'comic', name: '漫剧热播榜', path: '/rank/hot-comic-drama' },
  { key: 'real', name: '真人剧热播榜', path: '/rank/hot-real-drama' },
  // 官网叫「红果热播榜」，不分类型的总榜；页面标题已经叫红果热播榜，这里改称综合
  { key: 'all', name: '综合热播榜', path: '/rank/hot-drama' },
];

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** 榜单一天才更新一次，6 小时抓一次就够 */
const FRESH_MS = 6 * 60 * 60 * 1000;
let cache: { lists: HongguoRankList[]; at: number } | null = null;

function parseRank(html: string): HongguoRankItem[] {
  const items: HongguoRankItem[] = [];
  for (const raw of html.split('<article').slice(1)) {
    const block = raw.split('</article>')[0];
    const m = /id="rank-title-(\d+)"[^>]*>([^<]+)<\/h2>/.exec(block);
    if (!m) continue;
    const cover = /<img[^>]+src="([^"]+)"/.exec(block)?.[1] ?? '';
    // 热度数字和「热度」两个字可能被标签隔开，先去掉标签再找
    const text = block
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<[^>]+>/g, '');
    const heat = /([\d.]+[万亿]?)\s*热度/.exec(text)?.[1] ?? '';
    items.push({
      rank: items.length + 1,
      seriesId: m[1],
      // 红果的页面偶尔在片名里夹不可见的控制字元
      // eslint-disable-next-line no-control-regex
      title: m[2].replace(/[\u0000-\u001f]/g, '').trim(),
      cover: cover.replace(/&amp;/g, '&'),
      heat,
    });
  }
  return items;
}

/**
 * 新上线：官网没有这个榜，也不能按时间排序。但剧的 series_id 是字节的雪花 ID，
 * 高 32 位就是建立时间（秒），所以把分类页整个翻一遍、按 ID 由大到小排就是新上线。
 * 每个分类约 34 页，三个分类共一百页左右。
 */
// 真人剧另开一个榜：量太大，混在一起会把 AI 剧、漫剧洗掉
const NEW_LISTS = [
  { key: 'new', name: '新上线', categories: ['ai-drama', 'comic-drama'] },
  { key: 'new-real', name: '真人新上线', categories: ['real-drama'] },
];
const NEW_MAX_PAGES = 40;
const NEW_CONCURRENCY = 8;

let newCache: { lists: HongguoRankList[]; at: number } | null = null;
let newInflight: Promise<void> | null = null;

async function fetchCatalogPage(category: string, page: number) {
  try {
    const res = await fetch(
      `https://hongguoduanju.com/category/${category}?page=${page}`,
      {
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    return parseCatalog(await res.text());
  } catch {
    return null;
  }
}

async function loadNew(): Promise<HongguoRankList[]> {
  // 先抓各分类第一页，知道总共几页
  const categories = NEW_LISTS.flatMap((l) => l.categories);
  const firsts = await Promise.all(
    categories.map((c) => fetchCatalogPage(c, 1))
  );
  const byCategory = new Map<string, CatalogItem[]>(
    categories.map((c) => [c, []])
  );
  const jobs: { category: string; page: number }[] = [];
  firsts.forEach((first, i) => {
    if (!first) return;
    byCategory.get(categories[i])?.push(...first.items);
    const pages = Math.min(first.pages, NEW_MAX_PAGES);
    for (let p = 2; p <= pages; p++)
      jobs.push({ category: categories[i], page: p });
  });

  let next = 0;
  await Promise.all(
    Array.from({ length: NEW_CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const got = await fetchCatalogPage(job.category, job.page);
        if (got) byCategory.get(job.category)?.push(...got.items);
      }
    })
  );

  return NEW_LISTS.map((l) => ({
    key: l.key,
    name: l.name,
    items: newestFirst(
      l.categories.flatMap((c) => byCategory.get(c) ?? []),
      40
    ),
  })).filter((l) => l.items.length > 0);
}

/** 翻完全部分类页要二三十秒，放背景跑，不挡热播榜 */
function refreshNew(): Promise<void> {
  if (!newInflight) {
    newInflight = loadNew()
      .then((lists) => {
        if (lists.length) newCache = { lists, at: Date.now() };
      })
      .catch(() => undefined)
      .finally(() => {
        newInflight = null;
      });
  }
  return newInflight;
}

async function load(): Promise<HongguoRankList[]> {
  // 各榜分开抓：其中一个抓不到不影响其他榜
  const results = await Promise.all(
    LISTS.map(async (l) => {
      try {
        const res = await fetch(`https://hongguoduanju.com${l.path}`, {
          headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
          cache: 'no-store',
        });
        if (!res.ok) return null;
        const items = parseRank(await res.text());
        return items.length ? { key: l.key, name: l.name, items } : null;
      } catch {
        return null;
      }
    })
  );
  const lists = results.filter((l): l is HongguoRankList => l !== null);
  if (lists.length === 0) throw new Error('所有榜单都抓不到');
  return lists;
}

export async function GET() {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    try {
      cache = { lists: await load(), at: Date.now() };
    } catch (e) {
      // 红果一时抓不到就沿用旧榜单；连旧的都没有才报错
      if (!cache) {
        return NextResponse.json(
          { error: `读不到红果榜单：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  if (!newCache || Date.now() - newCache.at > FRESH_MS) {
    const pending = refreshNew();
    // 第一次还没有资料时最多等 4 秒；等不到就先回热播榜，前端稍后会再问一次
    if (!newCache) {
      await Promise.race([pending, new Promise((r) => setTimeout(r, 4000))]);
    }
  }
  const lists = newCache ? [...cache.lists, ...newCache.lists] : cache.lists;
  return NextResponse.json(
    {
      lists,
      updated: Math.floor(cache.at / 1000),
      // 新上线榜还在背景整理
      pending: !newCache,
    },
    {
      headers: {
        'Cache-Control': newCache ? 'private, max-age=1800' : 'no-store',
      },
    }
  );
}
