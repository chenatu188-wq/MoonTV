import { durationOf, sortTop } from './ai-manju-top-sort';

const v = (id: string, meta: string, published: string) =>
  ({ videoId: id, meta, published } as never);

describe('durationOf', () => {
  it('读出时:分:秒与分:秒', () => {
    expect(durationOf({ meta: '1:08:35 · 3 個月前 · 觀看次數：7091次' })).toBe(
      4115
    );
    expect(durationOf({ meta: '7:46 · 4 個月前' })).toBe(466);
  });
  it('没有片长回 -1', () => {
    expect(durationOf({ meta: '3 天前 · 观看次数：1.2万次' })).toBe(-1);
    expect(durationOf({})).toBe(-1);
  });
});

describe('sortTop', () => {
  const list = [
    v('a', '7:46 · 4 個月前', '2026-06-29T00:00:00Z'),
    v('b', '1:08:35 · 3 個月前', '2026-07-29T00:00:00Z'),
    v('c', '31:02 · 1 個月前', '2026-09-27T00:00:00Z'),
    v('d', '5:58 · 1 個月前', '2026-09-27T00:00:00Z'),
  ];
  const ids = (l: { videoId: string }[]) => l.map((x) => x.videoId).join('');
  it('hot 原样', () => expect(ids(sortTop(list, 'hot'))).toBe('abcd'));
  it('long 由长到短', () => expect(ids(sortTop(list, 'long'))).toBe('bcad'));
  it('date 由新到旧，同一天维持原顺序', () =>
    expect(ids(sortTop(list, 'date'))).toBe('cdba'));
});
