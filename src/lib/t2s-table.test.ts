import { toSimplifiedFull } from './t2s-table';

describe('toSimplifiedFull', () => {
  it('转得动 cn-converter 漏掉的字', () => {
    expect(toSimplifiedFull('意外荒島')).toBe('意外荒岛');
    expect(toSimplifiedFull('雲上雙花')).toBe('云上双花');
    expect(toSimplifiedFull('萬妖圖錄傳')).toBe('万妖图录传');
  });

  it('简体与非中文不变', () => {
    expect(toSimplifiedFull('万妖图录传 S2 abc')).toBe('万妖图录传 S2 abc');
  });
});
