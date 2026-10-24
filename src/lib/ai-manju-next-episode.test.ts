import { nextEpisodeOf } from '@/lib/ai-manju-next-episode';
import type { SearchHit } from '@/lib/ai-manju-series-follow';

const CH = 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa';
const hit = (
  id: string,
  episode: number | null,
  season: number | null = null,
  extra: Partial<SearchHit> = {}
): SearchHit => ({
  videoId: id,
  title: `意外荒岛 第${episode}集`,
  thumbnail: '',
  channel: 'c',
  channelUrl: CH,
  season,
  episode,
  match: true,
  ...extra,
});
const cur = { videoId: 'e18', title: '意外荒岛 第18集', channelUrl: CH };

describe('nextEpisodeOf', () => {
  it('第 18 集接第 19 集', () => {
    const hits = [hit('e20', 20), hit('e19', 19), hit('e18', 18), hit('e3', 3)];
    expect(nextEpisodeOf(cur, hits)?.videoId).toBe('e19');
  });

  it('缺集就跳到下一个有的', () => {
    expect(nextEpisodeOf(cur, [hit('e21', 21), hit('e25', 25)])?.videoId).toBe(
      'e21'
    );
  });

  it('别的频道、片名不吻合的不算', () => {
    const hits = [
      hit('x', 19, null, {
        channelUrl: 'https://www.youtube.com/channel/UCbbbbbbbbbbbbbbbbbbbbbb',
      }),
      hit('y', 19, null, { match: false }),
    ];
    expect(nextEpisodeOf(cur, hits)).toBeNull();
  });

  it('这季播完接下一季第一集', () => {
    const hits = [hit('s2e2', 2, 2), hit('s2e1', 1, 2), hit('e10', 10)];
    expect(nextEpisodeOf(cur, hits)?.videoId).toBe('s2e1');
  });

  it('标题没写集数就不接', () => {
    expect(
      nextEpisodeOf({ ...cur, title: '意外荒岛 全集' }, [hit('e19', 19)])
    ).toBeNull();
  });
});
