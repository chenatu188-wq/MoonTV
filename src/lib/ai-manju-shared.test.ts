import {
  addPendingShared,
  applyPending,
  clearPendingShared,
  listPendingShared,
  PENDING_SHARED_TTL_MS,
  sanitizeFollow,
  sanitizeFollows,
  settleShared,
} from '@/lib/ai-manju-shared';

const A = {
  type: 'channel' as const,
  id: 'UCaaaaaaaaaaaaaaaaaaaaaa',
  name: 'A',
};
const B = {
  type: 'channel' as const,
  id: 'UCbbbbbbbbbbbbbbbbbbbbbb',
  name: 'B',
};
const C = { type: 'playlist' as const, id: 'PLcccccccccccccccc', name: 'C' };

describe('sanitizeFollow', () => {
  it('收合法的，名称去掉控制字元、太长截断、空的用 id 顶', () => {
    expect(sanitizeFollow({ ...A, name: ' 频\u0000道 ', extra: 1 })).toEqual({
      ...A,
      name: '频道',
    });
    expect(sanitizeFollow({ ...A, name: 'x'.repeat(200) })?.name).toHaveLength(
      80
    );
    expect(sanitizeFollow({ type: 'channel', id: A.id })?.name).toBe(A.id);
  });

  it.each([
    null,
    'str',
    { type: 'video', id: A.id, name: 'x' },
    { type: 'channel', id: 'not-an-id', name: 'x' },
    { type: 'channel', id: 'https://evil.example/x', name: 'x' },
    { type: 'playlist', id: A.id, name: 'x' }, // 类型跟 id 对不上
  ])('%p → null', (raw) => {
    expect(sanitizeFollow(raw)).toBeNull();
  });

  it('sanitizeFollows 去重、丢掉坏的', () => {
    expect(sanitizeFollows([A, A, { bad: 1 }, C])).toEqual([A, C]);
    expect(sanitizeFollows('x')).toEqual([]);
  });
});

describe('待办', () => {
  beforeEach(clearPendingShared);

  it('同一个来源只留最后一次的决定', () => {
    addPendingShared('add', A, 1);
    addPendingShared('add', B, 2);
    addPendingShared('rm', A, 3);
    expect(listPendingShared(10).map((p) => [p.op, p.name])).toEqual([
      ['add', 'B'],
      ['rm', 'A'],
    ]);
  });

  it('过期的丢掉', () => {
    addPendingShared('add', A, 0);
    expect(listPendingShared(PENDING_SHARED_TTL_MS + 1)).toEqual([]);
  });

  it('settleShared 划掉已经生效的', () => {
    addPendingShared('add', A, 1); // 已经在清单里 → 完成
    addPendingShared('add', B, 2); // 还没
    addPendingShared('rm', C, 3); // 清单里已经没有 → 完成
    settleShared([A]);
    expect(listPendingShared(10).map((p) => p.name)).toEqual(['B']);
  });
});

it('applyPending：清单套上待办', () => {
  const pending = [
    { ...B, op: 'add' as const, at: 1 },
    { ...A, op: 'rm' as const, at: 2 },
    { ...C, op: 'add' as const, at: 3 }, // 已经在清单里，不重复
  ];
  expect(applyPending([A, C], pending)).toEqual([C, B]);
});
