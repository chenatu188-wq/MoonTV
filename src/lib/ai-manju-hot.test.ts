import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { hotRank, latestPerSource } from '@/lib/ai-manju-hot';

const NOW = new Date('2026-10-08T12:00:00Z').getTime();

function v(
  videoId: string,
  title: string,
  views: number | null,
  daysAgo = 1
): AiManjuVideo {
  return {
    videoId,
    title,
    channel: '频道',
    channelUrl: '',
    published: new Date(NOW - daysAgo * 86400000).toISOString(),
    thumbnail: '',
    description: '',
    views,
    sourceKey: 'k',
    sourceName: '来源',
  };
}

describe('hotRank', () => {
  it('按观看数由高到低排', () => {
    const r = hotRank(
      [v('a', '随便一句宣传语', 100), v('b', '另一句宣传语', 900)],
      null,
      30,
      NOW
    );
    expect(r.map((i) => i.video.videoId)).toEqual(['b', 'a']);
  });

  it('同一部剧并成一格，观看数加总，代表影片取最多人看的', () => {
    const r = hotRank(
      [
        v('a', '《万妖图录》第1集', 100),
        v('b', '《万妖图录》第2集', 500),
        v('c', '《别的剧》全集', 550),
      ],
      null,
      30,
      NOW
    );
    expect(r[0].series).toBe('万妖图录');
    expect(r[0].views).toBe(600);
    expect(r[0].count).toBe(2);
    expect(r[0].video.videoId).toBe('b');
    expect(r[1].series).toBe('别的剧');
  });

  it('繁体和简体写法的同一部剧并在一起', () => {
    const r = hotRank(
      [v('a', '《萬妖圖錄》第1集', 100), v('b', '《万妖图录》第2集', 200)],
      null,
      30,
      NOW
    );
    expect(r).toHaveLength(1);
    expect(r[0].views).toBe(300);
  });

  it('只算期间内发布的影片', () => {
    const r = hotRank(
      [v('old', '老片宣传语', 99999, 20), v('new', '新片宣传语', 10, 2)],
      7,
      30,
      NOW
    );
    expect(r.map((i) => i.video.videoId)).toEqual(['new']);
  });

  it('没有观看数的影片不进榜', () => {
    expect(
      hotRank([v('a', '宣传语', null), v('b', '宣传语二', 0)], null, 30, NOW)
    ).toEqual([]);
  });

  it('同一支影片出现在两个来源只算一次', () => {
    const r = hotRank(
      [v('a', '《万妖图录》第1集', 100), v('a', '《万妖图录》第1集', 100)],
      null,
      30,
      NOW
    );
    expect(r[0].views).toBe(100);
    expect(r[0].count).toBe(1);
  });

  it('最多回传 limit 笔', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      v(`id${i}`, `宣传语${i}`, i + 1)
    );
    expect(hotRank(many, null, 30, NOW)).toHaveLength(30);
  });
});

describe('latestPerSource', () => {
  const from = (key: string, id: string, daysAgo: number) => ({
    ...v(id, `标题${id}`, 1, daysAgo),
    sourceKey: key,
  });

  it('每个来源只留最新一支，整体新的排前面', () => {
    const r = latestPerSource([
      from('A', 'a-old', 5),
      from('A', 'a-new', 2),
      from('B', 'b-new', 1),
      from('C', 'c-new', 9),
    ]);
    expect(r.map((x) => x.videoId)).toEqual(['b-new', 'a-new', 'c-new']);
  });

  it('两个来源的最新一支是同一支影片时只留一格', () => {
    const r = latestPerSource([from('A', 'same', 1), from('B', 'same', 1)]);
    expect(r).toHaveLength(1);
  });

  it('没有影片回空阵列', () => {
    expect(latestPerSource([])).toEqual([]);
  });
});
