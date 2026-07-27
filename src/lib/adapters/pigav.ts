/* eslint-disable @typescript-eslint/no-explicit-any */

// PIGAV（朱古力）是 PeerTube 站，不是蘋果 CMS 採集站。
// 這個模組把 PeerTube 的 REST API 翻譯成 MoonTV 內部使用的 SearchResult / browse 形狀，
// 讓現成的搜尋 / 詳情 / 瀏覽 / 播放 / 死源稽核流程無需改動即可吃這個來源。
//
// config.json 內 api 欄位填 `https://pigav.ws/api/v1/videos`：
// - 死源稽核腳本會 GET `{api}?ac=videolist&pg=1`，PeerTube 會忽略雜參並回 { total, data }，因此自然存活。
// - downstream / browse 偵測到 isPigavSite(api) 後改走本模組，不會真的用蘋果 CMS 參數打它。

import { ApiSite } from '@/lib/config';
import { SearchResult } from '@/lib/types';

const PIGAV_API = 'https://pigav.ws/api/v1';
const PAGE_SIZE = 30;
// pigav 的六個分類（/api/v1/videos/categories）
const CATEGORY_IDS = [20, 21, 22, 23, 24, 25];
// 瀏覽每邏輯頁顯示 600 部（對齊其他來源）；PeerTube count 上限 100，故抓 6 個上游頁湊 600
const BROWSE_PAGE_SIZE = 600;
const UPSTREAM_MAX = 100;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

export function isPigavSite(api?: string): boolean {
  return (api || '').includes('pigav.ws');
}

// 包成同源 HLS 代理路徑，繞過 pigav CDN 的 origin 鎖 CORS
function proxied(url: string): string {
  return `/api/hls-proxy?url=${encodeURIComponent(url)}`;
}

interface PeerTubeVideo {
  uuid: string;
  name: string;
  thumbnailPath?: string;
  previewPath?: string;
  category?: { id: number; label: string };
  duration?: number;
  publishedAt?: string;
  originallyPublishedAt?: string | null;
  description?: string;
  truncatedDescription?: string;
  streamingPlaylists?: Array<{ playlistUrl?: string }>;
  files?: Array<{ fileUrl?: string; resolution?: { id?: number } }>;
}

async function ptFetch(path: string): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${PIGAV_API}${path}`, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function yearOf(v: PeerTubeVideo): string {
  const d = v.originallyPublishedAt || v.publishedAt || '';
  const m = d.match(/^(\d{4})/);
  return m ? m[1] : 'unknown';
}

function posterOf(v: PeerTubeVideo): string {
  return v.thumbnailPath || v.previewPath || '';
}

function mapToSearchResult(v: PeerTubeVideo, site: ApiSite): SearchResult {
  return {
    id: v.uuid,
    title: v.name.trim().replace(/\s+/g, ' '),
    poster: posterOf(v),
    episodes: [],
    source: site.key,
    source_name: site.name,
    source_group: site.group,
    class: v.category?.label,
    year: yearOf(v),
    desc: (v.truncatedDescription || v.description || '').trim(),
    type_name: v.category?.label,
  };
}

// 搜尋：episodes 留空，實際播放網址交由 pigavDetail 於 /api/detail 時補上（同一般採集站行為）。
export async function pigavSearch(
  site: ApiSite,
  query: string
): Promise<SearchResult[]> {
  const q = (query || '').trim();
  if (!q) return [];
  const data = await ptFetch(
    `/search/videos?search=${encodeURIComponent(
      q
    )}&count=${PAGE_SIZE}&start=0&nsfw=both`
  );
  const list: PeerTubeVideo[] = data?.data || [];
  return list
    .filter((v) => v && v.uuid && v.name)
    .map((v) => mapToSearchResult(v, site));
}

export async function pigavDetail(
  site: ApiSite,
  id: string
): Promise<SearchResult> {
  const v: PeerTubeVideo | null = await ptFetch(
    `/videos/${encodeURIComponent(id)}`
  );
  if (!v || !v.uuid) {
    throw new Error('获取视频详情失败');
  }

  let episodes: string[] = [];
  const playlistUrl = v.streamingPlaylists?.[0]?.playlistUrl;
  if (playlistUrl) {
    // pigav CDN 鎖 origin，m3u8 / segment 需經同源 HLS 代理才播得動
    episodes = [proxied(playlistUrl)];
  } else if (Array.isArray(v.files) && v.files.length > 0) {
    // 沒有 HLS 時退回直連檔（取最高畫質）
    const best = [...v.files].sort(
      (a, b) => (b.resolution?.id || 0) - (a.resolution?.id || 0)
    )[0];
    if (best?.fileUrl) episodes = [proxied(best.fileUrl)];
  }

  return { ...mapToSearchResult(v, site), episodes };
}

export interface PigavBrowseItem {
  id: string;
  title: string;
  poster: string;
  year: string;
  remarks: string;
  source: string;
  source_name: string;
  episodes: string[];
}

export interface PigavBrowseResult {
  results: PigavBrowseItem[];
  total: number;
  pagecount: number;
}

// 瀏覽：typeId 給定則只回該分類，否則回全部六類（阿公專區彩虹頻道 category=adult）。
export async function pigavBrowse(
  site: ApiSite,
  page: number,
  typeId?: number
): Promise<PigavBrowseResult> {
  const cats = typeId ? [typeId] : CATEGORY_IDS;
  const catParam = cats.map((c) => `&categoryOneOf=${c}`).join('');

  // 每邏輯頁湊 600：抓 BROWSE_PAGE_SIZE/UPSTREAM_MAX 個上游頁並行合併
  const base = (Math.max(1, page) - 1) * BROWSE_PAGE_SIZE;
  const offsets = Array.from(
    { length: Math.ceil(BROWSE_PAGE_SIZE / UPSTREAM_MAX) },
    (_, i) => base + i * UPSTREAM_MAX
  );
  const responses = await Promise.all(
    offsets.map((start) =>
      ptFetch(
        `/videos?count=${UPSTREAM_MAX}&start=${start}&sort=-publishedAt&nsfw=both${catParam}`
      )
    )
  );

  const total: number =
    responses.find((r) => r && typeof r.total === 'number')?.total || 0;
  const seen = new Set<string>();
  const list: PeerTubeVideo[] = responses
    .flatMap((r) => (r?.data as PeerTubeVideo[]) || [])
    .filter(
      (v) => v && v.uuid && v.name && !seen.has(v.uuid) && seen.add(v.uuid)
    );

  const results = list.map((v) => ({
    id: v.uuid,
    title: v.name.trim(),
    poster: posterOf(v),
    year: yearOf(v),
    remarks: v.duration ? `${Math.floor(v.duration / 60)} 分鐘` : '',
    source: site.key,
    source_name: site.name,
    episodes: [] as string[],
  }));
  return {
    results,
    total,
    pagecount: Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE)),
  };
}
