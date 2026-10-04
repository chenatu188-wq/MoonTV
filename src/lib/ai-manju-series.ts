/**
 * 从影片标题判断「是哪部剧、第几季」。纯函数，前后端共用。
 * YouTube 上的漫剧标题没有固定格式，这里只认几种最常见的写法，认不出来就回 null。
 */

const CN_DIGIT: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** 「十三」「二十一」「3」→ 数字；看不懂回 null */
function parseNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  const m = /^([一二两兩三四五六七八九])?十([一二三四五六七八九])?$/.exec(s);
  if (m) return (m[1] ? CN_DIGIT[m[1]] : 1) * 10 + (m[2] ? CN_DIGIT[m[2]] : 0);
  if (s.length === 1 && s in CN_DIGIT) return CN_DIGIT[s];
  return null;
}

const NUM = '[一二两兩三四五六七八九十\\d]{1,3}';
const SEASON_RE = new RegExp(
  `第\\s*(${NUM})\\s*[季部]|[【\\[(（]?\\bS(\\d{1,2})\\b[】\\])）]?|Season\\s*(\\d{1,2})`,
  'i'
);

/** 标题里写的季数；没写回 null */
export function seasonOf(title: string): number | null {
  const m = SEASON_RE.exec(title);
  if (m) return parseNumber(m[1] ?? m[2] ?? m[3]);
  // 《地宫蛇母2》《xxx》3 这种直接接数字的写法
  const tail =
    /《[^》]{2,40}?(\d{1,2})》|》\s*(\d{1,2})(?!\d|[~～\-—]|集|章)/.exec(title);
  if (tail) return Number(tail[1] ?? tail[2]);
  return null;
}

/** 去掉片名尾巴上的季数、完结篇之类的字样 */
function stripSeason(name: string): string {
  return name
    .replace(new RegExp(`[:：\\s]*第\\s*${NUM}\\s*[季部].*$`), '')
    .replace(/[:：\s]*(完结篇|完結篇|大结局|大結局|全集|合集).*$/, '')
    .replace(/[:：\s]*\d{1,2}$/, '')
    .trim();
}

/**
 * 从标题取出剧名（不含季数）。
 * 优先认《剧名》；没有书名号时，认「剧名第X季」这种写法。
 */
export function seriesNameOf(title: string): string | null {
  const quoted = /《([^》]{2,40})》/.exec(title);
  if (quoted) {
    const name = stripSeason(quoted[1]);
    return name.length >= 2 ? name : null;
  }
  const m = new RegExp(
    `([\\u4e00-\\u9fffA-Za-z0-9：:，,！!？?]{3,30}?)\\s*第\\s*${NUM}\\s*季`
  ).exec(title);
  if (m) {
    // 往回只取最后一段，避开前面的宣传语
    const name = (m[1].split(/[！!？?，,]/).pop() ?? '')
      .replace(/[:：\s]+$/, '')
      .trim();
    return name.length >= 3 ? name : null;
  }
  return null;
}
