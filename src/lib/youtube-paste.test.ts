import { youtubePasteOf } from './youtube-paste';

describe('youtubePasteOf', () => {
  it('影片网址各种写法都认得', () => {
    const v = { kind: 'video', videoId: 'dQw4w9WgXcQ' };
    expect(youtubePasteOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(v);
    expect(youtubePasteOf('https://youtu.be/dQw4w9WgXcQ?si=abc')).toEqual(v);
    expect(youtubePasteOf('youtube.com/shorts/dQw4w9WgXcQ')).toEqual(v);
    expect(youtubePasteOf('https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&t=30')).toEqual(v);
    expect(youtubePasteOf(' https://www.youtube.com/live/dQw4w9WgXcQ ')).toEqual(v);
  });

  it('频道、@帐号、播放列表当成要追踪', () => {
    for (const s of [
      '@漫剧社',
      'https://www.youtube.com/@abc/videos',
      'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
      'https://www.youtube.com/playlist?list=PL1234567890',
    ]) {
      expect(youtubePasteOf(s)).toEqual({ kind: 'channel', input: s });
    }
  });

  it('剧名、其他网站、看不懂的 YouTube 网址都回 null', () => {
    expect(youtubePasteOf('冒名权臣')).toBeNull();
    expect(youtubePasteOf('冒名 权臣')).toBeNull();
    expect(youtubePasteOf('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubePasteOf('https://www.youtube.com/feed/trending')).toBeNull();
    expect(youtubePasteOf('https://www.youtube.com/watch?v=short')).toBeNull();
  });
});
