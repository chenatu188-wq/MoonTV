/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TikTok「短剧」专区（tiktok.com/shortdrama）的片单。
 * 这些剧不是一般帐号影片：帐号页上看不到、yt-dlp 抓不到、官方嵌入播放器也不给播，
 * 网页上要登入 TikTok 才能看。所以站内只列片单，点了另开 TikTok 的短剧页。
 * 片单介面不用登入也不用签章（2026-10-10 实测），但没有公开文件，TikTok 改版时可能要跟着改。
 */
export interface ShortDrama {
  id: string;
  name: string;
  cover: string;
  episodes: number;
  /** 观看数；拿不到是 0 */
  watched: number;
  description: string;
  isNew: boolean;
  isHot: boolean;
}

export interface ShortDramaTab {
  key: string;
  name: string;
  /** TikTok 介面的 themeType */
  theme: number;
}

/** themeType 没有文件，这几个是对照 TikTok 短剧页的分页试出来的 */
export const SHORT_DRAMA_TABS: ShortDramaTab[] = [
  { key: 'rank', name: '排行榜', theme: 2 },
  { key: 'newhot', name: '新剧热播', theme: 8 },
  { key: 'new', name: '最新上线', theme: 9 },
  { key: 'all', name: '综合推荐', theme: 10 },
];

/** 点了要开的网址：从第 1 集开始看 */
export function shortDramaUrl(id: string): string {
  return `https://www.tiktok.com/shortdrama/episode/${id}/1`;
}

/** 把介面回应整理成片单；格式不对的项目直接略过，同一部剧只留一次 */
export function parseDramaList(data: any): ShortDrama[] {
  const out: ShortDrama[] = [];
  const seen = new Set<string>();
  for (const d of Array.isArray(data?.dramaList) ? data.dramaList : []) {
    const id = String(d?.dramaID ?? '');
    const name = String(d?.dramaName ?? '').trim();
    if (!/^\d{5,25}$/.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      cover: d.zoomCover?.['480'] ?? d.cover?.urlList?.[0] ?? '',
      episodes: Number(d.numVideos) || 0,
      watched: Number(d.numWatched) || 0,
      description: String(d.description ?? '').slice(0, 200),
      isNew: d.labelNew === true,
      isHot: d.labelHot === true,
    });
  }
  return out;
}

/** 分类筛选：每组最多选一个题材（组跟组之间是「而且」），外加发行时间 */
export interface DramaFilter {
  tags: string[];
  days: 7 | 30 | null;
}

export interface DramaCategoryGroup {
  title: string;
  items: { id: string; name: string }[];
}

/** 筛选只有「综合」这个 themeType 吃得到；排行榜、最新带了也不会变（2026-10-10 实测） */
export const FILTER_THEME = 10;

/** TikTok 的三组题材没有给组名（只有「所有设定」这种选项），自己取 */
const GROUP_TITLES = ['背景', '剧情', '看点'];

/**
 * 整理 TikTok 的筛选选项。只留题材那几组（categoryFilterType 2），
 * 「所有 xx」和发行时间那组不要：发行时间页面上自己画。
 */
export function parseCategories(data: any): DramaCategoryGroup[] {
  const out: DramaCategoryGroup[] = [];
  for (const g of Array.isArray(data?.dramaCategoryLists)
    ? data.dramaCategoryLists
    : []) {
    const items = (Array.isArray(g?.dramaCategories) ? g.dramaCategories : [])
      .filter(
        (c: any) =>
          c?.categoryFilterType === 2 &&
          /^\d{5,25}$/.test(String(c.categoryID ?? '')) &&
          c.name
      )
      .map((c: any) => ({ id: String(c.categoryID), name: String(c.name) }));
    if (items.length > 0) {
      out.push({ title: GROUP_TITLES[out.length] ?? '其他', items });
    }
  }
  return out;
}

/**
 * 把网址参数整理成筛选条件；不合法的值直接丢掉。
 * allowed 有给的话只收清单里有的题材，免得任意字串被转送给 TikTok。
 */
export function parseFilter(
  tags: string | null,
  days: string | null,
  allowed?: Set<string>
): DramaFilter {
  const ids = Array.from(new Set((tags ?? '').split(',')))
    .filter((t) => /^\d{5,25}$/.test(t) && (!allowed || allowed.has(t)))
    .slice(0, GROUP_TITLES.length);
  return { tags: ids, days: days === '7' ? 7 : days === '30' ? 30 : null };
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** 抓片单的一页（20 部）。回的是 TikTok 的原始 JSON，交给 parseDramaList 整理 */
export async function fetchDramaPage(
  theme: number,
  cursor: string,
  filter?: DramaFilter
): Promise<any> {
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
  if (filter?.tags.length) q.set('tagIDList', filter.tags.join(','));
  if (filter?.days) q.set('categoryDateType', filter.days === 7 ? '1' : '2');
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

/** TikTok 短剧页上方那排筛选选项 */
export async function fetchCategories(): Promise<DramaCategoryGroup[]> {
  const q = new URLSearchParams({
    aid: '1988',
    app_name: 'tiktok_web',
    device_platform: 'web_pc',
    app_language: 'zh-Hant-TW',
    language: 'zh-Hant-TW',
    region: 'TW',
    priority_region: 'TW',
  });
  const res = await fetch(
    `https://www.tiktok.com/api/drama/filter/category_list/?${q}`,
    {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.tiktok.com/shortdrama',
      },
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`TikTok 回应 HTTP ${res.status}`);
  const text = await res.text();
  return text ? parseCategories(JSON.parse(text)) : [];
}
