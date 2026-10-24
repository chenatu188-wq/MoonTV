import type { YtVideo } from '@/lib/ai-manju-youtube';
import { musicScore, rankMusic } from '@/lib/music-search';

const v = (id: string, title: string, channel = 'c') =>
  ({ videoId: id, title, channel } as YtVideo);

describe('musicScore', () => {
  it('认得音乐、非音乐', () => {
    expect(musicScore(v('a', '周杰伦 晴天 官方MV'))).toBe(1);
    expect(musicScore(v('a', '晴天', '周杰倫 - Topic'))).toBe(1);
    expect(musicScore(v('a', '晴天 吉他教学'))).toBe(-1);
    expect(musicScore(v('a', '晴天'))).toBe(0);
  });
});

describe('rankMusic', () => {
  it('合并去重、音乐排前、非音乐拿掉', () => {
    const a = [v('1', '晴天 reaction'), v('2', '晴天'), v('3', '晴天 MV')];
    const b = [v('3', '晴天 MV'), v('4', '晴天 歌词版')];
    expect(rankMusic(a, b).map((x) => x.videoId)).toEqual(['3', '4', '2']);
  });
});
