/** 台北日期序号，跨装置、重新整理都使用同一批。 */
export function taipeiDay(now = Date.now()): number {
  return Math.floor((now + 8 * 60 * 60 * 1000) / 86_400_000);
}

/** 固定频道顺序分批循环，保证每个未置顶频道都有机会排到前面。 */
export function dailyChannelKeys(
  channels: { key: string }[],
  pins: string[],
  day: number
): string[] {
  const pinned = new Set(pins);
  const keys = Array.from(new Set(channels.map((c) => c.key)))
    .filter((key) => !pinned.has(key))
    .sort();
  if (!keys.length) return [];
  // 1970-01-01 是星期四；台北时间周一到周日均分，每周完整轮一遍。
  const weekday = (((day + 3) % 7) + 7) % 7;
  if (keys.length < 7) return [keys[weekday % keys.length]];
  const start = Math.floor((weekday * keys.length) / 7);
  const end = Math.floor(((weekday + 1) * keys.length) / 7);
  return keys.slice(start, end);
}
