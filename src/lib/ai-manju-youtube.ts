/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { YT_HEADERS } from '@/lib/ai-manju-feed';

/**
 * RSS 每个来源只给最新 15 支，要看频道完整清单或在频道内搜寻，
 * 得走 YouTube 网页自己用的内部介面（youtubei）。不需要 API key，
 * 但格式没有公开文件，YouTube 改版时这里可能要跟着改。
 */
const CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20250101.00.00',
    hl: 'zh-TW',
    gl: 'TW',
  },
};

/** 频道「影片」分页 / 频道内搜寻 的固定参数 */
const PARAMS_VIDEOS = 'EgZ2aWRlb3PyBgQKAjoA';
const PARAMS_SEARCH = 'EgZzZWFyY2jyBgQKAloA';
/** YouTube 搜寻的筛选条件：只要影片、本周上传 */
export const SP_VIDEO_THIS_WEEK = 'EgQIAxAB';

export interface YtVideo extends AiManjuVideo {
  channelId: string;
  /** 片长（秒）；拿不到是 0 */
  seconds: number;
}

/** 「1:30:57」→ 秒 */
function toSeconds(s: string | undefined): number {
  if (!s || !/^\d+(:\d{1,2}){1,2}$/.test(s)) return 0;
  return s.split(':').reduce((sum, n) => sum * 60 + Number(n), 0);
}

async function browse(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(
    'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
    {
      method: 'POST',
      headers: { ...YT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: CONTEXT, ...body }),
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`YouTube 回应 HTTP ${res.status}`);
  return res.json();
}

/** 把巢状 JSON 里所有叫 key 的值捞出来 */
function collect(o: any, key: string, out: any[] = []): any[] {
  if (Array.isArray(o)) {
    o.forEach((v) => collect(v, key, out));
  } else if (o && typeof o === 'object') {
    if (key in o) out.push(o[key]);
    Object.values(o).forEach((v) => collect(v, key, out));
  }
  return out;
}

const text = (o: any): string =>
  o?.simpleText ??
  o?.content ??
  (o?.runs ?? []).map((r: any) => r.text).join('') ??
  '';

function make(
  videoId: string,
  title: string,
  meta: string[],
  channel: string,
  channelId: string
): YtVideo {
  return {
    videoId,
    title,
    channel,
    channelId,
    channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : '',
    published: '',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: '',
    views: null,
    sourceKey: channelId,
    sourceName: channel,
    meta: meta.filter(Boolean).join(' · '),
    seconds: toSeconds(meta[0]),
  };
}

/**
 * YouTube 同时存在三种影片卡片格式：
 * videoRenderer（搜寻结果）、lockupViewModel（频道影片分页的新格式）、
 * playlistVideoRenderer（播放列表）。三种都认。
 * fallback：卡片本身没带频道资讯时（频道分页就不带）用这个。
 */
export function parseVideos(
  data: any,
  fallback: { channel: string; channelId: string } = {
    channel: '',
    channelId: '',
  }
): YtVideo[] {
  const out: YtVideo[] = [];
  const seen = new Set<string>();
  const push = (v: YtVideo) => {
    if (v.videoId && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      out.push(v);
    }
  };

  for (const key of ['videoRenderer', 'playlistVideoRenderer']) {
    for (const v of collect(data, key)) {
      const owner = (v.ownerText ?? v.shortBylineText)?.runs?.[0];
      push(
        make(
          v.videoId,
          text(v.title),
          [
            text(v.lengthText),
            text(v.publishedTimeText),
            text(v.viewCountText),
          ],
          owner?.text ?? fallback.channel,
          owner?.navigationEndpoint?.browseEndpoint?.browseId ??
            fallback.channelId
        )
      );
    }
  }

  for (const v of collect(data, 'lockupViewModel')) {
    if (v.contentType && v.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO')
      continue;
    const m = v.metadata?.lockupMetadataViewModel;
    const duration = collect(v.contentImage, 'thumbnailBadgeViewModel')[0]
      ?.text;
    const parts = collect(m?.metadata, 'metadataParts')
      .flat()
      .map((p: any) => text(p.text));
    push(
      make(
        v.contentId,
        text(m?.title),
        [duration, ...parts.reverse()],
        fallback.channel,
        fallback.channelId
      )
    );
  }
  return out;
}

/** 下一页的 token；没有下一页回 null */
function nextToken(data: any): string | null {
  const items = collect(data, 'continuationItemRenderer');
  const tokens = collect(items, 'token');
  // 第一页会有两个 token，实测要用第一个才翻得到下一页
  return tokens.length ? (tokens[0] as string) : null;
}

export interface VideoPage {
  videos: YtVideo[];
  next: string | null;
}

/** 来源的完整影片清单，一页约 30 支（播放列表约 100 支） */
export async function listSource(
  type: 'channel' | 'playlist',
  id: string,
  name: string,
  continuation?: string
): Promise<VideoPage> {
  const data = await browse(
    continuation
      ? { continuation }
      : type === 'channel'
      ? { browseId: id, params: PARAMS_VIDEOS }
      : { browseId: `VL${id}` }
  );
  const fallback =
    type === 'channel' ? { channel: name, channelId: id } : undefined;
  return { videos: parseVideos(data, fallback), next: nextToken(data) };
}

/**
 * 在单一频道内搜寻。一页约 30 支，连载剧动辄上百集，
 * 所以往下多翻几页（最多 4 页），集数才凑得齐。
 */
export async function searchChannel(
  channelId: string,
  query: string
): Promise<YtVideo[]> {
  let data = await browse({
    browseId: channelId,
    params: PARAMS_SEARCH,
    query,
  });
  const name: string = collect(data, 'channelMetadataRenderer')[0]?.title ?? '';
  const fallback = { channel: name, channelId };

  const out = parseVideos(data, fallback);
  const seen = new Set(out.map((v) => v.videoId));
  for (let page = 1; page < 4; page++) {
    const token = nextToken(data);
    if (!token) break;
    data = await browse({ continuation: token });
    const more = parseVideos(data, fallback).filter(
      (v) => !seen.has(v.videoId)
    );
    if (more.length === 0) break;
    more.forEach((v) => seen.add(v.videoId));
    out.push(...more);
  }
  return out;
}

async function searchAllOnce(query: string, sp?: string): Promise<YtVideo[]> {
  const res = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${
      sp ? `&sp=${encodeURIComponent(sp)}` : ''
    }`,
    {
      headers: { ...YT_HEADERS, Accept: 'text/html,*/*;q=0.8' },
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`YouTube 回应 HTTP ${res.status}`);
  const m = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(
    await res.text()
  );
  if (!m) throw new Error('YouTube 没有回传搜寻结果（可能被挡）');
  return parseVideos(JSON.parse(m[1]));
}

/** 全 YouTube 搜寻。YouTube 偶尔会回空页或被挡一下，失败就隔半秒再试一次 */
export async function searchAll(
  query: string,
  sp?: string
): Promise<YtVideo[]> {
  try {
    return await searchAllOnce(query, sp);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    return searchAllOnce(query, sp);
  }
}
