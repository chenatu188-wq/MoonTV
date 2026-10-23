import { dailyChannelKeys, taipeiDay } from './ai-manju-rotation';

const channels = Array.from({ length: 65 }, (_, i) => ({ key: `c${i}` }));
test('daily batches exclude pins, stay stable and cover every eligible channel', () => {
  const pins = ['c0', 'c1'];
  const first = dailyChannelKeys(channels, pins, 0);
  expect(first).toHaveLength(20);
  expect(first).toEqual(dailyChannelKeys([...channels].reverse(), pins, 0));
  expect(first).not.toContain('c0');
  expect(first).not.toContain('c1');
  expect(dailyChannelKeys(channels, pins, 1)).not.toEqual(first);
  const cycle = Array.from({ length: 4 }, (_, day) =>
    dailyChannelKeys(channels, pins, day)
  ).flat();
  expect(new Set(cycle).size).toBe(63);
});
test('small and empty lists have no duplicates', () => {
  expect(dailyChannelKeys(channels.slice(0, 3), ['c0'], 10).sort()).toEqual([
    'c1',
    'c2',
  ]);
  expect(dailyChannelKeys([], [], 0)).toEqual([]);
});
test('rotation changes at Taipei midnight', () => {
  const before = Date.parse('2026-10-23T15:59:59Z');
  expect(taipeiDay(before + 1000)).toBe(taipeiDay(before) + 1);
});
