import {
  addCodePicks,
  addPick,
  BUILTIN_PICKS,
  extractCodes,
  removePick,
  sanitizeCodePicks,
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

describe('extractCodes', () => {
  it('挑出各种写法的番号，后面的字当女优名', () => {
    const text = [
      '🔥 推荐 🔥',
      'MKMP-414 樞木葵',
      'ssis413、SSIS 230 miru',
      '390JAC-019 永井瑪利亞',
      'S-CUTE-846（成美）',
      'FC2-PPV-1234567 素人',
      'ＩＰＸ－１２３ 全形也认得',
      '看这个 https://example.com/abc 1080P H264 FHD1080 MP4',
    ].join('\n');
    expect(extractCodes(text)).toEqual([
      { code: 'MKMP-414', actress: '樞木葵' },
      { code: 'SSIS-413', actress: '' },
      { code: 'SSIS-230', actress: 'miru' },
      { code: '390JAC-019', actress: '永井瑪利亞' },
      { code: 'S-CUTE-846', actress: '成美' },
      { code: 'FC2-PPV-1234567', actress: '素人' },
      { code: 'IPX-123', actress: '全形也认得' },
    ]);
  });

  it('重复的只留一个', () => {
    expect(extractCodes('ABP-001\nabp001 again').map((p) => p.code)).toEqual(['ABP-001']);
  });
});

describe('addCodePicks / sanitizeCodePicks', () => {
  it('新的排前面，内建清单和已有的不重复加', () => {
    const [list, added] = addCodePicks(
      [{ code: 'IPX-123', actress: '' }],
      [
        { code: 'MKMP-414', actress: '' },
        { code: 'IPX-123', actress: '' },
        { code: 'ABP-001', actress: 'x' },
      ]
    );
    expect(added).toBe(1);
    expect(list.map((p) => p.code)).toEqual(['ABP-001', 'IPX-123']);
  });

  it('localStorage 读回来的坏资料丢掉', () => {
    expect(
      sanitizeCodePicks([{ code: 'ipx123', actress: 'a' }, { code: 'nope' }, null, { code: 'IPX-123' }])
    ).toEqual([{ code: 'IPX-123', actress: 'a' }]);
    expect(sanitizeCodePicks('x')).toEqual([]);
  });
});
