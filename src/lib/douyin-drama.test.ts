import {
  addPendingDouyin,
  classifyDouyinUrl,
  clearPendingDouyin,
  listPendingDouyin,
  sanitizeDouyinData,
  settleDouyin,
  visibleDramas,
} from '@/lib/douyin-drama';

describe('classifyDouyinUrl', () => {
  it.each([
    [
      'https://www.douyin.com/collection/7694952362364667938',
      { kind: 'ref', ref: 'series:7694952362364667938' },
    ],
    [
      'https://www.douyin.com/video/7612993433996991217?previous_page=app_code_link',
      { kind: 'ref', ref: 'video:7612993433996991217' },
    ],
    [
      'https://www.iesdouyin.com/share/video/7612993433996991217/?region=CN',
      { kind: 'ref', ref: 'video:7612993433996991217' },
    ],
    [
      'https://www.iesdouyin.com/share/mix/detail/7616202609036101667/',
      { kind: 'ref', ref: 'series:7616202609036101667' },
    ],
    [
      'https://www.douyin.com/jingxuan?modal_id=7612993433996991217',
      { kind: 'ref', ref: 'video:7612993433996991217' },
    ],
    [
      // App 分享出来的整段文案
      '7.43 复制打开抖音，看看【小琦漫剧的作品】第一集 # AI漫剧 https://v.douyin.com/iRNBhQ2k/ Ycb:/ 01/09 r@E.UY',
      { kind: 'short', url: 'https://v.douyin.com/iRNBhQ2k/' },
    ],
    // 全形冒号、斜线也认得出来
    [
      'ｈｔｔｐｓ：／／ｗｗｗ.douyin.com/collection/7694952362364667938',
      { kind: 'ref', ref: 'series:7694952362364667938' },
    ],
  ])('%s', (input, expected) => {
    expect(classifyDouyinUrl(input)).toEqual(expected);
  });

  it.each([
    'https://www.tiktok.com/@a/video/7612993433996991217',
    'https://evil.com/douyin.com/video/7612993433996991217',
    'https://www.douyin.com.evil.com/video/7612993433996991217',
    'https://www.douyin.com/user/MS4wLjABAAAA',
    '石海寻徒',
  ])('不认 %s', (input) => {
    expect(classifyDouyinUrl(input)).toBeNull();
  });
});

const raw = {
  updated: 1792000000,
  dramas: [
    {
      ref: 'series:7616202609036101667',
      alias: ['video:7612993433996991217', 'bad'],
      id: '7616202609036101667',
      name: '悬疑合集\u0007',
      author: '悬疑探影',
      cover: 'javascript:alert(1)',
      total: 96,
      paid: false,
      episodes: [
        { id: '7612303411711751665', ep: 1, title: '第一集', cover: 'https://p3.douyinpic.com/a.jpeg', duration: 436 },
        { id: 'x', ep: 2 },
      ],
    },
    // 没有集数的剧不列
    { ref: 'series:7694952362364667938', id: '7694952362364667938', episodes: [] },
  ],
  failed: [{ ref: 'video:7696446490167856426', error: '这支影片不属于任何短剧／合集' }, { ref: 'x' }],
};

describe('sanitizeDouyinData', () => {
  it('留下格式正确的剧和集数、挡掉坏网址和控制字元', () => {
    const d = sanitizeDouyinData(raw);
    expect(d.dramas).toHaveLength(1);
    const [drama] = d.dramas;
    expect(drama.name).toBe('悬疑合集');
    expect(drama.alias).toEqual(['video:7612993433996991217']);
    expect(drama.cover).toBe('https://p3.douyinpic.com/a.jpeg');
    expect(drama.episodes.map((e) => e.id)).toEqual(['7612303411711751665']);
    expect(drama.total).toBe(96);
    expect(d.failed).toEqual([raw.failed[0]]);
  });

  it('乱七八糟的输入回空资料', () => {
    expect(sanitizeDouyinData(null)).toEqual({ updated: 0, dramas: [], failed: [] });
    expect(sanitizeDouyinData({ dramas: 'x' }).dramas).toEqual([]);
  });
});

describe('待处理的追剧变更', () => {
  beforeEach(() => clearPendingDouyin());

  it('资料里出现了就划掉新增；用影片连结追、资料里是 alias 也算', () => {
    const data = sanitizeDouyinData(raw);
    addPendingDouyin('add', 'video:7612993433996991217', '悬疑');
    addPendingDouyin('add', 'series:7694952362364667938', 'AI漫剧');
    settleDouyin(data);
    expect(listPendingDouyin().map((p) => p.ref)).toEqual(['series:7694952362364667938']);
  });

  it('失败的也算处理过了', () => {
    addPendingDouyin('add', 'video:7696446490167856426');
    settleDouyin(sanitizeDouyinData(raw));
    expect(listPendingDouyin()).toEqual([]);
  });

  it('移除中的剧先藏起来，资料里消失后才划掉', () => {
    const data = sanitizeDouyinData(raw);
    addPendingDouyin('rm', 'series:7616202609036101667');
    settleDouyin(data);
    expect(visibleDramas(data, listPendingDouyin())).toEqual([]);
    settleDouyin({ ...data, dramas: [] });
    expect(listPendingDouyin()).toEqual([]);
  });

  it('同一个连结只留最后一次的决定，过期的丢掉', () => {
    addPendingDouyin('add', 'series:7694952362364667938', '', 1000);
    addPendingDouyin('rm', 'series:7694952362364667938', '', 2000);
    expect(listPendingDouyin(3000).map((p) => p.op)).toEqual(['rm']);
    expect(listPendingDouyin(2000 + 25 * 3600 * 1000)).toEqual([]);
  });
});
