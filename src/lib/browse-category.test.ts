import { firstNonEmpty, matchCategories } from '@/lib/browse-category';

describe('browse category fallback', () => {
  it('tries matching subcategories in keyword order without duplicates', () => {
    const categories = [
      { type_id: 2, type_name: '连续剧' },
      { type_id: 12, type_name: '国产剧' },
      { type_id: 16, type_name: '韩国剧' },
    ];

    expect(matchCategories(categories, ['国产剧', '韩国剧', '连续剧'])).toEqual(
      [categories[1], categories[2], categories[0]]
    );
  });

  it('falls through an empty parent category to a populated child category', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['悬案']);

    const resolved = await firstNonEmpty([2, 12], load);

    expect(load).toHaveBeenNthCalledWith(1, 2);
    expect(load).toHaveBeenNthCalledWith(2, 12);
    expect(resolved).toEqual({ candidate: 12, result: ['悬案'] });
  });
});
