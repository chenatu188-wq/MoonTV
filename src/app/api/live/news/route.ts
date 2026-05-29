import { NextResponse } from 'next/server';

export const runtime = 'edge';

type NewsChannel = {
  name: string;
  url: string;
};

function parseM3UChannels(content: string): NewsChannel[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: NewsChannel[] = [];
  let pendingName = '';

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const name = line.split(',').pop()?.trim() || '未命名頻道';
      pendingName = name;
      continue;
    }

    if (line.startsWith('#')) continue;

    if (line.startsWith('http://') || line.startsWith('https://')) {
      channels.push({
        name: pendingName || '未命名頻道',
        url: line,
      });
      pendingName = '';
    }
  }

  return channels;
}

export async function GET() {
  try {
    const response = await fetch(
      'https://iptv-org.github.io/iptv/categories/news.m3u',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json([], { status: 502 });
    }

    const content = await response.text();
    const channels = parseM3UChannels(content).slice(0, 120);

    return NextResponse.json(channels, {
      headers: { 'Cache-Control': 'public, max-age=1800' },
    });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
