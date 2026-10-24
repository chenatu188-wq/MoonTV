/**
 * 音乐分区的「我的最爱」歌单。纯函数，存在这台装置的 localStorage。
 */
import type { YtVideo } from '@/lib/ai-manju-youtube';

export const MUSIC_FAVORITES_KEY = 'moontv_music_favorites';
export const MAX_FAVORITES = 500;
const ID = /^[\w-]{11}$/;

export interface FavoriteSong {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  addedAt: number;
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.slice(0, max) : '';

/** localStorage 读回来的东西不一定可信：挡掉坏的、重复的，最多留 MAX_FAVORITES 首 */
export function sanitizeFavorites(raw: unknown): FavoriteSong[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FavoriteSong[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const videoId = str(o.videoId, 11);
    if (!ID.test(videoId) || seen.has(videoId)) continue;
    seen.add(videoId);
    out.push({
      videoId,
      title: str(o.title, 300),
      thumbnail: /^https:\/\//.test(str(o.thumbnail, 500))
        ? str(o.thumbnail, 500)
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channel: str(o.channel, 100),
      addedAt: typeof o.addedAt === 'number' ? o.addedAt : 0,
    });
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

/** 加进最爱（新的排最前面）；已经在里面就拿掉 */
export function toggleFavorite(
  list: FavoriteSong[],
  v: Pick<YtVideo, 'videoId' | 'title' | 'thumbnail' | 'channel'>,
  now = Date.now()
): FavoriteSong[] {
  if (list.some((f) => f.videoId === v.videoId))
    return list.filter((f) => f.videoId !== v.videoId);
  const song: FavoriteSong = {
    videoId: v.videoId,
    title: v.title,
    thumbnail: v.thumbnail,
    channel: v.channel,
    addedAt: now,
  };
  return [song, ...list].slice(0, MAX_FAVORITES);
}

/** 拿最爱清单去播：补齐播放清单要的栏位 */
export function favoritesAsVideos(list: FavoriteSong[]): YtVideo[] {
  return list.map((f) => ({
    videoId: f.videoId,
    title: f.title,
    thumbnail: f.thumbnail,
    channel: f.channel,
    channelId: '',
    channelUrl: '',
    published: '',
    description: '',
    views: null,
    sourceKey: 'music-favorites',
    sourceName: '我的最爱',
    seconds: 0,
    meta: f.channel,
  }));
}
