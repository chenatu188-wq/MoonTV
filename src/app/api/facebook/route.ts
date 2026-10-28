import { NextResponse } from 'next/server';

import {
  type PendingFbFollow,
  listFbPending,
  settleFb,
} from '@/lib/fb-follows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FbVideo {
  id: string;
  /** 影片网址，给 FB 嵌入播放器用 */
  href: string;
  title: string;
  thumbnail: string;
  page: string;
  name: string;
  /** 在粉专影片页的顺序，0 是最新 */
  order: number;
  /**
   * 影片档直连（Mac 用 yt-dlp 拿的，约 4 天过期）。很多重新上传的短剧 FB 不准嵌入，
   * 有这个就用网页自己的播放器播，不靠 FB 嵌入播放器
   */
  mp4?: string;
}

export interface FbData {
  /** 资料产生时间，Unix 秒；还没有资料是 0 */
  updated: number;
  pages: { page: string; name: string }[];
  videos: FbVideo[];
  failed: { page: string; error: string; stale: boolean }[];
  pending?: PendingFbFollow[];
}

/**
 * FB 不给没登入的程式读粉专影片，所以跟 TikTok 漫剧一样由站长的 Mac 定时抓
 * （~/projects/tiktok-manju/douyin/fb.mjs，无头浏览器、不登入），
 * 结果推到这个 repo 的 tiktok-data 分支，这里只负责读那份 JSON。
 */
const DATA_URL =
  'https://raw.githubusercontent.com/chenatu188-wq/MoonTV/tiktok-data/fb.json';
const FRESH_MS = 5 * 60 * 1000;
const FRESH_PENDING_MS = 45 * 1000;
let cache: { data: FbData; at: number } | null = null;

const EMPTY: FbData = { updated: 0, pages: [], videos: [], failed: [] };

/** Mac 推上来的东西也当不可信：网址只收 FB 的 https */
function sanitize(raw: FbData): FbData {
  const fb = (u: unknown) =>
    typeof u === 'string' &&
    /^https:\/\/([\w-]+\.)*(facebook\.com|fbcdn\.net)\//.test(u);
  return {
    updated: Number(raw.updated) || 0,
    pages: (raw.pages ?? []).filter((p) => p && typeof p.page === 'string'),
    videos: (raw.videos ?? [])
      .filter(
        (v) =>
          v && /^\d{8,25}$/.test(String(v.id)) && fb(v.href) && fb(v.thumbnail)
      )
      .map((v) => ({
        ...v,
        mp4:
          typeof v.mp4 === 'string' &&
          /^https:\/\/[\w.-]+\.fbcdn\.net\//.test(v.mp4)
            ? v.mp4
            : undefined,
      })),
    failed: raw.failed ?? [],
  };
}

export async function GET() {
  const fresh = listFbPending().length > 0 ? FRESH_PENDING_MS : FRESH_MS;
  if (!cache || Date.now() - cache.at > fresh) {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      // 还没追踪任何粉专时 Mac 不会推这个档
      if (res.status === 404) cache = { data: EMPTY, at: Date.now() };
      else if (!res.ok) throw new Error(`HTTP ${res.status}`);
      else cache = { data: sanitize(await res.json()), at: Date.now() };
    } catch (e) {
      if (!cache) {
        return NextResponse.json(
          { error: `读不到 FB 资料：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }

  settleFb([
    ...cache.data.pages.map((p) => p.page),
    ...cache.data.failed.map((f) => f.page),
  ]);
  const pending = listFbPending();
  return NextResponse.json(
    { ...cache.data, pending },
    {
      headers: {
        'Cache-Control': pending.length ? 'no-store' : 'private, max-age=300',
      },
    }
  );
}
