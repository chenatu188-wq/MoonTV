/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { YT_HEADERS } from '@/lib/ai-manju-feed';
import { AI_MANJU_SOURCES } from '@/lib/ai-manju-sources';
import { toSimplified } from '@/lib/cn-converter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AiManjuSearchVideo extends AiManjuVideo {
  channelId: string;
  /** 标题里确实含有这部剧的名字（否则只是 YouTube 觉得相关） */
  match: boolean;
}

/** 同一部剧的搜寻结果短时间内不会变，缓存一小时 */
const FRESH_MS = 60 * 60 * 1000;
const cache = new Map<string, { videos: AiManjuSearchVideo[]; at: number }>();

/** 比对用：转简体、去掉标点空白。YouTube 标题繁简都有，红果片名是简体 */
function norm(s: string): string {
  return toSimplified(s)
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

/** 片名去掉「第三季」「2」这类季数尾巴，同一部剧的各季都算命中 */
function coreOf(title: string): string {
  return norm(
    title
      .replace(/[:：]?第[一二三四五六七八九十\d]+季.*$/, '')
      .replace(/\d+$/, '')
  );
}

/** 把巢状 JSON 里所有 videoRenderer 捞出来 */
function collect(o: any, out: any[] = []): any[] {
  if (Array.isArray(o)) {
    o.forEach((v) => collect(v, out));
  } else if (o && typeof o === 'object') {
    if (o.videoRenderer) out.push(o.videoRenderer);
    Object.values(o).forEach((v) => collect(v, out));
  }
  return out;
}

const text = (o: any): string =>
  o?.simpleText ?? (o?.runs ?? []).map((r: any) => r.text).join('') ?? '';

async function searchYoutube(q: string): Promise<AiManjuSearchVideo[]> {
  const res = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    {
      headers: { ...YT_HEADERS, Accept: 'text/html,*/*;q=0.8' },
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`YouTube 回应 HTTP ${res.status}`);
  const html = await res.text();
  const m = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(html);
  if (!m) throw new Error('YouTube 没有回传搜寻结果（可能被挡）');

  const core = coreOf(q);
  const seen = new Set<string>();
  const out: AiManjuSearchVideo[] = [];
  for (const v of collect(JSON.parse(m[1]))) {
    const videoId: string | undefined = v.videoId;
    const owner = v.ownerText?.runs?.[0];
    const channelId: string | undefined =
      owner?.navigationEndpoint?.browseEndpoint?.browseId;
    if (!videoId || !channelId || seen.has(videoId)) continue;
    seen.add(videoId);

    const title = text(v.title);
    const meta = [
      text(v.lengthText),
      text(v.publishedTimeText),
      text(v.viewCountText),
    ]
      .filter(Boolean)
      .join(' · ');
    out.push({
      videoId,
      title,
      channel: owner.text ?? '',
      channelUrl: `https://www.youtube.com/channel/${channelId}`,
      channelId,
      published: '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      description: '',
      views: null,
      sourceKey: channelId,
      sourceName: owner.text ?? '',
      meta,
      match: core.length >= 3 && norm(title).includes(core),
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 80) {
    return NextResponse.json({ error: '缺少片名' }, { status: 400 });
  }

  try {
    let hit = cache.get(q);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      hit = { videos: await searchYoutube(q), at: Date.now() };
      cache.set(q, hit);
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    }

    // 排序：片名命中的在前；同样命中时，内建追踪清单里的频道在前
    const builtin = new Set(AI_MANJU_SOURCES.map((s) => s.id));
    const score = (v: AiManjuSearchVideo) =>
      (v.match ? 2 : 0) + (builtin.has(v.channelId) ? 1 : 0);
    const videos = [...hit.videos].sort((a, b) => score(b) - score(a));

    return NextResponse.json(
      { q, videos, matched: videos.filter((v) => v.match).length },
      { headers: { 'Cache-Control': 'private, max-age=600' } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: `搜寻失败：${(e as Error).message}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
