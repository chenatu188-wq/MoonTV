import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { currentGuestPass } from '@/lib/guest-pass';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * 目前的访客密码和到期时间。只有用主密码登入的人看得到
 *（用第二组密码或访客密码登入的都不行，免得访客自己续期）。
 */
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  const auth = getAuthInfoFromCookie(request);
  if (!process.env.PASSWORD || auth?.password !== process.env.PASSWORD) {
    return NextResponse.json(
      { error: '只有用主密码登入才能看' },
      { status: 403, headers }
    );
  }
  const guest = await currentGuestPass();
  return NextResponse.json(
    guest ? { enabled: true, ...guest } : { enabled: false },
    { headers }
  );
}
