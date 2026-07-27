import { NextResponse } from 'next/server';

// HLS 代理：pigav（PeerTube）的影片 CDN 只對 pigav.ws origin 回 Access-Control-Allow-Origin，
// 瀏覽器端 Hls.js 直連會被 CORS 擋。這個 route 由伺服器端抓上游（伺服器無 CORS 限制），
// 改寫 m3u8 子清單 / segment 讓它們也走本代理，並補上 ACAO，前端全程同源即可播放。

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELF_PATH = '/api/hls-proxy';

// 白名單：只代理 pigav 相關來源，避免變成開放代理（SSRF / 濫用）
const ALLOWED_HOST_SUFFIXES = ['1host.lc', 'pigav.ws', 'wuma.vc'];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function isM3u8(url: string, contentType: string | null): boolean {
  if ((contentType || '').toLowerCase().includes('mpegurl')) return true;
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.m3u8');
}

// 把 m3u8 內的子清單 / segment / MAP / KEY URI 全部改寫成走本代理的絕對路徑
function rewriteM3u8(body: string, baseUrl: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === '') return line;
      if (trimmed.startsWith('#')) {
        // 改寫標籤內的 URI="..."（EXT-X-MAP / EXT-X-KEY / EXT-X-MEDIA 等）
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
          const abs = new URL(uri, baseUrl).toString();
          return `URI="${SELF_PATH}?url=${encodeURIComponent(abs)}"`;
        });
      }
      // 非註解行即為 URI（segment 或子清單）
      const abs = new URL(trimmed, baseUrl).toString();
      return `${SELF_PATH}?url=${encodeURIComponent(abs)}`;
    })
    .join('\n');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 });
  }

  let upstream: URL;
  try {
    upstream = new URL(target);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }
  if (upstream.protocol !== 'https:' && upstream.protocol !== 'http:') {
    return NextResponse.json({ error: 'invalid protocol' }, { status: 400 });
  }
  if (!isAllowedHost(upstream.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 });
  }

  const range = request.headers.get('range');
  const reqHeaders: Record<string, string> = { 'User-Agent': UA };
  if (range) reqHeaders['Range'] = range;

  let res: Response;
  try {
    res = await fetch(upstream.toString(), { headers: reqHeaders });
  } catch {
    return NextResponse.json(
      { error: 'upstream fetch failed' },
      { status: 502 }
    );
  }

  const contentType = res.headers.get('content-type');

  // m3u8：改寫子 URI 後回傳（文字）
  if (isM3u8(upstream.toString(), contentType)) {
    const body = await res.text();
    const rewritten = rewriteM3u8(body, upstream.toString());
    return new NextResponse(rewritten, {
      status: res.ok ? 200 : res.status,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  // segment / init：原樣串流回傳，保留 Range 相關標頭
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Accept-Ranges', 'bytes');
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'etag',
  ];
  passthrough.forEach((h) => {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  });

  return new NextResponse(res.body, { status: res.status, headers });
}
