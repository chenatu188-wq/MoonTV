import { hotTiktok, latestPerAccount } from '@/lib/tiktok-hot';

const NOW = 1_791_500_000_000;
const v = (
  id: string,
  handle: string,
  title: string,
  views: number | null,
  daysAgo = 1
) => ({
  id,
  handle,
  title,
  views,
  published: Math.floor(NOW / 1000) - daysAgo * 86400,
});

describe('latestPerAccount', () => {
  it('每个帐号只留最新一支，整体新的排前面', () => {
    const r = latestPerAccount([
      v('a1', 'A', '旧', 1, 5),
      v('a2', 'A', '新', 1, 2),
      v('b1', 'B', '新', 1, 1),
    ]);
    expect(r.map((x) => x.id)).toEqual(['b1', 'a2']);
  });
});

describe('hotTiktok', () => {
  it('按观看数排，期间外和没有观看数的不算', () => {
    const r = hotTiktok(
      [
        v('a', 'A', '宣传语一', 100),
        v('b', 'B', '宣传语二', 900),
        v('old', 'C', '宣传语三', 99999, 20),
        v('none', 'D', '宣传语四', null),
      ],
      7,
      30,
      NOW
    );
    expect(r.map((x) => x.video.id)).toEqual(['b', 'a']);
  });

  it('同帐号的同一部连载并成一格', () => {
    const r = hotTiktok(
      [
        v('e1', 'A', '《云上双花》第1集', 100),
        v('e2', 'A', '《雲上雙花》第2集', 300),
        v('x', 'B', '《云上双花》第1集', 50),
      ],
      null,
      30,
      NOW
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ series: '云上双花', views: 400, count: 2 });
    expect(r[0].video.id).toBe('e2');
    // 不同帐号发的同名剧不并：点进去播的是不同人的影片
    expect(r[1].video.id).toBe('x');
  });

  it('最多回传 limit 笔', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      v(`id${i}`, 'A', `宣传语${i}`, i + 1)
    );
    expect(hotTiktok(many, null, 30, NOW)).toHaveLength(30);
  });
});
