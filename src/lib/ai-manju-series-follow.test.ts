import {
  type SearchHit,
  type SeriesFollow,
  applyCheck,
  applyHongguoCheck,
  episodeLabel,
  extractTitles,
  followKey,
  latestOf,
  markSeen,
  newCount,
  pickHongguo,
  sanitizeSeriesFollows,
  sortFollows,
} from '@/lib/ai-manju-series-follow';

const hit = (
  id: string,
  season: number | null,
  episode: number | null,
  match = true
): SearchHit => ({
  videoId: id.padEnd(11, 'x'),
  title: `${id} 第${season}季第${episode}集`,
  thumbnail: 'https://i.ytimg.com/vi/a/hqdefault.jpg',
  channel: '漫剧社',
  channelUrl: 'https://www.youtube.com/channel/UCrn_1U0FXZICc1np1gzBuYg',
  season,
  episode,
  match,
});

const base: SeriesFollow = {
  name: '仙尊归来',
  channelId: 'UCrn_1U0FXZICc1np1gzBuYg',
  channel: '漫剧社',
  known: [],
  newIds: [],
  latest: null,
  checkedAt: 0,
  addedAt: 1,
};

describe('latestOf', () => {
  it('取季数、集数最大的；没写季数当第 1 季；不吻合的不算', () => {
    const l = latestOf([
      hit('a', 1, 10),
      hit('b', 2, 3),
      hit('c', null, 40),
      hit('z', 9, 9, false),
    ]);
    expect(l?.videoId).toBe('bxxxxxxxxxx');
    expect(l && 'match' in l).toBe(false);
  });
  it('没有吻合的回 null', () => {
    expect(latestOf([hit('z', 1, 1, false)])).toBeNull();
  });
});

describe('applyCheck / markSeen', () => {
  it('第一次检查只建立基准，不算新集', () => {
    const f = applyCheck(base, [hit('a', 1, 1), hit('b', 1, 2)], 100);
    expect(f.known).toHaveLength(2);
    expect(f.newIds).toEqual([]);
    expect(f.latest?.episode).toBe(2);
    expect(f.checkedAt).toBe(100);
  });

  it('之后多出来的集数算新集，看过就不再算', () => {
    let f = applyCheck(base, [hit('a', 1, 1)], 100);
    f = applyCheck(f, [hit('a', 1, 1), hit('b', 1, 2), hit('c', 2, 1)], 200);
    expect(f.newIds).toEqual(['bxxxxxxxxxx', 'cxxxxxxxxxx']);
    expect(f.latest?.season).toBe(2);
    f = markSeen(f, ['bxxxxxxxxxx']);
    expect(f.newIds).toEqual(['cxxxxxxxxxx']);
    f = markSeen(f);
    expect(f.newIds).toEqual([]);
    expect(f.known).toContain('cxxxxxxxxxx');
  });

  it('这次搜寻没找到也不会弄丢原本的最新集', () => {
    let f = applyCheck(base, [hit('a', 1, 1)], 100);
    f = applyCheck(f, [], 200);
    expect(f.latest?.videoId).toBe('axxxxxxxxxx');
  });
});

describe('sanitizeSeriesFollows / sortFollows', () => {
  it('挡掉坏资料、去重', () => {
    const list = sanitizeSeriesFollows([
      base,
      { ...base },
      { name: 'x' },
      { ...base, name: '别的剧', channelId: 'bad', known: ['bad id', 'axxxxxxxxxx'] },
      null,
    ]);
    expect(list.map((f) => f.name)).toEqual(['仙尊归来', '别的剧']);
    expect(list[1].channelId).toBeNull();
    expect(list[1].known).toEqual(['axxxxxxxxxx']);
  });

  it('有新集的排前面', () => {
    const a = { ...base, name: 'A', addedAt: 5 };
    const b = { ...base, name: 'B', addedAt: 1, newIds: ['bxxxxxxxxxx'] };
    expect(sortFollows([a, b]).map((f) => f.name)).toEqual(['B', 'A']);
  });

  it('episodeLabel', () => {
    expect(episodeLabel({ season: 2, episode: 5 })).toBe('第 2 季 第 5 集');
    expect(episodeLabel({ season: null, episode: null })).toBe('最新一支');
  });
});

describe('extractTitles', () => {
  it('从推荐文字挑出剧名', () => {
    const text = [
      '🔥网友推荐🔥',
      '网友推荐红果好剧：',
      '1. 仙尊归来（全80集）',
      '2、《重生之都市修仙》第二季 强推！',
      '3) 万古神帝 #AI漫剧 #推荐',
      '《斗破苍穹》《凡人修仙传》',
      '逆天邪神、武动乾坤 / 完美世界',
      '仙尊归来',
      'https://youtu.be/abc',
      '必看',
    ].join('\n');
    expect(extractTitles(text)).toEqual([
      '仙尊归来',
      '重生之都市修仙',
      '万古神帝',
      '斗破苍穹',
      '凡人修仙传',
      '逆天邪神',
      '武动乾坤',
      '完美世界',
    ]);
  });

  it('空白或全是说明回空', () => {
    expect(extractTitles('\n推荐\n😀😀\n')).toEqual([]);
  });
});

describe('红果的剧', () => {
  const hits = [
    { seriesId: '111111', title: '萧族复兴记', cover: 'https://a/1.jpg', episodes: 3 },
    { seriesId: '222222', title: '剑神归来：我和驴子的十万年第一季', cover: '', episodes: 374 },
    { seriesId: '333333', title: '当家主母的自我修养', cover: '', episodes: 188 },
  ];

  it('pickHongguo：片名一样的优先、其次开头一样的；不像的不收', () => {
    expect(pickHongguo('当家主母的自我修养', hits)?.seriesId).toBe('333333');
    expect(pickHongguo('剑神归来', hits)?.seriesId).toBe('222222');
    expect(pickHongguo('斗破苍穹', hits)).toBeNull();
  });

  it('集数变多算新集，看过就归零；第一次查只建立基准', () => {
    const f: SeriesFollow = {
      ...base,
      name: '当家主母的自我修养',
      channelId: null,
      hg: { id: '333333', cover: '', total: 180, seen: 180 },
      checkedAt: 5,
    };
    const checked = applyHongguoCheck(f, hits[2], 10);
    expect(newCount(checked)).toBe(8);
    expect(checked.checkedAt).toBe(10);
    expect(newCount(markSeen(checked))).toBe(0);
    const first = applyHongguoCheck({ ...f, checkedAt: 0 }, hits[2]);
    expect(newCount(first)).toBe(0);
    // 这次没查到：不动集数，只记下查过了
    expect(applyHongguoCheck(f, null, 20).hg).toEqual(f.hg);
  });

  it('followKey 用红果编号；localStorage 读回来保留 hg、挡掉坏的', () => {
    expect(followKey({ name: 'x', channelId: null, hg: { id: '333333' } })).toBe('hg:333333');
    const [ok, bad] = sanitizeSeriesFollows([
      { ...base, name: '主母', hg: { id: '333333', cover: 'javascript:x', total: '9', seen: 3 } },
      { ...base, name: '别的', hg: { id: 'abc' } },
    ]);
    expect(ok.hg).toEqual({ id: '333333', cover: '', total: 9, seen: 3 });
    expect(bad.hg).toBeUndefined();
  });
});
