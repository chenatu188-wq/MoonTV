import { dailyChannelKeys, taipeiDay } from './ai-manju-rotation';

test('all eligible channels appear exactly once every week, excluding pins', () => {
  for (const total of [7, 20, 63, 183, 186, 201]) {
    const channels = Array.from({ length: total + 2 }, (_, i) => ({
      key: `c${i}`,
    }));
    const pins = ['c0', 'c1'];
    for (let start = 0; start < 7; start++) {
      const batches = Array.from({ length: 7 }, (_, i) =>
        dailyChannelKeys(channels, pins, start + i)
      );
      const week = batches.flat();
      expect(week).toHaveLength(total);
      expect(new Set(week).size).toBe(total);
      expect(week).not.toContain('c0');
      expect(week).not.toContain('c1');
      expect(
        Math.max(...batches.map((b) => b.length)) -
          Math.min(...batches.map((b) => b.length))
      ).toBeLessThanOrEqual(1);
      expect(batches[0]).toEqual(
        dailyChannelKeys([...channels].reverse(), pins, start)
      );
    }
  }
});
test('small lists rotate without empty days and empty lists stay empty', () => {
  const channels = [{ key: 'a' }, { key: 'b' }];
  const week = Array.from({ length: 7 }, (_, day) =>
    dailyChannelKeys(channels, [], day)
  );
  expect(week.every((batch) => batch.length === 1)).toBe(true);
  expect(new Set(week.flat()).size).toBe(2);
  expect(dailyChannelKeys(channels, ['a', 'b'], 0)).toEqual([]);
  expect(dailyChannelKeys([], [], 0)).toEqual([]);
});
test('rotation changes at Taipei midnight', () => {
  const before = Date.parse('2026-10-23T15:59:59Z');
  expect(taipeiDay(before + 1000)).toBe(taipeiDay(before) + 1);
});
