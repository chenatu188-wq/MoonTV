import { musicEmbedUrl, parseYtMessage } from '@/lib/music-player';

const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd'];
const q = (url: string) => new URL(url).searchParams;

describe('musicEmbedUrl', () => {
  it('从点的那首开始，后面的交给 playlist 接着播', () => {
    const url = musicEmbedUrl(ids, 1, false);
    expect(url.startsWith('https://www.youtube.com/embed/bbbbbbbbbbb?')).toBe(true);
    expect(q(url).get('playlist')).toBe('ccccccccccc,ddddddddddd');
    expect(q(url).get('enablejsapi')).toBe('1');
    expect(q(url).get('loop')).toBeNull();
  });

  it('最后一首没有 playlist', () => {
    expect(q(musicEmbedUrl(ids, 3, false)).get('playlist')).toBeNull();
  });

  it('循环：前面的歌接在后面，整份播完再从头', () => {
    const url = musicEmbedUrl(ids, 2, true);
    expect(q(url).get('playlist')).toBe(
      'ccccccccccc,ddddddddddd,aaaaaaaaaaa,bbbbbbbbbbb'
    );
    expect(q(url).get('loop')).toBe('1');
  });

  it('挡掉格式不对的 id、清单太长只取前 150 首', () => {
    const many = Array.from({ length: 300 }, (_, i) => `v${String(i).padStart(10, '0')}`);
    const url = musicEmbedUrl(['bad id', ...many], 0, false);
    expect(url).toContain('/embed/v0000000000?');
    expect(q(url).get('playlist')?.split(',')).toHaveLength(150);
  });
});

describe('parseYtMessage', () => {
  it('读出现在播的歌和状态', () => {
    expect(
      parseYtMessage(
        JSON.stringify({
          event: 'infoDelivery',
          info: { videoData: { video_id: 'ccccccccccc' }, playerState: 1 },
        })
      )
    ).toEqual({ videoId: 'ccccccccccc', state: 1 });
    expect(parseYtMessage('{"event":"onStateChange","info":0}')).toEqual({
      videoId: null,
      state: 0,
    });
  });

  it('看不懂的回 null', () => {
    expect(parseYtMessage('not json')).toBeNull();
    expect(parseYtMessage({ event: 'infoDelivery', info: { currentTime: 3 } })).toBeNull();
    expect(parseYtMessage(null)).toBeNull();
  });
});
