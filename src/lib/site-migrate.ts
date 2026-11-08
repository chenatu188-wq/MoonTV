/**
 * 网站搬家：Zeabur 旧网址 12 月关站，家庭站的「收藏夹」只存在浏览器 localStorage
 * （线上没有资料库），换网域就看不到。
 *
 * 做法：旧站把资料打包进网址的 # 后面（# 后面的东西不会送到伺服器），
 * 开新站同一页；新站读到就问一声，确认后并进自己的 localStorage。
 * 新站原本有的资料不会被盖掉。
 * （彩虹频道那条分支的版本多搬精选影片和番号清单，资料格式相同。）
 */
import { Favorite } from './types';

export const FAVORITES_KEY = 'moontv_favorites';
export const MIGRATE_HASH = 'moontv-migrate=';
/** 搬完重新整理后，用这个把结果带到新页面显示 */
export const MIGRATE_DONE_KEY = 'moontv_migrate_done';

export interface MigratePayload {
  v: 1;
  favorites: Record<string, Favorite>;
}

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
  };
}

const toBase64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export const encodePayload = (p: MigratePayload) =>
  toBase64Url(JSON.stringify(p));

export function decodePayload(hash: string): MigratePayload | null {
  const i = hash.indexOf(MIGRATE_HASH);
  if (i < 0) return null;
  try {
    return sanitizePayload(
      JSON.parse(fromBase64Url(hash.slice(i + MIGRATE_HASH.length)))
    );
  } catch {
    return null;
  }
}

export interface MergeResult {
  favorites: Record<string, Favorite>;
  added: { favorites: number };
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

  return {
    favorites,
    added: { favorites: favAdded },
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
  };
}

export function writeLocal(r: MergeResult): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(r.favorites));
}
