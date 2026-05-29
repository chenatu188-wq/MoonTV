import { NextResponse } from 'next/server';

export const runtime = 'edge';

function isHttpUrl(input: string) {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function toProxyUrl(absUrl: string) {
  return `/api/live/proxy?url=${encodeURIComponent(absUrl)}`;
}

function rewritePlaylist(content: string, baseUrl: string) {
  const lines = content.split('\n');
  const base = new URL(baseUrl);

  return lines
    .map((line) => {
      const raw = line.trim();
      if (!raw) return line;

      if (raw.startsWith('#EXT-X-KEY:') || raw.startsWith('#EXT-X-MAP:')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          const abs = new URL(uri, base).toString();
          return `URI="${toProxyUrl(abs)}"`;
        });
      }

      if (raw.startsWith('#')) return line;

      const abs = new URL(raw, base).toString();
      return toProxyUrl(abs);
    })
    .join('\n');
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url') || '';
  if (!target || !isHttpUrl(target)) {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  const incomingRange = request.headers.get('range') || undefined;

  const upstream = await fetch(target, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      ...(incomingRange ? { Range: incomingRange } : {}),
    },
    redirect: 'follow',
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}` },
      { status: 502 }
    );
  }

  const ct = upstream.headers.get('content-type') || '';
  const looksM3U8 =
    ct.includes('application/vnd.apple.mpegurl') ||
    ct.includes('application/x-mpegurl') ||
    ct.includes('audio/mpegurl') ||
    target.toLowerCase().includes('.m3u8');

  if (looksM3U8) {
    const body = await upstream.text();
    const rewritten = rewritePlaylist(body, target);
    return new Response(rewritten, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
      },
    });
  }

  const headers = new Headers();
  const passthrough = [
    'content-type',
    'content-length',
    'accept-ranges',
    'content-range',
    'cache-control',
  ];
  passthrough.forEach((k) => {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
