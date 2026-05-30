import { toSimplified } from '@/lib/cn-converter';

const CDRAMA_ALIAS_GROUPS: string[][] = [
  ['脱轨', '脫軌', 'derailment'],
  ['庆余年', '慶餘年', 'joy of life'],
  ['庆余年2', '慶餘年2', 'joy of life 2'],
  ['长相思', '長相思', 'lost you forever'],
  ['莲花楼', '蓮花樓', 'mysterious lotus casebook'],
  ['琅琊榜', 'nirvana in fire'],
  ['狂飙', '狂飆', 'the knockout'],
  ['偷偷藏不住', 'hidden love'],
  ['难哄', '難哄', 'the first frost'],
  ['你也有今天', 'my boss'],
  ['在暴雪时分', '在暴雪時分', 'amidst a snowstorm of love'],
  ['与凤行', '與鳳行', 'the legend of shen li'],
  ['承欢记', '承歡記', 'best choice ever'],
  ['异人之下', '異人之下', 'i am nobody'],
  ['唐朝诡事录', '唐朝詭事錄', 'strange tales of tang dynasty'],
  ['去有风的地方', '去有風的地方', 'meet yourself'],
  ['星汉灿烂', '星漢燦爛', 'love like the galaxy'],
];

function normalizeAlias(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

const ALIAS_INDEX = new Map<string, string[]>();
for (const group of CDRAMA_ALIAS_GROUPS) {
  const deduped = Array.from(
    new Set(group.map((v) => v.trim()).filter(Boolean))
  );
  for (const alias of deduped) {
    ALIAS_INDEX.set(normalizeAlias(alias), deduped);
  }
}

export function expandCdramaSearchQueries(query: string): string[] {
  const raw = query.trim();
  if (!raw) return [];

  const simplified = toSimplified(raw);
  const set = new Set<string>([raw, simplified]);

  const aliasGroup = ALIAS_INDEX.get(normalizeAlias(raw));
  if (aliasGroup) {
    for (const alias of aliasGroup) {
      set.add(alias);
      set.add(toSimplified(alias));
    }
  }

  return Array.from(set).filter(Boolean);
}
