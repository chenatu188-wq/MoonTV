import { NextResponse } from 'next/server';

import {
  AI_MANJU_SOURCES,
  AiManjuSource,
  feedUrl,
} from '@/lib/ai-manju-sources';
import { getCacheTime } from '@/lib/config';

// 自架 Docker 环境下 edge 是模拟的，对外抓取用 Node.js runtime 比较稳
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

interface FetchResult {
  videos: AiManjuVideo[];
  /** 失败原因，成功时为 null。会回给前端，方便线上直接看到问题 */
  error: string | null;
}

async function fetchSource(source: AiManjuSource): Promise<FetchResult> {
  try {
    const res = await fetch(feedUrl(source), {
      // YouTube 会挡看起来像脚本的请求，headers 尽量贴近真实浏览器
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { videos: [], error: `HTTP ${res.status}` };
    }

    const xml = await res.text();
    const videos = parseFeed(xml, source);
    if (videos.length === 0) {
      // 拿到 200 但解析不出东西，多半是被挡后回了同意页/验证页
      return { videos: [], error: `解析到 0 笔（回应 ${xml.length} 字元）` };
    }
    return { videos, error: null };
  } catch (e) {
    // 单一来源挂掉不影响其他来源
    return {
      videos: [],
      error: `${(e as Error).name}: ${(e as Error).message}`,
    };
  }
}

export async function GET() {
  const results = await Promise.all(AI_MANJU_SOURCES.map(fetchSource));

  // 跨来源去重（同一支片可能同时在频道和播放列表里）
  const seen = new Set<string>();
  const videos: AiManjuVideo[] = [];
  for (const v of results.flatMap((r) => r.videos)) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    videos.push(v);
  }

  videos.sort((a, b) => b.published.localeCompare(a.published));

  const failed = results
    .map((r, i) => ({ name: AI_MANJU_SOURCES[i].name, error: r.error }))
    .filter((f): f is { name: string; error: string } => f.error !== null);

  const cacheTime = await getCacheTime();
  return NextResponse.json(
    {
      videos,
      sources: AI_MANJU_SOURCES.map((s) => ({ key: s.key, name: s.name })),
      failed,
    },
    {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
      },
    }
  );
}
