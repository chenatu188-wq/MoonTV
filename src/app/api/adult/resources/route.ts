import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET() {
  try {
    const config = await getConfig();
    const cacheTime = await getCacheTime();

    const sites = (config.SourceConfig || [])
      .filter((s) => !s.disabled)
      .map((s) => ({
        key: s.key,
        name: s.name,
        group: s.group || '',
      }));

    return NextResponse.json(sites, {
      headers: { 'Cache-Control': `public, max-age=${cacheTime}` },
    });
  } catch {
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
