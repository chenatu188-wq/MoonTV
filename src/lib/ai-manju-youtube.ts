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
      signal: AbortSignal.timeout(15_000),
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

/** 频道清单只有相对发布时间，转成近似日期供最新／周月榜排序。 */
function publishedFrom(parts: string[]): string {
  for (const part of parts) {
    const match =
      /(\d+)\s*(秒|分鐘|分钟|小時|小时|天|日|週|周|個月|个月|月|年|seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*(前|ago)/i.exec(
        part
      );
    if (!match) continue;
    const unit = match[2].toLowerCase();
    const seconds = /^(秒|second)/.test(unit)
      ? 1
      : /^(分鐘|分钟|minute)/.test(unit)
      ? 60
      : /^(小時|小时|hour)/.test(unit)
      ? 3600
      : /^(天|日|day)/.test(unit)
      ? 86400
      : /^(週|周|week)/.test(unit)
      ? 7 * 86400
      : /^(個月|个月|月|month)/.test(unit)
      ? 30 * 86400
      : 365 * 86400;
    return new Date(
      Date.now() - Number(match[1]) * seconds * 1000
    ).toISOString();
  }
  return '';
}

function viewsFrom(parts: string[]): number | null {
  const part = parts.find((p) => /觀看|观看|次觀看|次观看|views?/i.test(p));
  if (!part) return null;
  const match = /([\d,]+(?:\.\d+)?)\s*([萬万億亿KMB])?/i.exec(part);
  if (!match) return /無|无|no views/i.test(part) ? 0 : null;
  const unit = (match[2] ?? '').toUpperCase();
  const scale = /[萬万]/.test(unit)
    ? 1e4
    : /[億亿]/.test(unit)
    ? 1e8
    : unit === 'K'
    ? 1e3
    : unit === 'M'
    ? 1e6
    : unit === 'B'
    ? 1e9
    : 1;
  return Math.round(Number(match[1].replace(/,/g, '')) * scale);
}

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
    published: publishedFrom(meta),
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: '',
    views: viewsFrom(meta),
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
 * 频道「影片」分页上方那排「最新／热门／最早」的第二颗（热门）的翻页 token。
 * 用位置而不是文字找：文字会跟着语系变。拿不到回 null。
 */
export function popularToken(data: any): string | null {
  const chip = collect(data, 'chipViewModel')[1];
  return chip?.tapCommand?.innertubeCommand?.continuationCommand?.token ?? null;
}

/**
 * 频道里观看数最高的影片（YouTube 自己的「热门」排序，算的是全部影片，不只最近）。
 * 要打两次：先开影片分页拿到「热门」的 token，再用它换排序。
 * 影片太少的频道没有排序列，直接回它仅有的那几支。
 */
export async function listPopular(
  channelId: string,
  limit = 20
): Promise<YtVideo[]> {
  const first = await browse({ browseId: channelId, params: PARAMS_VIDEOS });
  const name: string =
    collect(first, 'channelMetadataRenderer')[0]?.title ?? '';
  const fallback = { channel: name, channelId };
  const token = popularToken(first);
  let data = token ? await browse({ continuation: token }) : first;
  // 一页约 30 支，要更多（「换一批」）就照热门顺序往下翻，最多 5 页
  const out = parseVideos(data, fallback);
  const seen = new Set(out.map((v) => v.videoId));
  for (let page = 1; page < 5 && out.length < limit; page++) {
    const next = nextToken(data);
    if (!next) break;
    data = await browse({ continuation: next });
    const more = parseVideos(data, fallback).filter(
      (v) => !seen.has(v.videoId)
    );
    if (more.length === 0) break;
    more.forEach((v) => seen.add(v.videoId));
    out.push(...more);
  }
  return out.slice(0, limit);
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
