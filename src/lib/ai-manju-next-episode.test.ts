import {
  nextEpisodeOf,
  nextQuery,
  spanLabel,
  spanOf,
} from '@/lib/ai-manju-next-episode';
import type { SearchHit } from '@/lib/ai-manju-series-follow';

const CH = 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa';
const hit = (
  id: string,
  title: string,
  extra: Partial<SearchHit> = {}
): SearchHit => ({
  videoId: id,
  title,
  thumbnail: '',
  channel: 'c',
  channelUrl: CH,
  season: null,
  episode: null,
  match: true,
  ...extra,
});
const cur = (title: string) => ({ videoId: 'cur', title, channelUrl: CH });

describe('spanOf', () => {
  it('单集、合集、整季', () => {
    expect(spanOf('意外荒岛 第18集')).toMatchObject({
      season: 1,
      from: 18,
      to: 18,
    });
    expect(spanOf('《我觉醒了鸡肋异能》第1~50集丨秦奋')).toMatchObject({
      from: 1,
      to: 50,
    });
    expect(spanOf('《亡国危局》1-23合集 大明')).toMatchObject({
      from: 1,
      to: 23,
    });
    expect(spanOf('《修仙界的灵植第二季》')).toMatchObject({
      season: 2,
      from: null,
      hasSeason: true,
    });
    expect(spanOf('一口气看完丨【1-2季】丹帝转世').from).toBeNull();
  });
  it('按钮文字', () => {
    expect(spanLabel(spanOf('x 第19集'))).toBe('第 19 集');
    expect(spanLabel(spanOf('x 第51~100集'))).toBe('第 51~100 集');
    expect(spanLabel(spanOf('x 第二季'))).toBe('第 2 季');
  });
  it('先搜什么', () => {
    expect(nextQuery('意外荒岛', '意外荒岛 第18集')).toBe('意外荒岛 第19集');
    expect(nextQuery('鸡肋异能', '鸡肋异能 第1~50集')).toBe('鸡肋异能 第51集');
    expect(nextQuery('灵植', '灵植第二季')).toBe('灵植 第3季');
  });
});

describe('nextEpisodeOf', () => {
  it('第 18 集接第 19 集', () => {
    const hits = [
      hit('e20', '意外荒岛 第20集'),
      hit('e19', '意外荒岛 第19集'),
      hit('e3', '意外荒岛 第3集'),
    ];
    expect(nextEpisodeOf(cur('意外荒岛 第18集'), hits)?.videoId).toBe('e19');
  });
  it('缺集就跳到下一个有的', () => {
    const hits = [hit('e25', '意外荒岛 第25集'), hit('e21', '意外荒岛 第21集')];
    expect(nextEpisodeOf(cur('意外荒岛 第18集'), hits)?.videoId).toBe('e21');
  });
  it('合集接下一段合集', () => {
    const hits = [
      hit('a', '鸡肋异能 第1~50集'),
      hit('c', '鸡肋异能 第101~150集'),
      hit('b', '鸡肋异能 第51~100集'),
    ];
    expect(nextEpisodeOf(cur('鸡肋异能 第1~50集'), hits)?.videoId).toBe('b');
  });
  it('整季接下一季', () => {
    const hits = [
      hit('s1', '灵植 全集'),
      hit('s3', '灵植第三季'),
      hit('s2', '灵植第二季'),
    ];
    expect(nextEpisodeOf(cur('灵植 全集'), hits)?.videoId).toBe('s2');
    expect(nextEpisodeOf(cur('灵植第二季'), hits)?.videoId).toBe('s3');
  });
  it('这季播完接下一季第一集', () => {
    const hits = [
      hit('s2e2', 'x 第二季 第2集'),
      hit('s2e1', 'x 第二季 第1集'),
      hit('e10', 'x 第10集'),
    ];
    expect(nextEpisodeOf(cur('x 第18集'), hits)?.videoId).toBe('s2e1');
  });
  it('别的频道、片名不吻合的不算', () => {
    const hits = [
      hit('x', '意外荒岛 第19集', {
        channelUrl: 'https://www.youtube.com/channel/UCbbbbbbbbbbbbbbbbbbbbbb',
      }),
      hit('y', '意外荒岛 第19集', { match: false }),
    ];
    expect(nextEpisodeOf(cur('意外荒岛 第18集'), hits)).toBeNull();
  });
});
