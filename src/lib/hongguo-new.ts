/**
 * 红果「新上线」：官网没有这个榜，从分类页的片库自己排出来。纯函数，方便测试。
 */
import type { HongguoRankItem } from '@/app/api/ai-manju/hongguo/route';

export interface CatalogItem {
  seriesId: string;
  title: string;
  cover: string;
  episodes: string;
}

export function parseCatalog(html: string): {
  items: CatalogItem[];
  pages: number;
} {
  const items: CatalogItem[] = [];
  const re =
    /<a class="[^"]*card[^"]*" href="\/detail\?series_id=(\d+)">([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const img = /<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"/.exec(m[2]);
    if (!img) continue;
    items.push({
      seriesId: m[1],
      // eslint-disable-next-line no-control-regex
      title: img[2].replace(/[\u0000-\u001f]/g, '').trim(),
      cover: img[1].replace(/&amp;/g, '&'),
      episodes: /episode[^"]*">([^<]+)</.exec(m[2])?.[1] ?? '',
    });
  }
  const pageNums = Array.from(html.matchAll(/\?page=(\d+)/g), (x) =>
    Number(x[1])
  );
  return { items, pages: Math.max(1, ...pageNums) };
}

/** series_id 高 32 位是建立时间（秒）；换成台北时间的「10/05」 */
export function seriesDate(seriesId: string): string {
  const sec = Number(BigInt(seriesId) >> BigInt(32));
  const d = new Date((sec + 8 * 3600) * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

export function newestFirst(
  items: CatalogItem[],
  limit: number
): HongguoRankItem[] {
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    if (seen.has(it.seriesId)) return false;
    seen.add(it.seriesId);
    return true;
  });
  unique.sort((a, b) => {
    const x = BigInt(a.seriesId);
    const y = BigInt(b.seriesId);
    return x === y ? 0 : x < y ? 1 : -1;
  });
  return unique.slice(0, limit).map((it, i) => ({
    rank: i + 1,
    seriesId: it.seriesId,
    title: it.title,
    cover: it.cover,
    heat: '',
    note: [`${seriesDate(it.seriesId)} 上线`, it.episodes]
      .filter(Boolean)
      .join(' · '),
  }));
}
