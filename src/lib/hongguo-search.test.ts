import {
  cleanHongguoQuery,
  parseHongguoSearch,
  promoKeywordOf,
} from '@/lib/hongguo-search';

const page = (list: unknown) =>
  `<script>self.__next_f.push({"query":"石海寻徒","isSuccess":true,"searchList":${JSON.stringify(
    list
  )},"other":[1,2]})</script>`;

const item = (
  id: string,
  title: string,
  extra: Record<string, unknown> = {}
) => ({
  doc_type: 23,
  name: title,
  video_data: {
    series_id: id,
    series_title: title,
    episode_cnt: 186,
    series_cover: 'https://p3-novel.byteimg.com/a.image',
    series_intro: '简介里有 ] 和 " 引号 [也不会坏',
    hot_score_data: { text: '4388万热度' },
    ...extra,
  },
});

describe('parseHongguoSearch', () => {
  it('取出剧名、封面、集数、热度', () => {
    expect(
      parseHongguoSearch(page([item('7683432711033211928', '菩提现')]))
    ).toEqual([
      {
        seriesId: '7683432711033211928',
        title: '菩提现',
        cover: 'https://p3-novel.byteimg.com/a.image',
        episodes: 186,
        heat: '4388万热度',
        intro: '简介里有 ] 和 " 引号 [也不会坏',
      },
    ]);
  });

  it('略过重复和格式不对的', () => {
    const list = parseHongguoSearch(
      page([
        item('111111', 'A'),
        item('111111', 'A'),
        item('abc', 'B'),
        { doc_type: 1, name: '演员' },
        null,
      ])
    );
    expect(list.map((x) => x.title)).toEqual(['A']);
  });

  it('没有结果、页面改版、JSON 坏掉都回空阵列', () => {
    expect(parseHongguoSearch('<html>no data</html>')).toEqual([]);
    expect(parseHongguoSearch('"searchList":[{"a":1')).toEqual([]);
    expect(parseHongguoSearch('"searchList":[oops]')).toEqual([]);
  });
});

describe('promoKeywordOf', () => {
  it.each([
    ['石海尋徒#紅果短劇app免費看 #短劇#流量', '石海尋徒'],
    ['  金河扭轉 #漫劇#小說', '金河扭轉'],
    ['辰竹義犬', '辰竹義犬'],
  ])('%s → %s', (title, expected) => {
    expect(promoKeywordOf(title)).toBe(expected);
  });

  it.each([
    '#流量 #短劇 #好劇推薦', // 没写口令
    '痛，简直是太痛了 #AI模拟拉琴演奏', // 一整句话
    '前世結婚6年才發現妻子從未愛過自己#短劇',
    'The CEO returns #drama',
    '',
  ])('%s → null', (title) => {
    expect(promoKeywordOf(title)).toBeNull();
  });
});

it('cleanHongguoQuery', () => {
  expect(cleanHongguoQuery('  石海　尋徒 ')).toBe('石海 尋徒');
  expect(cleanHongguoQuery('')).toBeNull();
  expect(cleanHongguoQuery(null)).toBeNull();
  expect(cleanHongguoQuery('字'.repeat(31))).toBeNull();
});
