/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 红果官网的搜寻（hongguoduanju.com/search/关键字）。
 * TikTok 上的漫剧片段常常不写剧名，只给一个四个字的「口令」（例：石海寻徒）叫人去红果 App 搜。
 * 官网的搜寻也吃这种口令，所以拿它把口令换回剧名。纯函数，抓网页的部分在 API 路由。
 */
export interface HongguoSearchItem {
  seriesId: string;
  title: string;
  cover: string;
  /** 集数；拿不到是 0 */
  episodes: number;
  /** 例：「4388万热度」 */
  heat: string;
  intro: string;
}

/** 从 start 那个 [ 开始，取出整段 JSON 阵列的原文；括号不成对回 null */
function sliceArray(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      if (--depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 搜寻结果嵌在页面的一包 JSON 里（searchList）。没有结果或页面改版回空阵列 */
export function parseHongguoSearch(html: string): HongguoSearchItem[] {
  const marker = '"searchList":';
  const at = html.indexOf(marker);
  if (at < 0) return [];
  const raw = sliceArray(html, at + marker.length);
  if (!raw) return [];
  let list: any[];
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  const out: HongguoSearchItem[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(list) ? list : []) {
    const v = x?.video_data;
    const seriesId = String(v?.series_id ?? '');
    const title = String(v?.series_title ?? x?.name ?? '').trim();
    if (!/^\d{5,25}$/.test(seriesId) || !title || seen.has(seriesId)) continue;
    seen.add(seriesId);
    out.push({
      seriesId,
      title,
      cover: String(v.series_cover ?? ''),
      episodes: Number(v.episode_cnt) || 0,
      heat: String(v.hot_score_data?.text ?? ''),
      intro: String(v.series_intro ?? '').slice(0, 200),
    });
  }
  return out;
}

/** 搜寻字串：去头尾空白，太长或空的不收 */
export function cleanHongguoQuery(q: string | null): string | null {
  const s = (q ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  return s.length >= 1 && s.length <= 30 ? s : null;
}

/**
 * 从 TikTok 影片的说明文字猜出红果口令：第一个 # 之前的那段字。
 * 口令是 2～8 个汉字、中间没有空白和标点（例：「石海尋徒#紅果短劇app免費看 #短劇」→ 石海尋徒）。
 * 前面是一整句话、或根本没写字的回 null。
 */
export function promoKeywordOf(title: string): string | null {
  const head = title.split('#')[0].trim();
  return /^[一-鿿]{2,8}$/.test(head) ? head : null;
}
