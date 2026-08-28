import { NextResponse } from 'next/server';

import {
  AI_MANJU_SOURCES,
  AiManjuSource,
  feedUrl,
} from '@/lib/ai-manju-sources';
import { getCacheTime } from '@/lib/config';

export const runtime = 'edge';

export interface AiManjuVideo {
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string;
  published: string;
  thumbnail: string;
  description: string;
  views: number | null;
  sourceKey: string;
  sourceName: string;
}

/** 取第一个匹配分组，取不到回空字符串 */
function pick(block: string, re: RegExp): string {
  return re.exec(block)?.[1] ?? '';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 解析 YouTube 的 Atom feed。
 * 结构固定（yt:videoId / media:thumbnail / media:statistics），
 * edge runtime 没有可靠的 DOMParser，所以用正则拆。
 */
function parseFeed(xml: string, source: AiManjuSource): AiManjuVideo[] {
  const out: AiManjuVideo[] = [];
  const entries = xml.split('<entry>').slice(1);

  for (const raw of entries) {
    const block = raw.split('</entry>')[0];
    const videoId = pick(block, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!videoId) continue;

    const viewsRaw = pick(block, /<media:statistics views="(\d+)"/);

    out.push({
      videoId,
      title: decodeEntities(
        pick(block, /<media:title>([^<]*)<\/media:title>/) ||
          pick(block, /<title>([^<]*)<\/title>/)
      ),
      channel: decodeEntities(pick(block, /<name>([^<]*)<\/name>/)),
      channelUrl: pick(block, /<uri>([^<]*)<\/uri>/),
      published: pick(block, /<published>([^<]+)<\/published>/),
      thumbnail:
        pick(block, /<media:thumbnail url="([^"]+)"/) ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      description: decodeEntities(
        pick(block, /<media:description>([\s\S]*?)<\/media:description>/)
      ).slice(0, 200),
      views: viewsRaw ? Number(viewsRaw) : null,
      sourceKey: source.key,
      sourceName: source.name,
    });
  }

  return out;
}

async function fetchSource(source: AiManjuSource): Promise<AiManjuVideo[]> {
  try {
    const res = await fetch(feedUrl(source), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), source);
  } catch {
    // 单一来源挂掉不影响其他来源
    return [];
  }
}

export async function GET() {
  const results = await Promise.all(AI_MANJU_SOURCES.map(fetchSource));

  // 跨来源去重（同一支片可能同时在频道和播放列表里）
  const seen = new Set<string>();
  const videos: AiManjuVideo[] = [];
  for (const v of results.flat()) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    videos.push(v);
  }

  videos.sort((a, b) => b.published.localeCompare(a.published));

  const cacheTime = await getCacheTime();
  return NextResponse.json(
    {
      videos,
      sources: AI_MANJU_SOURCES.map((s) => ({ key: s.key, name: s.name })),
      failed: results.reduce(
        (n, list, i) =>
          list.length === 0 ? [...n, AI_MANJU_SOURCES[i].name] : n,
        [] as string[]
      ),
    },
    {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
      },
    }
  );
}
