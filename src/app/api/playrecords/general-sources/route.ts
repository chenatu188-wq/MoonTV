import { NextResponse } from 'next/server';

import { getCacheTime, getGeneralSourceKeys } from '@/lib/config';

export const runtime = 'edge';

/** 一般片源的 key，给「继续观看」把彩虹频道的播放记录分开 */
export async function GET() {
  try {
    const [keys, cacheTime] = await Promise.all([
      getGeneralSourceKeys(),
      getCacheTime(),
    ]);
    return NextResponse.json(keys, {
      headers: { 'Cache-Control': `public, max-age=${cacheTime}` },
    });
  } catch {
    return NextResponse.json({ error: '获取片源失败' }, { status: 500 });
  }
}
