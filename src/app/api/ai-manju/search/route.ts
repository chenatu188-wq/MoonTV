import { NextRequest, NextResponse } from 'next/server';

import { episodeOf, seasonOf } from '@/lib/ai-manju-series';
import { AI_MANJU_SOURCES, CHANNEL_ID_RE } from '@/lib/ai-manju-sources';
import { searchAll, searchChannel, YtVideo } from '@/lib/ai-manju-youtube';
import { toSimplifiedFull } from '@/lib/t2s-table';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AiManjuSearchVideo extends YtVideo {
  /** 标题里确实含有这部剧的名字（否则只是 YouTube 觉得相关） */
  match: boolean;
  /** 标题写的季数；没写是 null */
  season: number | null;
  /** 标题写的集数（一支影片一集的连载）；没写是 null */
  episode: number | null;
}

/** 同一部剧的搜寻结果短时间内不会变，缓存一小时 */
const FRESH_MS = 60 * 60 * 1000;
const cache = new Map<string, { videos: AiManjuSearchVideo[]; at: number }>();

/** 比对用：转简体、去掉标点空白。YouTube 标题繁简都有，红果片名是简体 */
function norm(s: string): string {
  return toSimplifiedFull(s)
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

/** 片名去掉「第三季」「2」这类季数尾巴，同一部剧的各季都算命中 */
function coreOf(title: string): string {
  return norm(
    title
      .replace(/[:：]?第[一二三四五六七八九十百\d]+[季集话話].*$/, '')
      .replace(/\d+$/, '')
  );
}

/**
 * 搜一部剧。带 channel 时会同时在那个频道内搜，
 * 这样同一个频道发的各季会被找齐（全站搜寻常常只回最热门的几季）。
 */
async function search(q: string, channel: string | null) {
  const core = coreOf(q);
  // 搜寻用不含季数的剧名，才找得到所有季
  const query =
    q.replace(/[:：]?第[一二三四五六七八九十\d]+季.*$/, '').trim() || q;

  const [inChannel, all] = await Promise.all([
    channel
      ? searchChannel(channel, query).catch(() => [])
      : Promise.resolve([]),
    searchAll(query).catch((e) => {
      if (!channel) throw e;
      return [];
    }),
  ]);

  const seen = new Set<string>();
  const out: AiManjuSearchVideo[] = [];
  for (const v of [...inChannel, ...all]) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    out.push({
      ...v,
      match: core.length >= 3 && norm(v.title).includes(core),
      season: seasonOf(v.title),
      episode: episodeOf(v.title),
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  const channelRaw = request.nextUrl.searchParams.get('channel');
  const channel =
    channelRaw && CHANNEL_ID_RE.test(channelRaw) ? channelRaw : null;
  if (!q || q.length > 80) {
    return NextResponse.json({ error: '缺少片名' }, { status: 400 });
  }

  const key = `${q}|${channel ?? ''}`;
  try {
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      hit = { videos: await search(q, channel), at: Date.now() };
      cache.set(key, hit);
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    }

    const builtin = new Set(AI_MANJU_SOURCES.map((s) => s.id));
    const rank = (v: AiManjuSearchVideo) =>
      v.channelId === channel ? 0 : builtin.has(v.channelId) ? 1 : 2;
    const isFull = (v: AiManjuSearchVideo) => Number(v.seconds >= 600);
    const matchedEpisodes = hit.videos.filter(
      (v) => v.match && v.episode !== null
    );
    // 一支影片一集的连载（《云上双花第8集》）：每集只有几分钟，不能再用片长分正片
    const episodic = matchedEpisodes.length >= 3;

    // 排序（由先到后）：片名吻合 →
    //   连载：有写集数的在前，照季数、集数由小到大
    //   其他：正片（10 分钟以上，把预告和片段压到后面）→ 照季数由小到大
    // → 指定频道 > 内建追踪清单里的频道 > 其他
    const videos = [...hit.videos].sort((a, b) => {
      const byMatch = Number(b.match) - Number(a.match);
      if (byMatch || !a.match) return byMatch || rank(a) - rank(b);
      if (episodic) {
        return (
          Number(b.episode !== null) - Number(a.episode !== null) ||
          (a.season ?? 1) - (b.season ?? 1) ||
          (a.episode ?? 0) - (b.episode ?? 0) ||
          rank(a) - rank(b)
        );
      }
      return (
        isFull(b) - isFull(a) ||
        Number(b.season !== null) - Number(a.season !== null) ||
        (a.season ?? 0) - (b.season ?? 0) ||
        rank(a) - rank(b)
      );
    });

    const seasons = Array.from(
      new Set(
        videos
          .filter((v) => v.match && v.season !== null)
          .map((v) => v.season as number)
      )
    ).sort((a, b) => a - b);

    return NextResponse.json(
      {
        q,
        videos,
        matched: videos.filter((v) => v.match).length,
        seasons,
        episodes: episodic
          ? Array.from(
              new Set(matchedEpisodes.map((v) => v.episode as number))
            ).sort((a, b) => a - b)
          : [],
      },
      { headers: { 'Cache-Control': 'private, max-age=600' } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: `搜寻失败：${(e as Error).message}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
