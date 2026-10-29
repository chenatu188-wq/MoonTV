import { NextResponse } from 'next/server';

import { API_CONFIG, getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 免登入的检查用端点：这台伺服器连不连得到某个已设定的片源。
 * 片源会挡部分机房 IP，本机测得到不代表伺服器也测得到；
 * 只收设定里已有的来源 key，回连线结果和笔数，不回片单内容。
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') ?? '';
  const config = await getConfig();
  const site = (config.SourceConfig || []).find((s) => s.key === key);
  if (!site) {
    return NextResponse.json({ error: '没有这个来源' }, { status: 404 });
  }
  const host = (() => {
    try {
      return new URL(site.api).host;
    } catch {
      return '';
    }
  })();
  const started = Date.now();
  try {
    const res = await fetch(`${site.api}?ac=videolist&pg=1`, {
      headers: API_CONFIG.search.headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    const body = res.ok ? await res.json().catch(() => null) : null;
    return NextResponse.json(
      {
        key,
        host,
        disabled: !!site.disabled,
        status: res.status,
        count: Array.isArray(body?.list) ? body.list.length : null,
        ms: Date.now() - started,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        key,
        host,
        disabled: !!site.disabled,
        error: (e as Error).name || 'fetch failed',
        ms: Date.now() - started,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
