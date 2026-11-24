import { repairAdultPoster } from '@/lib/adult-poster';

const broken = 'https://fb.lj260522.top/upload/vod/20261124-1/cover.jpg';

it('保留其他片源與正常圖片', () => {
  expect(repairAdultPoster('other', 'COSX-063', broken)).toBe(broken);
  expect(
    repairAdultPoster('apilj.com', 'COSX-063', 'https://img.test/cover.jpg')
  ).toBe('https://img.test/cover.jpg');
});

it('辣椒一般番號改用 DMM 公開封面', () => {
  expect(repairAdultPoster('apilj.com', 'COSX-063 標題', broken)).toBe(
    'https://pics.dmm.co.jp/digital/video/cosx00063/cosx00063pl.jpg'
  );
});

it('辣椒 HEYZO 番號改用官方縮圖', () => {
  expect(repairAdultPoster('apilj.com', 'HEYZO-3544 標題', broken)).toBe(
    'https://www.heyzo.com/contents/3000/3544/images/player_thumbnail.jpg'
  );
});

it('無法辨識番號時不再傳回失效圖床', () => {
  expect(repairAdultPoster('apilj.com', '無番號標題', broken)).toBe('');
});
