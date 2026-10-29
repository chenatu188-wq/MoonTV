import { NextResponse } from 'next/server';

import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { fetchSources } from '@/lib/ai-manju-feed';
import { hotRank } from '@/lib/ai-manju-hot';
import { AI_MANJU_SOURCES, AiManjuSource } from '@/lib/ai-manju-sources';
import { aiManjuHref } from '@/lib/video-links';

import { GET as getFollows } from '@/app/api/ai-manju/follows/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 首页「热门 AI 漫剧」：追踪频道（内建＋全站共用清单）本周热门前 20，
 * 跟 AI 漫剧页「本周热门」同一套算法。在这里算好只回 20 笔，
 * 首页不用下载整份上千支影片的清单。10 分钟重算一次。
 */
const LIMIT = 20;
const FRESH_MS = 10 * 60 * 1000;

export interface WeekHotItem {
  key: string;
  title: string;
  thumbnail: string;
  views: number;
  /** 本周这部剧发了几支 */
  count: number;
  /** 点了直接在 AI 漫剧页打开这支的播放器 */
  href: string;
}

let cache: { items: WeekHotItem[]; at: number } | null = null;
let inflight: Promise<WeekHotItem[]> | null = null;

async function compute(): Promise<WeekHotItem[]> {
  const shared: { follows?: { type: string; id: string }[] } = await (
    await getFollows()
  ).json();
  const builtin = new Set(AI_MANJU_SOURCES.map((s) => s.id));
  const extra: AiManjuSource[] = (shared.follows ?? [])
    .filter(
      (f) =>
        (f.type === 'channel' || f.type === 'playlist') && !builtin.has(f.id)
    )
    .map((f) => ({
      key: f.id,
      name: f.id,
      type: f.type as 'channel' | 'playlist',
      id: f.id,
    }));
  const results = await fetchSources([...AI_MANJU_SOURCES, ...extra]);

  const seen = new Set<string>();
  const videos: AiManjuVideo[] = [];
  for (const v of results.flatMap((r) => r.videos)) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    videos.push(v);
  }

  return hotRank(videos, 7, LIMIT).map((h) => ({
    key: h.video.videoId,
    title: h.series ?? h.video.title,
    thumbnail: h.video.thumbnail,
    views: h.views,
    count: h.count,
    href: aiManjuHref(h.video),
  }));
}

export async function GET() {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    try {
      if (!inflight) inflight = compute().finally(() => (inflight = null));
      const items = await inflight;
      // 一次全抓不到（得到空榜）就沿用旧的
      if (items.length > 0 || !cache) cache = { items, at: Date.now() };
    } catch (e) {
      if (!cache) {
        return NextResponse.json(
          { error: `读不到本周热门：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    { items: cache.items },
    { headers: { 'Cache-Control': 'public, max-age=600' } }
  );
}
