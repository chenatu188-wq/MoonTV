import {
  addedAt,
  hitsLookReal,
  isAdultCategoryName,
  mergeHot,
  mergeLatest,
} from '@/lib/browse-latest';

const NOW = 1_791_500_000;
const raw = (id: number, name: string, daysAgo: number, extra = {}) => ({
  vod_id: id,
  vod_name: name,
  vod_pic: `https://img/${id}.jpg`,
  vod_year: '2026',
  vod_remarks: '更新至10集',
  vod_time_add: NOW - daysAgo * 86400,
  ...extra,
});

describe('addedAt', () => {
  it('优先用上架时间，字串数字也可以', () => {
    expect(
      addedAt({ vod_time_add: '1790837137', vod_time: '2020-01-01 00:00:00' })
    ).toBe(1790837137);
  });
  it('没有上架时间就用最后更新时间（北京时间）', () => {
    expect(addedAt({ vod_time: '2026-10-09 11:52:03' })).toBe(
      Math.floor(Date.parse('2026-10-09T03:52:03Z') / 1000)
    );
  });
  it('都没有回 0', () => {
    expect(addedAt({})).toBe(0);
    expect(addedAt({ vod_time_add: 0, vod_time: '乱写' })).toBe(0);
  });
});

describe('isAdultCategoryName', () => {
  it('成人分类要挡掉', () => {
    expect(isAdultCategoryName('里番动漫')).toBe(true);
    expect(isAdultCategoryName('伦理片')).toBe(true);
    expect(isAdultCategoryName('国产动漫')).toBe(false);
  });
});

describe('mergeLatest', () => {
  it('跨来源合并，新上架的排前面', () => {
    const r = mergeLatest(
      [
        {
          source: 'a',
          source_name: 'A站',
          list: [raw(1, '旧片', 9), raw(2, '新片', 1)],
        },
        { source: 'b', source_name: 'B站', list: [raw(7, '中间', 4)] },
      ],
      40,
      NOW
    );
    expect(r.map((x) => x.title)).toEqual(['新片', '中间', '旧片']);
    expect(r[0]).toMatchObject({
      id: '2',
      source: 'a',
      source_name: 'A站',
      year: '2026',
      remarks: '更新至10集',
    });
  });

  it('同一部片只留一格（先出现的来源），上架时间取最早的', () => {
    const r = mergeLatest(
      [
        { source: 'a', source_name: 'A站', list: [raw(1, '凡人 修仙传', 2)] },
        { source: 'b', source_name: 'B站', list: [raw(9, '凡人修仙传', 5)] },
      ],
      40,
      NOW
    );
    expect(r).toHaveLength(1);
    expect(r[0].source).toBe('a');
    expect(r[0].added).toBe(NOW - 5 * 86400);
  });

  it('没有片名、没有时间、时间在未来的不要', () => {
    const r = mergeLatest(
      [
        {
          source: 'a',
          source_name: 'A站',
          list: [
            raw(1, '', 1),
            raw(2, '没时间', 1, { vod_time_add: 0 }),
            raw(3, '未来片', -30),
            raw(4, '正常', 1),
          ],
        },
      ],
      40,
      NOW
    );
    expect(r.map((x) => x.title)).toEqual(['正常']);
  });

  it('最多 limit 笔', () => {
    const list = Array.from({ length: 80 }, (_, i) => raw(i + 1, `片${i}`, i));
    expect(
      mergeLatest([{ source: 'a', source_name: 'A', list }], 40, NOW)
    ).toHaveLength(40);
  });
});

const hit = (
  id: number,
  name: string,
  total: number,
  month: number,
  week: number,
  day = 0
) => ({
  vod_id: id,
  vod_name: name,
  vod_hits: total,
  vod_hits_month: month,
  vod_hits_week: week,
  vod_hits_day: day,
});
// 真的计数器：日 ≤ 周 ≤ 月 ≤ 总
const REAL = [
  hit(1, '甲', 4521, 4426, 1318, 20),
  hit(2, '乙', 300, 300, 300, 5),
  hit(3, '丙', 9000, 2000, 500, 80),
  hit(4, '丁', 50, 50, 10),
  hit(5, '戊', 700, 100, 40, 3),
];
// 乱数填的：周比总还多
const FAKE = [
  hit(11, '假一', 520, 895, 340, 913),
  hit(12, '假二', 243, 941, 245, 500),
  hit(13, '假三', 987, 104, 409, 55),
  hit(14, '假四', 518, 936, 799, 179),
  hit(15, '假五', 976, 148, 28, 887),
];

describe('hitsLookReal', () => {
  it('日 ≤ 周 ≤ 月 ≤ 总 的才算真的', () => {
    expect(hitsLookReal(REAL)).toBe(true);
    expect(hitsLookReal(FAKE)).toBe(false);
  });
  it('全是 0 或样本太少不算', () => {
    expect(hitsLookReal([hit(1, 'a', 0, 0, 0)])).toBe(false);
    expect(hitsLookReal(REAL.slice(0, 3))).toBe(false);
    expect(hitsLookReal([])).toBe(false);
  });
});

describe('mergeHot', () => {
  it('只用点击数可信的来源，按本月点击排', () => {
    const r = mergeHot([
      { source: 'real', source_name: '真', list: REAL },
      { source: 'fake', source_name: '假', list: FAKE },
    ]);
    expect(r.map((x) => x.title)).toEqual(['甲', '丙', '乙', '戊', '丁']);
    expect(r[0]).toMatchObject({ source: 'real', hits: 4426 });
  });
  it('没有可信来源就回空阵列', () => {
    expect(
      mergeHot([{ source: 'fake', source_name: '假', list: FAKE }])
    ).toEqual([]);
  });
  it('同一部片留点击多的那个来源', () => {
    const other = REAL.map((x) => ({
      ...x,
      vod_hits: 99999,
      vod_hits_month: x.vod_name === '丁' ? 8888 : 1,
      vod_hits_week: 1,
      vod_hits_day: 0,
    }));
    const r = mergeHot([
      { source: 'a', source_name: 'A', list: REAL },
      { source: 'b', source_name: 'B', list: other },
    ]);
    expect(r[0]).toMatchObject({ title: '丁', source: 'b', hits: 8888 });
    expect(r).toHaveLength(5);
  });
});
