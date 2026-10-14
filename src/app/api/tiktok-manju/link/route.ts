import { NextRequest, NextResponse } from 'next/server';

import {
  type TiktokLink,
  classifyTiktokUrl,
  isTiktokHost,
  parseOembed,
} from '@/lib/tiktok-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 把使用者贴上来的 TikTok 连结换成「哪个帐号的哪支影片」，顺便拿标题和缩图，
 * 让页面可以直接播这支、或追踪发这支影片的帐号。
 * 短网址要跟着转址才知道是哪支；只跟着转到 tiktok.com，最多跳 4 次。
 */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

async function expandShort(url: string): Promise<TiktokLink | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    const next = res.headers.get('location');
    if (!next) return null;
    const target = new URL(next, current);
    if (!isTiktokHost(target.hostname)) return null;
    const found = classifyTiktokUrl(target.href);
    if (found && found.kind !== 'short') return found;
    current = target.href;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('url') ?? '').slice(0, 1000);
  let link = classifyTiktokUrl(raw);
  if (!link) return json({ error: '这不是 TikTok 的影片或帐号连结' }, 400);

  if (link.kind === 'short') {
    try {
      link = await expandShort(link.url);
    } catch {
      link = null;
    }
    // 短网址过期或打错时，TikTok 会转回首页
    if (!link) return json({ error: '这个短网址打不开，可能已经失效' }, 404);
  }

  if (link.kind !== 'video') return json(link);

  // 影片：用 oEmbed 拿标题、帐号显示名称、缩图。TikTok 偶尔会回空的，失败就隔半秒再试一次；
  // 两次都拿不到也照样回，页面还是能播、能追踪
  const target = `https://www.tiktok.com/@${link.handle}/video/${link.videoId}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`,
        {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
          cache: 'no-store',
        }
      );
      const info = res.ok ? parseOembed(await res.json()) : null;
      if (info) return json({ ...link, ...info });
    } catch {
      // 下一轮再试
    }
  }
  return json({ ...link, title: '', name: '', thumbnail: '' });
}
