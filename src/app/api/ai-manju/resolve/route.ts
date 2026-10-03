import { NextRequest, NextResponse } from 'next/server';

import { decodeEntities, fetchSource, YT_HEADERS } from '@/lib/ai-manju-feed';
import {
  AI_MANJU_SOURCES,
  AiManjuSource,
  CHANNEL_ID_RE,
  PLAYLIST_ID_RE,
} from '@/lib/ai-manju-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Target =
  | { kind: 'channel'; id: string }
  | { kind: 'playlist'; id: string }
  /** 需要再抓一次 YouTube 页面才能反查出频道 id */
  | { kind: 'page'; url: string };

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * 把使用者贴的东西归类。支援：
 * - 频道 id（UCxxxx）、播放列表 id（PLxxxx）
 * - @handle
 * - 频道网址：/channel/UCxxxx、/@handle、/c/名称、/user/名称
 * - 播放列表网址：?list=PLxxxx
 * - 影片网址：watch?v=、youtu.be/、/shorts/（追踪该影片的发布频道）
 *
 * 回 null 代表看不懂。只会产生 youtube.com 的网址，不抓其他站。
 */
function classify(input: string): Target | null {
  const q = input.trim();
  if (!q || q.length > 300) return null;

  if (CHANNEL_ID_RE.test(q)) return { kind: 'channel', id: q };
  if (PLAYLIST_ID_RE.test(q)) return { kind: 'playlist', id: q };
  if (/^@[\w.\-·-￿]{2,60}$/.test(q)) {
    return {
      kind: 'page',
      url: `https://www.youtube.com/${encodeURI(q)}`,
    };
  }

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(q) ? q : `https://${q}`);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null;

  const path = u.pathname;

  const channelMatch = /^\/channel\/(UC[\w-]{22})/.exec(path);
  if (channelMatch) return { kind: 'channel', id: channelMatch[1] };

  // 纯播放列表页才当播放列表；watch?v=..&list=.. 视为「想追这支片的频道」
  const list = u.searchParams.get('list');
  if (path === '/playlist' && list && PLAYLIST_ID_RE.test(list)) {
    return { kind: 'playlist', id: list };
  }

  let videoId = '';
  if (u.hostname.toLowerCase() === 'youtu.be') videoId = path.slice(1);
  else if (path === '/watch') videoId = u.searchParams.get('v') ?? '';
  else videoId = /^\/(?:shorts|live|embed)\/([\w-]+)/.exec(path)?.[1] ?? '';
  if (/^[\w-]{11}$/.test(videoId)) {
    return {
      kind: 'page',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  // /@handle、/c/xxx、/user/xxx：只取第一段，丢掉 /videos 之类的后缀
  const named = /^\/(@[^/]+|c\/[^/]+|user\/[^/]+)/.exec(path);
  if (named) {
    return { kind: 'page', url: `https://www.youtube.com/${named[1]}` };
  }

  return null;
}

/** 抓 YouTube 页面，从 HTML 里反查频道 id 与频道名 */
async function channelFromPage(
  url: string
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(url, {
    headers: { ...YT_HEADERS, Accept: 'text/html,*/*;q=0.8' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`YouTube 回应 HTTP ${res.status}`);
  const html = await res.text();

  const isVideo = url.includes('/watch?v=');
  const patterns = isVideo
    ? [/"channelId":"(UC[\w-]{22})"/]
    : [
        /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/,
        /"externalId":"(UC[\w-]{22})"/,
        /channel_id=(UC[\w-]{22})/,
      ];
  const nameRe = isVideo
    ? /"ownerChannelName":"([^"\\]+)"/
    : /<meta property="og:title" content="([^"]+)"/;
  const name = decodeEntities(nameRe.exec(html)?.[1] ?? '');

  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return { id: m[1], name };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const target = classify(q);
  if (!target) {
    return NextResponse.json(
      {
        error:
          '看不懂这个输入。请贴 YouTube 频道网址、@帐号、播放列表网址，或该频道任一支影片的网址',
      },
      { status: 400 }
    );
  }

  try {
    let type: AiManjuSource['type'];
    let id: string;
    let pageName = '';

    if (target.kind === 'page') {
      const found = await channelFromPage(target.url);
      if (!found) {
        return NextResponse.json(
          {
            error:
              '找不到这个帐号的频道 ID（可能帐号不存在，或 YouTube 挡了这次查询）。可以改贴该频道任一支影片的网址再试',
          },
          { status: 404 }
        );
      }
      type = 'channel';
      id = found.id;
      pageName = found.name;
    } else {
      type = target.kind;
      id = target.id;
    }

    const builtin = AI_MANJU_SOURCES.find((s) => s.id === id);
    if (builtin) {
      return NextResponse.json(
        { error: `「${builtin.name}」已经是内建来源，不用再加` },
        { status: 409 }
      );
    }

    // 实际抓一次 RSS：确认抓得到，顺便拿名称
    const probe = await fetchSource({ key: id, name: id, type, id });
    // 从页面反查出来的频道确定存在，RSS 一时抓不到（YouTube 端不稳）也先让它加；
    // 直接贴 id 的没有别的佐证，抓不到就不收，免得存进不存在的来源
    if (probe.error && target.kind !== 'page') {
      return NextResponse.json(
        {
          error: `这个来源的 RSS 抓不到：${probe.error}。YouTube 的 RSS 偶尔不稳，过一会再试；若一直失败请确认 ID 是否正确`,
        },
        { status: 502 }
      );
    }

    const latest = probe.videos[0]?.published ?? null;
    return NextResponse.json({
      type,
      id,
      name: probe.feedTitle || pageName || probe.videos[0]?.channel || id,
      // RSS 这次没抓到，前端据此提示「已加入，影片稍后才会出现」
      pending: probe.error !== null,
      videoCount: probe.videos.length,
      latest,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `查询失败：${(e as Error).message}` },
      { status: 502 }
    );
  }
}
