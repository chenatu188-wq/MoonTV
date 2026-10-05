import { episodeOf, seasonOf, seriesNameOf } from './ai-manju-series';

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

  it('认「剧名第N集」', () => {
    expect(seriesNameOf('雲上雙花第8集')).toBe('雲上雙花');
    expect(seriesNameOf('云上双花 第十二集 #ai短剧')).toBe('云上双花');
    expect(seriesNameOf('【归墟】新ai短剧 第一季 - 第17集 神药')).toBe('归墟');
    expect(seriesNameOf('兽世小人类 EP109 #动漫')).toBe('兽世小人类');
  });

  it('认【剧名】，但不把标签当剧名', () => {
    expect(seriesNameOf('【从流民开始武道通神】九州乱世妖魔横行')).toBe(
      '从流民开始武道通神'
    );
    expect(seriesNameOf('【全集FULL】【名门之星】#热播漫剧')).toBe('名门之星');
    expect(seriesNameOf('【第三季】【山下是绝路，山上是生门】')).toBe(
      '山下是绝路，山上是生门'
    );
    expect(
      seriesNameOf(
        '🔥【新番上线|AI Anime】妖魔横行人族濒危！我觉醒武道推演系统'
      )
    ).toBeNull();
  });

  it('认开头就是剧名的写法', () => {
    expect(seriesNameOf('國師定大明｜第四季「國師一出，天下定策」')).toBe(
      '國師定大明'
    );
    expect(
      seriesNameOf('【短剧】修仙，我种的灵植被疯抢 | 季禾从末世穿到修真界')
    ).toBe('修仙，我种的灵植被疯抢');
    expect(seriesNameOf('人在古代，修為金丹（第01-325集）「人在古代」')).toBe(
      '人在古代，修為金丹'
    );
  });

  it('认不出来回 null', () => {
    expect(seriesNameOf('我上个厕所的时间，女朋友就让人拐跑了 #ai')).toBeNull();
    expect(
      seriesNameOf(
        '窮小伙穿越成人人嘲笑的笨王爺，一睜眼就被迫迎娶強勢公主！#短劇'
      )
    ).toBeNull();
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

describe('episodeOf', () => {
  it('认单集', () => {
    expect(episodeOf('雲上雙花第8集')).toBe(8);
    expect(episodeOf('云上双花 第十二集')).toBe(12);
    expect(episodeOf('【归墟】第一季 - 第17集 神药')).toBe(17);
    expect(episodeOf('兽世小人类 EP109')).toBe(109);
  });

  it('集数范围不算单集', () => {
    expect(episodeOf('《首辅的土匪千金》第1~110集')).toBeNull();
    expect(episodeOf('人在古代（第01-325集）')).toBeNull();
    expect(episodeOf('EP33-65')).toBeNull();
    expect(episodeOf('《万妖图录传第六季》')).toBeNull();
  });
});

describe('seriesNameOf 不该误认的情况', () => {
  it('句子中间提到「第一集」不算剧名', () => {
    expect(
      seriesNameOf(
        '這部新劇太精彩了吧？主角高情商全程爆表，打開第一集根本停不下來！'
      )
    ).toBeNull();
  });

  it('句子里引一句话不算「剧名「简介」」', () => {
    expect(
      seriesNameOf(
        '岳母逼我花88萬辦壽宴，妻子還勸我「一家人要大度」！忍了八年，這次我不付錢了'
      )
    ).toBeNull();
    expect(
      seriesNameOf(
        '全員首富：只有老闆被矇在鼓裡「員工個個身價驚人，老闆還在認真創業！」'
      )
    ).toBe('全員首富：只有老闆被矇在鼓裡');
  });
});
