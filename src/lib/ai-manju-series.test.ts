import { seasonOf, seriesNameOf } from './ai-manju-series';

describe('seriesNameOf', () => {
  it('取书名号里的剧名并去掉季数', () => {
    expect(seriesNameOf('🔥开局觉醒《万妖图录传第六季》#盛世短剧')).toBe(
      '万妖图录传'
    );
    expect(seriesNameOf('《萬妖圖錄傳第5季》')).toBe('萬妖圖錄傳');
    expect(seriesNameOf('【AI漫剧全集】《首辅的土匪千金》第1~110集')).toBe(
      '首辅的土匪千金'
    );
    expect(seriesNameOf('《地宫蛇母2》')).toBe('地宫蛇母');
    expect(seriesNameOf('《天灾末世，她囤满物资后所向披靡完结篇》')).toBe(
      '天灾末世，她囤满物资后所向披靡'
    );
  });

  it('没有书名号时认「剧名第X季」', () => {
    expect(seriesNameOf('国师定大明第四季｜萧风北上退敌')).toBe('国师定大明');
    expect(seriesNameOf('太解气了！持械入宋：第七季 边境刚稳')).toBe(
      '持械入宋'
    );
  });

  it('认不出来回 null', () => {
    expect(seriesNameOf('我上个厕所的时间，女朋友就让人拐跑了 #ai')).toBeNull();
  });
});

describe('seasonOf', () => {
  it('认各种季数写法', () => {
    expect(seasonOf('《万妖图录传第十三季》')).toBe(13);
    expect(seasonOf('《萬妖圖錄傳第5季》')).toBe(5);
    expect(seasonOf('【S2】帝族弃子被贬凡尘')).toBe(2);
    expect(seasonOf('《烬九州》第22季丨重生')).toBe(22);
    expect(seasonOf('《地宫蛇母2》')).toBe(2);
    expect(seasonOf('Season 3 | ENG SUB')).toBe(3);
    expect(seasonOf('第二十一季')).toBe(21);
  });

  it('没写季数回 null，集数不算季数', () => {
    expect(seasonOf('《首辅的土匪千金》第1~110集')).toBeNull();
    expect(seasonOf('《末日余烬》 1-19集')).toBeNull();
  });
});
