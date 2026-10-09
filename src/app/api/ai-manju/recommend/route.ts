import { NextResponse } from 'next/server';

import { pickRecommended } from '@/lib/ai-manju-recommend';
import { AI_MANJU_SOURCES } from '@/lib/ai-manju-sources';
import {
  type YtVideo,
  searchAll,
  SP_VIDEO_THIS_WEEK,
} from '@/lib/ai-manju-youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 推荐榜：用几组关键字搜 YouTube 本周上传的影片，去掉已经内建追踪的频道，
 * 剩下的一个频道挑一支。使用者看到喜欢的再在播放器按「追踪此频道」。
 * （使用者自己另外追踪的频道存在他的浏览器里，由前端再滤一次。）
 */
const QUERIES = [
  'AI漫剧 全集',
  'AI短剧 全集',
  '漫剧 全集 新番',
  '动态漫 全集',
  'AI漫劇 全集',
  'AI動漫 短劇 全集',
  '沙雕动画 全集 一口气看完',
];

/** 搜寻结果几小时内变化不大，3 小时抓一次 */
const FRESH_MS = 3 * 60 * 60 * 1000;
let cache: { videos: YtVideo[]; at: number } | null = null;
let inflight: Promise<YtVideo[]> | null = null;

async function load(): Promise<YtVideo[]> {
  const batches = await Promise.all(
    QUERIES.map((q) => searchAll(q, SP_VIDEO_THIS_WEEK).catch(() => []))
  );
  if (batches.every((b) => b.length === 0))
    throw new Error('YouTube 搜寻全部失败');
  const tracked = AI_MANJU_SOURCES.filter((s) => s.type === 'channel').map(
    (s) => s.id
  );
  return pickRecommended(batches, tracked, 60);
}

export async function GET() {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    try {
      inflight ??= load().finally(() => {
        inflight = null;
      });
      cache = { videos: await inflight, at: Date.now() };
    } catch (e) {
      // 一时搜不到就沿用旧的；连旧的都没有才报错
      if (!cache) {
        return NextResponse.json(
          { error: `读不到推荐：${(e as Error).message}` },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }
  return NextResponse.json(
    {
      videos: cache.videos.map((v) => ({ ...v, description: '' })),
      updated: Math.floor(cache.at / 1000),
    },
    { headers: { 'Cache-Control': 'private, max-age=1800' } }
  );
}
