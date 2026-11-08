/**
 * 网站搬家：Zeabur 旧网址 12 月关站。家庭站这些都只存在浏览器 localStorage
 * （线上没有资料库），换网域就看不到：
 * - 收藏夹
 * - AI 漫剧「我的收藏」（含看到第几秒）、「追剧」（含看到第几集）、置顶频道
 *
 * 做法：旧站把资料打包进网址的 # 后面（# 后面的东西不会送到伺服器），
 * 开新站同一页；新站读到就问一声，确认后并进自己的 localStorage。
 * 新站原本有的资料不会被盖掉。
 * （彩虹频道那条分支的版本多搬精选影片和番号清单，资料格式相同。）
 */
import {
  followKey,
  MAX_SERIES_FOLLOWS,
  sanitizeSeriesFollows,
  SERIES_FOLLOWS_KEY,
  SeriesFollow,
} from './ai-manju-series-follow';
import { Favorite } from './types';
import { MAX_MARKS, sanitizeMarks, WatchMark } from './watch-marks';

export const FAVORITES_KEY = 'moontv_favorites';
export const AI_MARKS_KEY = 'moontv_ai_manju_marks';
export const AI_PINS_KEY = 'moontv_ai_manju_pins';
const MAX_PINS = 100;
export const MIGRATE_HASH = 'moontv-migrate=';
/** 压缩过的资料前面加这个字（base64url 用不到 ~） */
const GZIP_MARK = '~';
/** 搬完重新整理后，用这个把结果带到新页面显示 */
export const MIGRATE_DONE_KEY = 'moontv_migrate_done';

export interface MigratePayload {
  v: 1;
  favorites: Record<string, Favorite>;
  aiMarks: WatchMark<unknown>[];
  seriesFollows: SeriesFollow[];
  aiPins: string[];
}

const sanitizePins = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? Array.from(
        new Set(raw.filter((k): k is string => typeof k === 'string' && !!k))
      ).slice(0, MAX_PINS)
    : [];

/** 旧网址 → 新网址；不是 Zeabur 旧网址就回 null（不显示搬家按钮） */
export function newSiteOrigin(host: string): string | null {
  const m = /^([a-z0-9-]+)\.zeabur\.app$/i.exec(host);
  return m ? `https://${m[1]}.up.railway.app` : null;
}

export function sanitizeFavorites(raw: unknown): Record<string, Favorite> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, Favorite> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [key, f] of Object.entries(raw as Record<string, any>)) {
    if (!key.includes('+') || !f || typeof f !== 'object') continue;
    if (typeof f.title !== 'string' || !f.title) continue;
    out[key] = {
      source_name: typeof f.source_name === 'string' ? f.source_name : '',
      total_episodes: Number.isFinite(f.total_episodes) ? f.total_episodes : 0,
      title: f.title,
      year: typeof f.year === 'string' ? f.year : '',
      cover: typeof f.cover === 'string' ? f.cover : '',
      save_time: Number.isFinite(f.save_time) ? f.save_time : 0,
      search_title: typeof f.search_title === 'string' ? f.search_title : '',
    };
  }
  return out;
}

export function sanitizePayload(raw: unknown): MigratePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  return {
    v: 1,
    favorites: sanitizeFavorites(r.favorites),
    aiMarks: sanitizeMarks(r.aiMarks),
    seriesFollows: sanitizeSeriesFollows(r.seriesFollows),
    aiPins: sanitizePins(r.aiPins),
  };
}

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0)
  );

async function pipe(bytes: Uint8Array, stream: GenericTransformStream) {
  const writer = stream.writable.getWriter();
  // 不 await：边写边读，避免缓冲满了卡住
  writer.write(bytes).catch(() => undefined);
  writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** 追剧清单可能很大，浏览器支援就先 gzip 再放进网址（通常小 5～10 倍） */
export async function encodePayload(p: MigratePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  if (typeof CompressionStream === 'function') {
    try {
      return (
        GZIP_MARK +
        toBase64Url(await pipe(bytes, new CompressionStream('gzip')))
      );
    } catch {
      // 压不了就送原文
    }
  }
  return toBase64Url(bytes);
}

export async function decodePayload(
  hash: string
): Promise<MigratePayload | null> {
  const i = hash.indexOf(MIGRATE_HASH);
  if (i < 0) return null;
  try {
    let body = hash.slice(i + MIGRATE_HASH.length);
    const zipped = body.startsWith(GZIP_MARK);
    if (zipped) body = body.slice(1);
    let bytes = fromBase64Url(body);
    if (zipped) bytes = await pipe(bytes, new DecompressionStream('gzip'));
    return sanitizePayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export interface MergeResult {
  favorites: Record<string, Favorite>;
  aiMarks: WatchMark<unknown>[];
  seriesFollows: SeriesFollow[];
  aiPins: string[];
  added: {
    favorites: number;
    aiMarks: number;
    seriesFollows: number;
    aiPins: number;
  };
}

/** 两份清单并在一起：have 有的保留 have 那笔（新站的进度较新），其余补进来 */
function mergeList<T>(
  have: T[],
  incoming: T[],
  key: (x: T) => string,
  max: number
): [T[], number] {
  const seen = new Set(have.map(key));
  const fresh = incoming.filter((x) => !seen.has(key(x)));
  const room = Math.max(max - have.length, 0);
  return [[...have, ...fresh.slice(0, room)], Math.min(fresh.length, room)];
}

/** 并进新站现有的资料：新站已经有的那笔保留不动，只补没有的 */
export function mergePayload(
  have: Omit<MigratePayload, 'v'>,
  incoming: MigratePayload
): MergeResult {
  const favorites = { ...have.favorites };
  let favAdded = 0;
  for (const [k, f] of Object.entries(incoming.favorites)) {
    if (favorites[k]) continue;
    favorites[k] = f;
    favAdded++;
  }

  // 我的收藏：照加入时间排，最新的在前
  const [marks, marksAdded] = mergeList(
    have.aiMarks,
    incoming.aiMarks,
    (m) => m.id,
    MAX_MARKS
  );
  const aiMarks = marks.sort((a, b) => b.at - a.at);
  const [seriesFollows, followsAdded] = mergeList(
    have.seriesFollows,
    incoming.seriesFollows,
    followKey,
    MAX_SERIES_FOLLOWS
  );
  const [aiPins, pinsAdded] = mergeList(
    have.aiPins,
    incoming.aiPins,
    (k) => k,
    MAX_PINS
  );

  return {
    favorites,
    aiMarks,
    seriesFollows,
    aiPins,
    added: {
      favorites: favAdded,
      aiMarks: marksAdded,
      seriesFollows: followsAdded,
      aiPins: pinsAdded,
    },
  };
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function readLocal(): MigratePayload {
  return {
    v: 1,
    favorites: sanitizeFavorites(readJson(FAVORITES_KEY)),
    aiMarks: sanitizeMarks(readJson(AI_MARKS_KEY)),
    seriesFollows: sanitizeSeriesFollows(readJson(SERIES_FOLLOWS_KEY)),
    aiPins: sanitizePins(readJson(AI_PINS_KEY)),
  };
}

export function writeLocal(r: MergeResult): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(r.favorites));
  localStorage.setItem(AI_MARKS_KEY, JSON.stringify(r.aiMarks));
  localStorage.setItem(SERIES_FOLLOWS_KEY, JSON.stringify(r.seriesFollows));
  localStorage.setItem(AI_PINS_KEY, JSON.stringify(r.aiPins));
}
