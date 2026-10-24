import {
  favoritesAsVideos,
  MAX_FAVORITES,
  sanitizeFavorites,
  toggleFavorite,
} from '@/lib/music-favorites';

const song = (id: string) => ({
  videoId: id,
  title: `歌 ${id}`,
  thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  channel: '频道',
});

describe('toggleFavorite', () => {
  it('没有就加到最前面，有就拿掉', () => {
    let list = toggleFavorite([], song('aaaaaaaaaaa'), 1);
    list = toggleFavorite(list, song('bbbbbbbbbbb'), 2);
    expect(list.map((f) => f.videoId)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
    list = toggleFavorite(list, song('aaaaaaaaaaa'));
    expect(list.map((f) => f.videoId)).toEqual(['bbbbbbbbbbb']);
  });

  it('最多留 MAX_FAVORITES 首，最旧的挤掉', () => {
    const many = Array.from(
      { length: MAX_FAVORITES },
      (_, i) => toggleFavorite([], song(`v${String(i).padStart(10, '0')}`))[0]
    );
    const list = toggleFavorite(many, song('zzzzzzzzzzz'));
    expect(list).toHaveLength(MAX_FAVORITES);
    expect(list[0].videoId).toBe('zzzzzzzzzzz');
  });
});

describe('sanitizeFavorites', () => {
  it('挡掉坏的、重复的，缩图不是 https 就换成 YouTube 的', () => {
    const list = sanitizeFavorites([
      {
        videoId: 'aaaaaaaaaaa',
        title: 'A',
        thumbnail: 'javascript:x',
        channel: 'c',
      },
      { videoId: 'aaaaaaaaaaa', title: 'A2' },
      { videoId: 'bad id' },
      null,
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].thumbnail).toBe(
      'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg'
    );
    expect(sanitizeFavorites('x')).toEqual([]);
  });
});

it('favoritesAsVideos 补齐栏位', () => {
  const v = favoritesAsVideos(toggleFavorite([], song('aaaaaaaaaaa')))[0];
  expect(v.videoId).toBe('aaaaaaaaaaa');
  expect(v.sourceName).toBe('我的最爱');
});
