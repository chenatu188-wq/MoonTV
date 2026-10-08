import { newestFirst, parseCatalog, seriesDate } from '@/lib/hongguo-new';

const card = (id: string, title: string, episodes = '全100集') =>
  `<a class="pc-card-DQXf3W m-card-V7QopP" href="/detail?series_id=${id}"><div><picture><source srcSet="x.webp"/>` +
  `<img class="image-PWlIcn" src="https://p6-novel.byteimg.com/novel-pic/${id}~tplv-shrink:640:0.image?a=1&amp;b=2" alt="${title}" loading="lazy"/></picture>` +
  `<p class="pc-episode-TGdnks m-episode-Y4cUAR">${episodes}</p></div><p class="pc-title-l_s3n8">${title}</p></a>`;

// 高 32 位是建立时间：2026-10-05 12:00 与 2026-09-20 12:00（台北时间）
const idAt = (iso: string, low = 123) =>
  (
    (BigInt(Math.floor(new Date(iso).getTime() / 1000)) << BigInt(32)) +
    BigInt(low)
  ).toString();
const OCT5 = idAt('2026-10-05T12:00:00+08:00');
const SEP20 = idAt('2026-09-20T12:00:00+08:00');

describe('parseCatalog', () => {
  const html =
    card(SEP20, '旧剧') +
    card(OCT5, '新剧', '全197集') +
    '<a href="/category/ai-drama?page=2">2</a><a href="/category/ai-drama?page=34">34</a>';

  it('取出剧名、封面、集数和总页数', () => {
    const { items, pages } = parseCatalog(html);
    expect(pages).toBe(34);
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({
      seriesId: OCT5,
      title: '新剧',
      cover: `https://p6-novel.byteimg.com/novel-pic/${OCT5}~tplv-shrink:640:0.image?a=1&b=2`,
      episodes: '全197集',
    });
  });

  it('没有分页连结时算 1 页；空页面回空阵列', () => {
    expect(parseCatalog(card(OCT5, '新剧')).pages).toBe(1);
    expect(parseCatalog('<html></html>')).toEqual({ items: [], pages: 1 });
  });
});

describe('seriesDate', () => {
  it('从 series_id 换算出台北时间的日期', () => {
    expect(seriesDate(OCT5)).toBe('10/05');
    // 台北 10/06 凌晨 = UTC 10/05 晚上，要显示 10/06
    expect(seriesDate(idAt('2026-10-06T02:00:00+08:00'))).toBe('10/06');
  });
});

describe('newestFirst', () => {
  const items = parseCatalog(
    card(SEP20, '旧剧') + card(OCT5, '新剧', '全197集') + card(SEP20, '旧剧')
  ).items;

  it('新的排前面、去重、带上线日期', () => {
    const r = newestFirst(items, 40);
    expect(r.map((x) => x.title)).toEqual(['新剧', '旧剧']);
    expect(r[0]).toMatchObject({ rank: 1, note: '10/05 上线 · 全197集' });
    expect(r[1].rank).toBe(2);
  });

  it('只留 limit 笔', () => {
    expect(newestFirst(items, 1)).toHaveLength(1);
  });
});
