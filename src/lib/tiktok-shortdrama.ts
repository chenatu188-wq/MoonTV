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
