const BROKEN_LAJIAO_POSTER_RE = /^https?:\/\/fb\.lj260522\.top\//i;

const LAJIAO_SOURCE_KEY = 'apilj.com';

/** 辣椒仍回傳已失效的舊圖床；能辨識番號時，改用片商公開封面。 */
export function repairAdultPoster(
  source: string,
  title: string,
  poster: string
): string {
  if (source !== LAJIAO_SOURCE_KEY || !BROKEN_LAJIAO_POSTER_RE.test(poster)) {
    return poster;
  }

  const heyzo = title.match(/\bHEYZO[-_\s]?(\d{3,5})\b/i);
  if (heyzo) {
    const id = heyzo[1];
    const group = `${Math.floor(Number(id) / 1000) * 1000}`.padStart(4, '0');
    return `https://www.heyzo.com/contents/${group}/${id}/images/player_thumbnail.jpg`;
  }

  const code = title.match(/\b([A-Z]{2,10})[-_\s](\d{2,6})\b/i);
  if (!code) return '';

  const contentId = `${code[1].toLowerCase()}${code[2].padStart(5, '0')}`;
  return `https://pics.dmm.co.jp/digital/video/${contentId}/${contentId}pl.jpg`;
}
