/**
 * 认出使用者贴上来的 TikTok 连结（App 里按「分享 → 复制连结」那种）。纯函数。
 * 分享出来的常是短网址（vt.tiktok.com/xxxx），要先由伺服器跟着转址才知道是哪支影片，
 * 这一步在 api/tiktok-manju/link。
 */
export type TiktokLink =
  | { kind: 'short'; url: string }
  | { kind: 'video'; handle: string; videoId: string }
  | { kind: 'profile'; handle: string }
  | { kind: 'drama'; dramaId: string };

/** 只认这几个网域，伺服器也只会跟着转址到这几个网域（不会被拿去打任意网址） */
const HOST_RE = /^(?:www\.|m\.|vt\.|vm\.)?tiktok\.com$/i;
const SHORT_HOST_RE = /^(?:vt|vm)\.tiktok\.com$/i;
const HANDLE = '([A-Za-z0-9._]{2,24})';

export const isTiktokHost = (host: string) => HOST_RE.test(host);

/** 分享文字里常夹着别的字，取出第一个 TikTok 网址；没有回 null */
export function tiktokUrlIn(text: string): URL | null {
  for (const raw of text.match(/https?:\/\/[^\s<>"'，。、）)]+/gi) ?? []) {
    try {
      const url = new URL(raw);
      if (isTiktokHost(url.hostname)) return url;
    } catch {
      // 不是合法网址，看下一个
    }
  }
  return null;
}

export function classifyTiktokUrl(text: string): TiktokLink | null {
  const url = tiktokUrlIn(text.normalize('NFKC'));
  if (!url) return null;
  const path = url.pathname;

  if (SHORT_HOST_RE.test(url.hostname) || /^\/t\/[\w-]+\/?$/.test(path)) {
    return { kind: 'short', url: `https://${url.hostname}${path}` };
  }
  let m = new RegExp(`^/@${HANDLE}/(?:video|photo)/(\\d{8,25})`).exec(path);
  if (m && !m[1].endsWith('.')) {
    return { kind: 'video', handle: m[1].toLowerCase(), videoId: m[2] };
  }
  m = /^\/shortdrama\/episode\/(\d{5,25})/.exec(path);
  if (m) return { kind: 'drama', dramaId: m[1] };
  m = new RegExp(`^/@${HANDLE}/?$`).exec(path);
  if (m && !m[1].endsWith('.')) {
    return { kind: 'profile', handle: m[1].toLowerCase() };
  }
  return null;
}

export interface OembedInfo {
  title: string;
  name: string;
  thumbnail: string;
}

/** TikTok oEmbed（www.tiktok.com/oembed?url=）的回应；格式不对回 null */
export function parseOembed(raw: unknown): OembedInfo | null {
  const d = raw as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || d.type !== 'video') return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const thumbnail = str(d.thumbnail_url);
  return {
    title: str(d.title).trim().slice(0, 200),
    name: str(d.author_name).trim().slice(0, 80),
    thumbnail: /^https:\/\//.test(thumbnail) ? thumbnail : '',
  };
}
