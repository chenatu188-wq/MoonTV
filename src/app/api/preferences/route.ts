/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdultRecommendationPreferences } from '@/lib/types';

export const runtime = 'edge';

const MAX_ITEMS = 200;

function cleanStrings(value: unknown, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= maxLength);
  return cleaned.length === value.length ? Array.from(new Set(cleaned)) : null;
}

function parsePreferences(value: unknown): AdultRecommendationPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.studioTags) || input.studioTags.length > MAX_ITEMS)
    return null;

  const studioTags = input.studioTags.map((tag) => {
    if (!tag || typeof tag !== 'object') return null;
    const { code, style } = tag as Record<string, unknown>;
    if (
      typeof code !== 'string' ||
      !/^[A-Z]{2,8}$/.test(code) ||
      typeof style !== 'string' ||
      style.length > 12
    )
      return null;
    return { code, style };
  });
  if (studioTags.some((tag) => tag === null)) return null;

  const studioFavs = cleanStrings(input.studioFavs, 8);
  const keywords = cleanStrings(input.keywords, 20);
  if (!studioFavs || !keywords) return null;

  return {
    studioTags: studioTags as AdultRecommendationPreferences['studioTags'],
    studioFavs,
    keywords,
  };
}

function getUsername(request: NextRequest): string | null {
  return getAuthInfoFromCookie(request)?.username || null;
}

export async function GET(request: NextRequest) {
  const username = getUsername(request);
  if (!username)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(
      await db.getAdultRecommendationPreferences(username)
    );
  } catch (err) {
    console.error('取得自訂推薦失敗', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const username = getUsername(request);
  if (!username)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const preferences = parsePreferences(await request.json());
    if (!preferences)
      return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 });

    await db.saveAdultRecommendationPreferences(username, preferences);
    return NextResponse.json(preferences);
  } catch (err) {
    console.error('儲存自訂推薦失敗', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
