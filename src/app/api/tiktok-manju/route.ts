import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TiktokManjuVideo {
  id: string;
  handle: string;
  name: string;
  title: string;
  /** Unix 秒 */
  published: number;
  thumbnail: string;
  views: number | null;
  duration: number | null;
}

export interface TiktokManjuData {
  /** 资料产生时间，Unix 秒 */
  updated: number;
  accounts: { handle: string; name: string }[];
  videos: TiktokManjuVideo[];
  failed: { handle: string; error: string; stale: boolean }[];
}

/**
 * TikTok 没有 RSS，帐号的影片清单只能用 yt-dlp 抓，而 yt-dlp 没办法跑在这个容器里。
 * 所以改由站长的 Mac 定时抓（~/projects/tiktok-manju，launchd 每 6 小时），
 * 结果推到这个 repo 的 tiktok-data 分支，这里只负责读那份 JSON。
 * 追踪名单也在 Mac 上（tiktok-follow add @帐号），不在这个 repo 里。
 */
const DATA_URL =
  'https://raw.githubusercontent.com/chenatu188-wq/MoonTV/tiktok-data/tiktok.json';

/** 伺服器记忆体缓存，免得每次开页都去打 GitHub */
const FRESH_MS = 5 * 60 * 1000;
let cache: { data: TiktokManjuData; at: number } | null = null;

export async function GET() {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache = { data: (await res.json()) as TiktokManjuData, at: Date.now() };
    } catch (e) {
      // GitHub 一时抓不到就沿用旧的；连旧的都没有才报错
      if (!cache) {
        return NextResponse.json(
          { error: `读不到 TikTok 资料：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }

  return NextResponse.json(cache.data, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
