import {
  findCreator,
  parseCategories,
  parseCreator,
  parseDramaList,
  parseFilter,
  shortDramaUrl,
} from '@/lib/tiktok-shortdrama';

const drama = (over: Record<string, unknown> = {}) => ({
  dramaID: '7690178072217408518',
  dramaName: ' 符械歸墟路 ',
  numVideos: 54,
  numWatched: '842103',
  description: '簡介',
  labelNew: true,
  labelHot: false,
  zoomCover: { '240': 'small.avif', '480': 'mid.avif' },
  cover: { urlList: ['origin.jpg'] },
  ...over,
});

describe('parseDramaList', () => {
  it('整理出片单需要的栏位', () => {
    expect(parseDramaList({ dramaList: [drama()] })).toEqual([
      {
        id: '7690178072217408518',
        name: '符械歸墟路',
        cover: 'mid.avif',
        episodes: 54,
        watched: 842103,
        description: '簡介',
        isNew: true,
        isHot: false,
      },
    ]);
  });

  it('没有缩图尺寸时退回原图', () => {
    const [d] = parseDramaList({
      dramaList: [drama({ zoomCover: undefined })],
    });
    expect(d.cover).toBe('origin.jpg');
  });

  it('略过重复、没有剧名或 id 不像 id 的项目', () => {
    const list = parseDramaList({
      dramaList: [
        drama(),
        drama(),
        drama({ dramaID: '123456789', dramaName: '' }),
        drama({ dramaID: '../evil', dramaName: 'x' }),
        null,
      ],
    });
    expect(list).toHaveLength(1);
  });

  it('回应格式不对时回空阵列', () => {
    expect(parseDramaList(null)).toEqual([]);
    expect(parseDramaList({ statusCode: 10101 })).toEqual([]);
  });
});

it('shortDramaUrl 从第 1 集开始', () => {
  expect(shortDramaUrl('123456')).toBe(
    'https://www.tiktok.com/shortdrama/episode/123456/1'
  );
});

describe('parseCategories', () => {
  const data = {
    dramaCategoryLists: [
      {
        dramaCategories: [
          { categoryFilterType: 1, categoryID: '0', name: '所有設定' },
          {
            categoryFilterType: 2,
            categoryID: '7628991192537142288',
            name: '仙俠',
          },
        ],
      },
      {
        dramaCategories: [
          { categoryFilterType: 1, categoryID: '0', name: '所有角色' },
          {
            categoryFilterType: 2,
            categoryID: '7628991193891820560',
            name: '復仇',
          },
        ],
      },
      {
        dramaCategories: [
          { categoryFilterType: 1, categoryID: '0', name: '所有發行' },
          { categoryFilterType: 3, name: '7 天內', recentDays: 7 },
        ],
      },
    ],
  };

  it('只留题材，去掉「所有 xx」和发行时间那组', () => {
    expect(parseCategories(data)).toEqual([
      { title: '背景', items: [{ id: '7628991192537142288', name: '仙俠' }] },
      { title: '剧情', items: [{ id: '7628991193891820560', name: '復仇' }] },
    ]);
  });

  it('格式不对回空阵列', () => {
    expect(parseCategories(null)).toEqual([]);
  });
});

describe('parseFilter', () => {
  it('收合法的题材和天数', () => {
    expect(parseFilter('111111,222222', '7')).toEqual({
      tags: ['111111', '222222'],
      days: 7,
    });
    expect(parseFilter(null, '30')).toEqual({ tags: [], days: 30 });
  });

  it('丢掉不像 id 的、重复的、不在清单里的，最多三个', () => {
    expect(parseFilter('111111,111111,abc,../x', '99')).toEqual({
      tags: ['111111'],
      days: null,
    });
    expect(
      parseFilter('111111,222222', null, new Set(['222222'])).tags
    ).toEqual(['222222']);
    expect(parseFilter('111111,222222,333333,444444', null).tags).toHaveLength(
      3
    );
  });
});

describe('parseCreator', () => {
  const page = (user: unknown) =>
    `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(
      { __DEFAULT_SCOPE__: { 'webapp.user-detail': { userInfo: { user } } } }
    )}</script></html>`;

  it('取出 secUid 和显示名称', () => {
    expect(
      parseCreator(
        page({
          secUid: 'MS4wLjABAAAA5BaMOITg2hBeketepiaLG',
          nickname: 'ActFort',
        })
      )
    ).toEqual({ secUid: 'MS4wLjABAAAA5BaMOITg2hBeketepiaLG', name: 'ActFort' });
  });

  it('帐号不存在、页面被挡、内容坏掉都回 null', () => {
    expect(parseCreator(page(undefined))).toBeNull();
    expect(parseCreator(page({ secUid: 'bad id!' }))).toBeNull();
    expect(parseCreator('<html>captcha</html>')).toBeNull();
    expect(
      parseCreator(
        '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{oops</script>'
      )
    ).toBeNull();
  });
});

describe('findCreator', () => {
  const data = {
    failed: [
      {
        handle: 'ActFort_CA',
        secUid: 'MS4wLjABAAAA5BaMOITg2hBeketepiaLG',
        name: 'ActFort',
      },
      { handle: 'nosec', error: 'x' },
    ],
  };

  it('帐号名不分大小写', () => {
    expect(findCreator(data, 'actfort_ca')).toEqual({
      secUid: 'MS4wLjABAAAA5BaMOITg2hBeketepiaLG',
      name: 'ActFort',
    });
  });

  it('没有 secUid、不在清单里、资料坏掉都回 null', () => {
    expect(findCreator(data, 'nosec')).toBeNull();
    expect(findCreator(data, 'other')).toBeNull();
    expect(findCreator(null, 'actfort_ca')).toBeNull();
  });
});
