import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface HongguoRankItem {
  rank: number;
  seriesId: string;
  title: string;
  cover: string;
  /** 例：「7047万」 */
  heat: string;
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
  return NextResponse.json(
    { lists: cache.lists, updated: Math.floor(cache.at / 1000) },
    { headers: { 'Cache-Control': 'private, max-age=1800' } }
  );
}
