import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { password } = (await request.json()) as { password?: string };
    const expected = process.env.ADULT_PASSWORD || '123';
    return NextResponse.json({ ok: password === expected });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
