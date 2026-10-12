import {
  addPick,
  BUILTIN_PICKS,
  removePick,
  sanitizePicks,
} from '@/lib/adult-picks';

const pick = (id: string, at = 1) => ({
  source: 'src',
  id,
  title: `片 ${id}`,
  poster: '',
  sourceName: '来源',
  at,
});

it('内建清单的番号不重复', () => {
  const codes = BUILTIN_PICKS.map((p) => p.code);
  expect(new Set(codes).size).toBe(codes.length);
  expect(codes).toHaveLength(25);
});

describe('addPick / removePick', () => {
  it('新的排最前面，同一支只留一笔', () => {
    const list = addPick([pick('a'), pick('b')], { ...pick('b'), at: 9 });
    expect(list.map((p) => p.id)).toEqual(['b', 'a']);
    expect(list[0].at).toBe(9);
  });

  it('同一个 id 不同片源算两支', () => {
    const list = addPick([pick('a')], { ...pick('a'), source: 'other' });
    expect(list).toHaveLength(2);
  });

  it('超过上限丢最旧的', () => {
    expect(
      addPick([pick('a'), pick('b')], pick('c'), 2).map((p) => p.id)
    ).toEqual(['c', 'a']);
  });

  it('removePick', () => {
    expect(
      removePick([pick('a'), pick('b')], { source: 'src', id: 'a' }).map(
        (p) => p.id
      )
    ).toEqual(['b']);
  });
});

it('sanitizePicks 丢掉格式不对和重复的', () => {
  const out = sanitizePicks([
    pick('a'),
    pick('a'),
    { source: 'src', id: 'b', title: '' },
    { source: 'src', id: 'c', title: 'C', poster: 5, at: 'x' },
    null,
    'junk',
  ]);
  expect(out.map((p) => [p.id, p.poster, p.at])).toEqual([
    ['a', '', 1],
    ['c', '', 0],
  ]);
  expect(sanitizePicks('x')).toEqual([]);
});
