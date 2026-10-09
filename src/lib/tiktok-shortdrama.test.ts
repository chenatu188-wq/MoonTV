import { parseDramaList, shortDramaUrl } from '@/lib/tiktok-shortdrama';

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
