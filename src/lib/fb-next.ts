/** 「FB 影片」播完接下一支 */

interface NextItem {
  id: string;
  page: string;
  title: string;
  published?: number;
}

/**
 * 《劇名》里的剧名，去掉结尾的季数：
 * 《万倍空间：我坐拥神藏2》、《团宠假千金惊艳全城第5季》、《…第六季》都只留剧名。没有书名号回 null
 */
export function fbSeriesOf(title: string): string | null {
  const m = title.match(/《([^》]{2,60})》/);
  if (!m) return null;
  const name = m[1]
    .replace(
      /\s*(第\s*[\d一二三四五六七八九十]+\s*[季部]|[\d]+|[一二三四五六七八九十]+)$/,
      ''
    )
    .trim();
  return name || null;
}

/**
 * 下一支：同一个粉专、同一部剧里，比这支晚上传的最早那一支（下一季／下一集）；
 * 没有就照画面上的顺序接下一支。都没有回 null
 */
export function nextFbVideo<T extends NextItem>(cur: T, list: T[]): T | null {
  const series = fbSeriesOf(cur.title);
  if (series && cur.published) {
    const later = list
      .filter(
        (v) =>
          v.id !== cur.id &&
          v.page === cur.page &&
          (v.published ?? 0) > (cur.published ?? 0) &&
          fbSeriesOf(v.title) === series
      )
      .sort((a, b) => (a.published ?? 0) - (b.published ?? 0));
    if (later.length) return later[0];
  }
  const i = list.findIndex((v) => v.id === cur.id);
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
}
