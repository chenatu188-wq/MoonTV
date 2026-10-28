import {
  addFbPending,
  clearFbPending,
  listFbPending,
  parseFbPage,
  settleFb,
} from './fb-follows';

describe('parseFbPage', () => {
  it.each([
    ['NASA', 'NASA'],
    ['@NASA', 'NASA'],
    ['https://www.facebook.com/NASA', 'NASA'],
    [
      'https://www.facebook.com/NASA/videos/be-a-flight-director/4007941182848761/',
      'NASA',
    ],
    ['m.facebook.com/tvbsfb?ref=x', 'tvbsfb'],
    [
      'https://www.facebook.com/profile.php?id=100044561550831&sk=videos',
      '100044561550831',
    ],
    ['ＮＡＳＡ', 'NASA'],
  ])('%s → %s', (input, out) => expect(parseFbPage(input)).toBe(out));

  it.each([
    'https://www.facebook.com/share/v/1AbCdEf/',
    'https://www.facebook.com/watch/?v=123456789',
    'https://www.facebook.com/reel/123456789',
    'https://www.youtube.com/@x',
    '',
    '粉专',
  ])('%s → null', (input) => expect(parseFbPage(input)).toBeNull());
});

describe('pending queue', () => {
  beforeEach(clearFbPending);
  it('同一粉专不分大小写只留最后一次', () => {
    addFbPending('add', 'NASA', 1);
    addFbPending('rm', 'nasa', 2);
    expect(listFbPending(3)).toEqual([{ op: 'rm', page: 'nasa', at: 2 }]);
  });
  it('资料里看得到结果就划掉', () => {
    addFbPending('add', 'NASA', 1);
    addFbPending('rm', 'tvbs', 1);
    settleFb(['nasa']);
    expect(listFbPending(2)).toEqual([]);
  });
  it('超过一天丢掉', () => {
    addFbPending('add', 'NASA', 0);
    expect(listFbPending(25 * 3600 * 1000)).toEqual([]);
  });
});
