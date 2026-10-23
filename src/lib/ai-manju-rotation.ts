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
  const size = Math.min(20, keys.length);
  const start = (((day * 20) % keys.length) + keys.length) % keys.length;
  return Array.from(
    { length: size },
    (_, i) => keys[(start + i) % keys.length]
  );
}
