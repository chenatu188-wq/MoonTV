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
