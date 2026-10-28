import { fbSeriesOf, nextFbVideo } from './fb-next';

describe('fbSeriesOf', () => {
  it.each([
    ['🔥《万倍空间：我坐拥神藏》｜天赋只是下品凡骨', '万倍空间：我坐拥神藏'],
    ['🔥《万倍空间：我坐拥神藏2》｜三千洲拍卖会', '万倍空间：我坐拥神藏'],
    ['🔥《团宠假千金惊艳全城第5季》｜平时低调', '团宠假千金惊艳全城'],
    [
      '《被赶出侯府的假世子靠科举逆袭权臣第六季》',
      '被赶出侯府的假世子靠科举逆袭权臣',
    ],
  ])('%s', (t, s) => expect(fbSeriesOf(t)).toBe(s));
  it('没有书名号', () => expect(fbSeriesOf('这套可还行 #情侣')).toBeNull());
});

describe('nextFbVideo', () => {
  const v = (id: string, title: string, published: number, page = 'p') => ({
    id,
    title,
    published,
    page,
  });
  const s1 = v('1', '《神藏》第一集', 100);
  const other = v('2', '《别的剧》', 300);
  const s2 = v('3', '《神藏2》', 200);
  const s3 = v('4', '《神藏3》', 400);
  // 画面上新的在前
  const list = [s3, other, s2, s1];

  it('同一部剧接比它晚上传的最早那支', () => {
    expect(nextFbVideo(s1, list)?.id).toBe('3');
    expect(nextFbVideo(s2, list)?.id).toBe('4');
  });
  it('没有续集就照画面顺序', () => {
    expect(nextFbVideo(s3, list)?.id).toBe('2');
    expect(nextFbVideo(other, list)?.id).toBe('3');
  });
  it('最后一支回 null', () => {
    expect(nextFbVideo(v('9', '无剧名', 1), [v('9', '无剧名', 1)])).toBeNull();
  });
});
