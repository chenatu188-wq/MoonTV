import { popularToken } from '@/lib/ai-manju-youtube';

const chip = (text: string, token: string) => ({
  chipViewModel: {
    text,
    tapCommand: { innertubeCommand: { continuationCommand: { token } } },
  },
});

describe('popularToken', () => {
  it('取第二颗（热门）的 token，不看文字', () => {
    const data = {
      header: {
        chipBarViewModel: {
          chips: [
            chip('Latest', 'a'),
            chip('Popular', 'b'),
            chip('Oldest', 'c'),
          ],
        },
      },
    };
    expect(popularToken(data)).toBe('b');
  });

  it('影片太少的频道没有排序列，回 null', () => {
    expect(popularToken({ contents: [] })).toBeNull();
  });
});
