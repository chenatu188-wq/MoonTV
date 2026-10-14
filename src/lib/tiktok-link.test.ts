import { classifyTiktokUrl, parseOembed } from '@/lib/tiktok-link';

describe('classifyTiktokUrl', () => {
  it.each([
    [
      'https://www.tiktok.com/@cc_tv1227/video/7412345678901234567?is_from_webapp=1',
      { kind: 'video', handle: 'cc_tv1227', videoId: '7412345678901234567' },
    ],
    [
      // App 分享出来的文字会夹着说明
      '看看這個 https://vt.tiktok.com/ZSabc123/ 好好看',
      { kind: 'short', url: 'https://vt.tiktok.com/ZSabc123/' },
    ],
    [
      'https://vm.tiktok.com/ZMxyz/',
      { kind: 'short', url: 'https://vm.tiktok.com/ZMxyz/' },
    ],
    [
      'https://www.tiktok.com/t/ZT8abc/',
      { kind: 'short', url: 'https://www.tiktok.com/t/ZT8abc/' },
    ],
    [
      'https://m.tiktok.com/@Crayon2027',
      { kind: 'profile', handle: 'crayon2027' },
    ],
    [
      'https://www.tiktok.com/shortdrama/episode/7690178072217408518/1',
      { kind: 'drama', dramaId: '7690178072217408518' },
    ],
  ])('%s', (input, expected) => {
    expect(classifyTiktokUrl(input)).toEqual(expected);
  });

  it.each([
    '石海尋徒',
    '@crayon2027',
    'https://www.youtube.com/watch?v=abc',
    'https://evil.tiktok.com.example.com/@a/video/12345678901',
    'https://www.tiktok.com/foryou',
    'https://www.tiktok.com/@a/video/123', // 帐号太短、影片编号太短
  ])('%s → null', (input) => {
    expect(classifyTiktokUrl(input)).toBeNull();
  });
});

describe('parseOembed', () => {
  it('取出标题、帐号名、缩图', () => {
    expect(
      parseOembed({
        type: 'video',
        title: ' #漫剧#fyp ',
        author_name: '南木劇場',
        thumbnail_url: 'https://p16-sign.tiktokcdn.com/a.jpeg',
      })
    ).toEqual({
      title: '#漫剧#fyp',
      name: '南木劇場',
      thumbnail: 'https://p16-sign.tiktokcdn.com/a.jpeg',
    });
  });

  it('不是影片、缩图不是 https 的处理', () => {
    expect(parseOembed({ type: 'rich' })).toBeNull();
    expect(parseOembed(null)).toBeNull();
    expect(
      parseOembed({ type: 'video', thumbnail_url: 'javascript:alert(1)' })
        ?.thumbnail
    ).toBe('');
  });
});
