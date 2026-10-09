import { pickRecommended } from '@/lib/ai-manju-recommend';
import type { YtVideo } from '@/lib/ai-manju-youtube';

const v = (videoId: string, channelId: string, seconds = 3600): YtVideo => ({
  videoId,
  channelId,
  seconds,
  title: videoId,
  channel: channelId,
  channelUrl: `https://www.youtube.com/channel/${channelId}`,
  published: '',
  thumbnail: '',
  description: '',
  views: null,
  sourceKey: 'search',
  sourceName: channelId,
});

describe('pickRecommended', () => {
  it('已追踪的频道不推荐', () => {
    const r = pickRecommended(
      [[v('a', 'TRACKED'), v('b', 'NEW')]],
      ['TRACKED']
    );
    expect(r.map((x) => x.videoId)).toEqual(['b']);
  });

  it('一个频道只出一支，取片长最长的', () => {
    const r = pickRecommended(
      [[v('short', 'C1', 600), v('long', 'C1', 7200), v('x', 'C2')]],
      []
    );
    expect(r.map((x) => x.videoId)).toEqual(['long', 'x']);
  });

  it('太短的（预告、切片）不要', () => {
    expect(pickRecommended([[v('clip', 'C1', 90)]], [])).toEqual([]);
  });

  it('在越多组关键字里出现的频道排越前面', () => {
    const r = pickRecommended(
      [
        [v('a1', 'A'), v('b1', 'B')],
        [v('b2', 'B'), v('c1', 'C')],
        [v('b3', 'B', 10000)],
      ],
      []
    );
    expect(r.map((x) => x.channelId)).toEqual(['B', 'A', 'C']);
    expect(r[0].videoId).toBe('b3');
  });

  it('同一组里出现两次不重复加分', () => {
    const r = pickRecommended([[v('a1', 'A'), v('b1', 'B'), v('b2', 'B')]], []);
    expect(r.map((x) => x.channelId)).toEqual(['A', 'B']);
  });

  it('没有频道 ID 的略过；最多 limit 笔', () => {
    const many = Array.from({ length: 60 }, (_, i) => v(`v${i}`, `C${i}`));
    expect(pickRecommended([[v('x', ''), ...many]], [], 40)).toHaveLength(40);
  });
});
