/**
 * 彩虹频道的「精选影片」。两种来源：
 * - 内建的番号清单（站长给的），点了用番号去搜；
 * - 使用者在播放页按「加到精选影片」存下来的，点了直接播那个片源。
 *   存在浏览器 localStorage（线上没有资料库），所以每台装置各自一份。
 */
export interface CodePick {
  /** 番号 */
  code: string;
  actress: string;
}

export const BUILTIN_PICKS: CodePick[] = [
  { code: 'MKMP-414', actress: '樞木葵' },
  { code: 'MKMP-402', actress: '松本一香' },
  { code: 'SSIS-413', actress: '河北' },
  { code: 'SSIS-230', actress: 'miru' },
  { code: 'SSIS-169', actress: 'miru' },
  { code: 'PRED-344', actress: '山岸' },
  { code: 'PRED-396', actress: '楪可憐' },
  { code: 'MIAA-525', actress: '白桃&花狩' },
  { code: 'SQTE-339', actress: '奏音花音' },
  { code: 'MIDV-087', actress: '七澤美亞' },
  { code: 'MIDV-108', actress: '小野六花' },
  { code: 'MIDE-932', actress: '神宮寺' },
  { code: 'MIDV-055', actress: '葵伊吹' },
  { code: 'SSIS-381', actress: '架乃' },
  { code: 'BNST-028', actress: '冰堂梨梨愛' },
  { code: 'KMHRS-048', actress: '新井里真' },
  { code: 'VENU-741', actress: '北條麻妃' },
  { code: 'JUFE-303', actress: '向井藍' },
  { code: 'CAWD-247', actress: '紺野美依奈' },
  { code: 'BLK-567', actress: '森日向子' },
  { code: '390JAC-019', actress: '永井瑪利亞' },
  { code: 'MIAA-527', actress: '北野末奈' },
  { code: 'BLK-502', actress: '深田結梨&今井夏帆' },
  { code: 'S-CUTE-846', actress: '成美' },
  { code: 'REAL-774', actress: '白桃花' },
];

/** 使用者在播放页存下来的一支 */
export interface SavedPick {
  source: string;
  id: string;
  title: string;
  poster: string;
  sourceName: string;
  /** 加入的时间，Unix 毫秒 */
  at: number;
}

export const ADULT_PICKS_KEY = 'moontv_adult_picks';
export const MAX_SAVED_PICKS = 200;

export const pickKey = (p: { source: string; id: string }) =>
  `${p.source}+${p.id}`;

/** 从 localStorage 读回来的东西不可信，格式不对的丢掉 */
export function sanitizePicks(raw: unknown): SavedPick[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedPick[] = [];
  for (const p of raw) {
    if (
      !p ||
      typeof p.source !== 'string' ||
      typeof p.id !== 'string' ||
      typeof p.title !== 'string' ||
      !p.source ||
      !p.id ||
      !p.title
    )
      continue;
    const key = pickKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      source: p.source,
      id: p.id,
      title: p.title,
      poster: typeof p.poster === 'string' ? p.poster : '',
      sourceName: typeof p.sourceName === 'string' ? p.sourceName : '',
      at: Number.isFinite(p.at) ? p.at : 0,
    });
  }
  return out.slice(0, MAX_SAVED_PICKS);
}

/** 新加的排最前面；同一支只留一笔；超过上限丢最旧的 */
export function addPick(
  list: SavedPick[],
  pick: SavedPick,
  max = MAX_SAVED_PICKS
): SavedPick[] {
  const key = pickKey(pick);
  return [pick, ...list.filter((p) => pickKey(p) !== key)].slice(0, max);
}

export function removePick(
  list: SavedPick[],
  target: { source: string; id: string }
): SavedPick[] {
  const key = pickKey(target);
  return list.filter((p) => pickKey(p) !== key);
}

export function loadPicks(): SavedPick[] {
  try {
    return sanitizePicks(
      JSON.parse(localStorage.getItem(ADULT_PICKS_KEY) || '[]')
    );
  } catch {
    return [];
  }
}

export function savePicks(list: SavedPick[]): void {
  try {
    localStorage.setItem(ADULT_PICKS_KEY, JSON.stringify(list));
  } catch {
    // 无痕模式或容量满了就只保留在这次画面里
  }
}

// ── 使用者批次贴上的番号 ─────────────────────────────────────────
// 别人推荐的片常常是一串番号（可能夹着女优名、表情符号、说明文字），
// 贴进来挑出番号存起来，跟内建清单一样点了用番号去搜。只存在这台装置。

export const ADULT_CODE_PICKS_KEY = 'moontv_adult_code_picks';
export const MAX_CODE_PICKS = 300;

/** 长得像番号、但其实是画质／编码的字 */
const NOT_CODES = new Set(['FHD', 'UHD', 'HD', 'SD', 'MP', 'AVC', 'HEVC', 'WEB', 'BD', 'DVD', 'HDR', 'FPS', 'KB', 'MB', 'GB']);

/**
 * 番号写法：
 * - 一般：SSIS-413、ssis413、SSIS 413
 * - 前面带数字的素人番号：390JAC-019
 * - 字母中间有横线：S-CUTE-846
 * - FC2：FC2-PPV-1234567、FC2PPV 1234567
 */
const CODE_RE =
  /(?<![A-Za-z0-9])(?:(FC2)[\s_-]*(?:PPV)?[\s_-]*(\d{5,8})|(\d{3})?([A-Za-z]{1,6}(?:-[A-Za-z]{2,6})?)[\s_-]?(\d{2,5}))(?![A-Za-z0-9])/g;

function normalizeCode(m: RegExpExecArray): string | null {
  if (m[1]) return `FC2-PPV-${m[2]}`;
  const prefix = m[3] ?? '';
  const letters = m[4].toUpperCase();
  const digits = m[5];
  // 至少两个字母（S-CUTE 这种中间有横线的另外算）；排除 1080P、H264 这类
  const plain = letters.replace(/-/g, '');
  if (plain.length < 2 || NOT_CODES.has(letters)) return null;
  // 没有横线又没有前缀数字的（SSIS413），数字至少三位才算，免得把「AB12」这种当番号
  if (!m[0].includes('-') && !prefix && digits.length < 3) return null;
  return `${prefix}${letters}-${digits}`;
}

/** 番号同一行后面的文字当作女优名（去掉标点、表情、网址） */
function nameAfter(line: string, end: number): string {
  return Array.from(
    line
      .slice(end)
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\p{P}\p{S}\s]+/gu, ' ')
      .trim()
  )
    .slice(0, 20)
    .join('')
    .trim();
}

/** 从一段文字挑出所有番号（照出现顺序、去重） */
export function extractCodes(text: string): CodePick[] {
  const out: CodePick[] = [];
  const seen = new Set<string>();
  for (const line of text.normalize('NFKC').split(/\r?\n/)) {
    const matches = Array.from(line.matchAll(CODE_RE)) as RegExpExecArray[];
    matches.forEach((m, i) => {
      const code = normalizeCode(m);
      if (!code || seen.has(code)) return;
      seen.add(code);
      // 同一行有好几个番号时，名字只取到下一个番号前
      const next = matches[i + 1]?.index ?? line.length;
      const actress = nameAfter(line.slice(0, next), (m.index ?? 0) + m[0].length);
      out.push({ code, actress });
    });
  }
  return out;
}

export function sanitizeCodePicks(raw: unknown): CodePick[] {
  if (!Array.isArray(raw)) return [];
  const out: CodePick[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    if (!p || typeof p.code !== 'string') continue;
    const code = extractCodes(p.code)[0]?.code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      actress: typeof p.actress === 'string' ? p.actress.slice(0, 20) : '',
    });
  }
  return out.slice(0, MAX_CODE_PICKS);
}

/** 新的排前面；已经在清单（或内建清单）里的不重复加。回传 [新清单, 实际加了几部] */
export function addCodePicks(
  list: CodePick[],
  found: CodePick[],
  max = MAX_CODE_PICKS
): [CodePick[], number] {
  const have = new Set([
    ...list.map((p) => p.code),
    ...BUILTIN_PICKS.map((p) => p.code),
  ]);
  const fresh = found.filter((p) => !have.has(p.code));
  return [[...fresh, ...list].slice(0, max), fresh.length];
}

export function loadCodePicks(): CodePick[] {
  try {
    return sanitizeCodePicks(
      JSON.parse(localStorage.getItem(ADULT_CODE_PICKS_KEY) || '[]')
    );
  } catch {
    return [];
  }
}

export function saveCodePicks(list: CodePick[]): void {
  try {
    localStorage.setItem(ADULT_CODE_PICKS_KEY, JSON.stringify(list));
  } catch {
    // 存不了就只保留在这次画面里
  }
}
