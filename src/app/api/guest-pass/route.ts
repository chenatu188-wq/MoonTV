import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { currentGuestPass } from '@/lib/guest-pass';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * 访客密码的状态。
 * - 用主密码登入：回目前的密码和到期时间（设置面板拿来给朋友）。
 * - 用访客密码登入：只回到期时间，不回密码（让访客知道还能用几天，但不能自己续期）。
 * - 其他（第二组固定密码等）：不给看。
 */
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  const auth = getAuthInfoFromCookie(request);
  const guest = await currentGuestPass();

  if (process.env.PASSWORD && auth?.password === process.env.PASSWORD) {
    return NextResponse.json(
      guest ? { enabled: true, ...guest } : { enabled: false },
      { headers }
    );
  }
  if (guest && auth?.password === guest.code) {
    return NextResponse.json(
      {
        enabled: true,
        guest: true,
        expiresAt: guest.expiresAt,
        days: guest.days,
      },
      { headers }
    );
  }
  return NextResponse.json(
    { error: '只有用主密码或访客密码登入才能看' },
    { status: 403, headers }
  );
}
