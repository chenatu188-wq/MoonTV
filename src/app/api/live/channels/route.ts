import { NextResponse } from 'next/server';

export const runtime = 'edge';

type ChannelCategory = 'tw' | 'cn' | 'news' | 'hk';

type LiveChannel = {
  name: string;
  url: string;
  category: ChannelCategory;
};

const PLAYLISTS: Record<ChannelCategory, string> = {
  tw: 'https://iptv-org.github.io/iptv/countries/tw.m3u',
  cn: 'https://iptv-org.github.io/iptv/countries/cn.m3u',
  hk: 'https://iptv-org.github.io/iptv/countries/hk.m3u',
  news: 'https://iptv-org.github.io/iptv/categories/news.m3u',
};

function parseM3U(content: string, category: ChannelCategory): LiveChannel[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: LiveChannel[] = [];
  let pendingName = '';

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      pendingName = line.split(',').pop()?.trim() || '未命名頻道';
      continue;
    }

    if (line.startsWith('#')) continue;
    if (!line.startsWith('http://') && !line.startsWith('https://')) continue;

    const lowered = line.toLowerCase();
    const looksStreamLike =
      lowered.includes('.m3u8') ||
      lowered.includes('/playlist') ||
      lowered.includes('/master');

    // 走站內 proxy 後，http/https 來源都可嘗試播放
    if (!looksStreamLike) {
      pendingName = '';
      continue;
    }

    channels.push({
      name: pendingName || '未命名頻道',
      url: line,
      category,
    });
    pendingName = '';
  }

  return channels;
}

export async function GET() {
  try {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

    const [twResp, cnResp, hkResp, newsResp] = await Promise.all([
      fetch(PLAYLISTS.tw, { headers: { 'User-Agent': ua } }),
      fetch(PLAYLISTS.cn, { headers: { 'User-Agent': ua } }),
      fetch(PLAYLISTS.hk, { headers: { 'User-Agent': ua } }),
      fetch(PLAYLISTS.news, { headers: { 'User-Agent': ua } }),
    ]);

    const [twText, cnText, hkText, newsText] = await Promise.all([
      twResp.ok ? twResp.text() : Promise.resolve(''),
      cnResp.ok ? cnResp.text() : Promise.resolve(''),
      hkResp.ok ? hkResp.text() : Promise.resolve(''),
      newsResp.ok ? newsResp.text() : Promise.resolve(''),
    ]);

    const channels = [
      ...parseM3U(twText, 'tw').slice(0, 260),
      ...parseM3U(cnText, 'cn').slice(0, 260),
      ...parseM3U(hkText, 'hk').slice(0, 180),
      ...parseM3U(newsText, 'news').slice(0, 260),
    ];

    return NextResponse.json(channels, {
      headers: { 'Cache-Control': 'public, max-age=1800' },
    });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
