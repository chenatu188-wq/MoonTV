import { filterDedicatedAdultSources } from '@/lib/adult-sources';

test('成人搜尋排除與家庭區共用 API 的來源', () => {
  const sources = [
    { key: 'general', api: 'https://general.example/api', group: '綜合影視' },
    {
      key: 'general-adult',
      api: 'https://general.example/api/',
      group: '🔞韓國',
    },
    { key: 'adult', api: 'https://adult.example/api', group: '🔞' },
    { key: 'adult-us', api: 'https://adult-us.example/api', group: '🔞歐美' },
  ];

  expect(
    filterDedicatedAdultSources(sources).map((source) => source.key)
  ).toEqual(['adult', 'adult-us']);
});
