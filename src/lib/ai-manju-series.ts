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

const EP_NUM = '[一二两兩三四五六七八九十百\\d]{1,4}';
/** 单一集数：第8集、第八话、EP12、E05。「第1~110集」「1-19集」这种范围不算 */
const EPISODE_RE = new RegExp(
  `第\\s*(${EP_NUM})\\s*[集话話回](?!\\s*[~～\\-—至到])|\\bEP?\\.?\\s*(\\d{1,4})\\b(?!\\s*[~～\\-—])`,
  'i'
);

/** 标题里写的集数（一支影片一集的那种连载）；没写或写的是范围回 null */
export function episodeOf(title: string): number | null {
  const m = EPISODE_RE.exec(title);
  if (!m) return null;
  // 「第1~110集」里的 110 前面是范围符号，不算单集
  const before = title.slice(Math.max(0, m.index - 4), m.index);
  if (/\d\s*[~～\-—至到]\s*$/.test(before)) return null;
  if (m[2]) return Number(m[2]);
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  return parseNumber(m[1]);
}

/** 【】里常放的不是剧名而是这些标签 */
const TAG_RE =
  /全集|合集|合輯|FULL|SUB|字幕|新番|上线|上線|完结|完結|大结局|大結局|短剧|短劇|漫剧|漫劇|动漫|動漫|动画|動畫|AI|首播|热播|熱播|热门|熱門|高清|更新|第.{1,3}[季集部]|^S\d|一口[气氣]|完整版|推荐|推薦|EP|国语|國語|高分|爆款|强推|強推|最新|独播|獨播|BL|4K|预告|預告/i;

const cjkCount = (s: string) => (s.match(/[一-鿿]/g) ?? []).length;

/** 去掉开头的表情符号、【标签】、空白 */
function stripLead(s: string): string {
  let out = s;
  for (let i = 0; i < 4; i++) {
    out = out
      .replace(/^[^一-鿿A-Za-z0-9【《「（(]+/, '')
      .replace(/^【[^】]*】/, '');
  }
  return out.trim();
}

/**
 * 从标题取出剧名（不含季数、集数）。依序尝试：
 * 1.《剧名》 2.【剧名】（排除【全集】这类标签） 3. 剧名第X季
 * 4. 剧名第N集 / 剧名 EP12   5. 剧名｜说明、剧名「说明」这种开头就是剧名的写法
 * YouTube 标题没有固定格式，都认不出来就回 null（很多标题整句都是宣传语，没有剧名）。
 */
export function seriesNameOf(title: string): string | null {
  const quoted = /《([^》]{2,40})》/.exec(title);
  if (quoted) {
    const name = stripSeason(quoted[1]);
    return name.length >= 2 ? name : null;
  }

  const brackets = title.match(/【[^】]{2,30}】/g) ?? [];
  for (const b of brackets) {
    const inner = b.slice(1, -1).trim();
    if (!TAG_RE.test(inner) && cjkCount(inner) >= 2) {
      const name = stripSeason(inner);
      if (name.length >= 2) return name;
    }
  }

  const tail = (raw: string, min: number): string | null => {
    // 往回只取最后一段，避开前面的宣传语
    const name = (
      stripLead(raw)
        .split(/[！!？?，,。]/)
        .pop() ?? ''
    )
      .replace(/[:：\s\-—·]+$/, '')
      .trim();
    return name.length >= min && cjkCount(name) >= 2 ? name : null;
  };

  const season = new RegExp(
    `([\\u4e00-\\u9fffA-Za-z0-9：:，,！!？?]{3,30}?)\\s*第\\s*${NUM}\\s*季`
  ).exec(title);
  if (season) {
    const name = tail(season[1], 3);
    if (name) return name;
  }

  const ep = EPISODE_RE.exec(title);
  if (ep && episodeOf(title) !== null) {
    // 剧名必须从标题开头一路接到集数，中间不能有断句：
    // 「意外荒岛 第76集」算，「…高能，打开第一集根本停不下来」不算
    const before = stripLead(title.slice(0, ep.index));
    if (!/[！!？?，,。]/.test(before)) {
      const name = tail(before, 2);
      if (name && name.length <= 24) return stripSeason(name) || null;
    }
  }

  // 「剧名｜说明」「剧名（第1-300集）」「剧名「一句话简介」」：开头一小段就是剧名
  const lead = stripLead(title);
  const cut = lead.search(/[|｜丨「『（(]/);
  if (cut > 0) {
    const head = lead.slice(0, cut).trim();
    // 用引号隔开时，引号要一路包到标题结尾才算简介；
    // 否则只是句子里引了一句话（…妻子还劝我「一家人要大度」！忍了八年…）
    const quoteOk = !/[「『]/.test(lead[cut]) || /[」』]\s*(#.*)?$/.test(lead);
    if (
      quoteOk &&
      head.length >= 3 &&
      head.length <= 26 &&
      cjkCount(head) >= 3 &&
      !/[！!？?。#]/.test(head)
    ) {
      return stripSeason(head) || null;
    }
  }
  return null;
}
