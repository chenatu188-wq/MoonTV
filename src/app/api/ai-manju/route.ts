import { NextRequest, NextResponse } from 'next/server';

import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { fetchSources } from '@/lib/ai-manju-feed';
import {
  AI_MANJU_SOURCES,
  AiManjuSource,
  isValidSourceId,
  MAX_CUSTOM_SOURCES,
} from '@/lib/ai-manju-sources';
import { getCacheTime } from '@/lib/config';

export type { AiManjuVideo } from '@/lib/ai-manju-feed';

// 自架 Docker 环境下 edge 是模拟的，对外抓取用 Node.js runtime 比较稳
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 解析使用者自订来源。格式：?extra=c:UCxxxx,p:PLxxxx
 * 清单存在浏览器 localStorage，每次请求带上来；这里只收合法的 id，
 * 且只会拿去拼 youtube.com 的 RSS 网址，不会抓任意网址。
 */
function parseExtra(raw: string | null): AiManjuSource[] {
  if (!raw) return [];
  const builtin = new Set(AI_MANJU_SOURCES.map((s) => s.id));
  const seen = new Set<string>();
  const out: AiManjuSource[] = [];

  for (const token of raw.split(',')) {
    const [prefix, id] = token.split(':');
    const type =
      prefix === 'c' ? 'channel' : prefix === 'p' ? 'playlist' : null;
    if (!type || !id || !isValidSourceId(type, id)) continue;
    if (builtin.has(id) || seen.has(id)) continue;
    seen.add(id);
    // key 直接用 id，前端用它对回自己存的名称
    out.push({ key: id, name: id, type, id });
    if (out.length >= MAX_CUSTOM_SOURCES) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const extra = parseExtra(request.nextUrl.searchParams.get('extra'));
  const allSources = [...AI_MANJU_SOURCES, ...extra];
  const results = await fetchSources(allSources);

  // 跨来源去重（同一支片可能同时在频道和播放列表里）
  const seen = new Set<string>();
  const videos: AiManjuVideo[] = [];
  for (const v of results.flatMap((r) => r.videos)) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    // 页面没用到简介；上千支影片时拿掉它，回应可以小一半
    videos.push({ ...v, description: '' });
  }

  videos.sort((a, b) => b.published.localeCompare(a.published));

  const failed = results
    .map((r, i) => ({
      key: allSources[i].key,
      name: allSources[i].name,
      error: r.error,
    }))
    .filter(
      (f): f is { key: string; name: string; error: string } => f.error !== null
    );

  const cacheTime = await getCacheTime();
  return NextResponse.json(
    {
      videos,
      // 只回内建来源；自订来源的名称由前端自己保管
      sources: AI_MANJU_SOURCES.map((s) => ({
        key: s.key,
        name: s.name,
        id: s.id,
      })),
      failed,
    },
    {
      headers: {
        // 有来源失败就不缓存：否则一次全挂的结果会被浏览器留两小时，
        // 重新整理也救不回来。带 extra 的回应因人而异，不给共享缓存存
        'Cache-Control': failed.length
          ? 'no-store'
          : extra.length
          ? `private, max-age=${Math.min(cacheTime, 600)}`
          : `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
      },
    }
  );
}
