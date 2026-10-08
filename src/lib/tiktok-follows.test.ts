import {
  addPending,
  clearPending,
  listPending,
  parseHandle,
  PENDING_TTL_MS,
  settle,
} from '@/lib/tiktok-follows';

describe('parseHandle', () => {
  it.each([
    ['@cc_tv1227', 'cc_tv1227'],
    ['cc_tv1227', 'cc_tv1227'],
    ['  @O.Dim.Trinh993 ', 'o.dim.trinh993'],
    ['https://www.tiktok.com/@cc_tv1227', 'cc_tv1227'],
    [
      'https://www.tiktok.com/@cc_tv1227/video/7412345678901234567?lang=zh',
      'cc_tv1227',
    ],
    ['tiktok.com/@cc_tv1227?is_from_webapp=1', 'cc_tv1227'],
  ])('%s → %s', (input, expected) => {
    expect(parseHandle(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'https://vt.tiktok.com/ZSabcdef/', // 短网址看不出帐号
    'https://www.youtube.com/@someone',
    '有中文的帐号',
    'a',
    'x'.repeat(25),
    'bad handle',
    'trailing.',
    '../etc/passwd',
  ])('认不出来：%s', (input) => {
    expect(parseHandle(input)).toBeNull();
  });
});

describe('待办', () => {
  beforeEach(clearPending);

  it('同一个帐号只留最后一次的决定', () => {
    addPending('add', 'aaa', 1);
    addPending('add', 'bbb', 2);
    addPending('rm', 'aaa', 3);
    expect(listPending(10)).toEqual([
      { op: 'add', handle: 'bbb', at: 2 },
      { op: 'rm', handle: 'aaa', at: 3 },
    ]);
  });

  it('过期的自动丢掉', () => {
    addPending('add', 'old', 0);
    addPending('add', 'new', PENDING_TTL_MS);
    expect(listPending(PENDING_TTL_MS + 1).map((p) => p.handle)).toEqual([
      'new',
    ]);
  });

  it('资料里看得到结果就划掉', () => {
    addPending('add', 'added', 1); // 已出现 → 完成
    addPending('add', 'waiting', 2); // 还没出现 → 留着
    addPending('rm', 'removed', 3); // 已消失 → 完成
    addPending('rm', 'still', 4); // 还在 → 留着
    settle(['Added', 'still', 'other']);
    expect(listPending(10).map((p) => p.handle)).toEqual(['waiting', 'still']);
  });
});
