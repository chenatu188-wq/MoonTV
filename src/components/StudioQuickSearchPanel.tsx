'use client';

import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type StudioTag = { code: string; style: string };

const STUDIO_TAGS_DEFAULT: StudioTag[] = [
  { code: 'SSIS', style: '大廠' },
  { code: 'IPX', style: '偶像系' },
  { code: 'IPZZ', style: '偶像系' },
  { code: 'IDBD', style: '精選' },
  { code: 'STARS', style: '偶像' },
  { code: 'PRED', style: '中堅' },
  { code: 'MIDV', style: '老牌' },
  { code: 'MIAA', style: '老牌' },
  { code: 'MIAB', style: '老牌' },
  { code: 'MIDA', style: '老牌' },
  { code: 'MIDE', style: '老牌' },
  { code: 'SDDE', style: '老牌' },
  { code: 'SDAB', style: '老牌' },
  { code: 'SW', style: '老牌' },
  { code: 'JUL', style: '人妻' },
  { code: 'JUQ', style: '人妻' },
  { code: 'JUFE', style: '人妻' },
  { code: 'ROE', style: '人妻' },
  { code: 'MDYD', style: '人妻' },
  { code: 'MEYD', style: '人妻' },
  { code: 'VEC', style: '人妻' },
  { code: 'VENX', style: '熟女' },
  { code: 'FSDSS', style: '新興' },
  { code: 'WAAA', style: '大眾' },
  { code: 'WANZ', style: '大眾' },
  { code: 'CAWD', style: '清純' },
  { code: 'EBOD', style: '巨乳' },
  { code: 'ATID', style: '劇情' },
  { code: 'SHKD', style: '劇情' },
  { code: 'DANDY', style: '戲劇' },
  { code: 'HUNTC', style: '戲劇' },
  { code: 'HODV', style: '老牌' },
  { code: 'HMDB', style: '女女' },
  { code: 'HJMO', style: '素人' },
  { code: 'HMN', style: '中堅' },
  { code: 'DASS', style: '中堅' },
  { code: 'GVH', style: '中堅' },
  { code: 'FERA', style: '中堅' },
  { code: 'TPPN', style: '中堅' },
  { code: 'SVH', style: '自訂' },
  { code: 'HMIX', style: '自訂' },
  { code: 'JJDA', style: '自訂' },
  { code: 'KIRE', style: '自訂' },
  { code: 'LULU', style: '自訂' },
  { code: 'MBYD', style: '自訂' },
  { code: 'MCSR', style: '自訂' },
  { code: 'MIZU', style: '自訂' },
  { code: 'DAZP', style: '自訂' },
  { code: 'SAKD', style: '自訂' },
  { code: 'SSAH', style: '自訂' },
  { code: 'SVRT', style: '自訂' },
  { code: 'UMD', style: '自訂' },
];

const KEYWORDS_DEFAULT: string[] = [
  '人妻',
  '熟女',
  '巨乳',
  '美乳',
  '清純',
  '偶像',
  'OL',
  '制服',
  '學生',
  '護士',
  '教師',
  '素人',
  '黑絲',
  '中出',
  '痴女',
  '韓國',
  '韓國三級',
  '韓國主播',
  '倫理三級',
  '歐美',
  '歐美三級',
  '美國',
  '黑人',
  '4K',
  '高清',
  '1080P',
];

const ACTRESSES_DEFAULT: string[] = [
  '葵司',
  '蒼井空',
  '麻倉憂',
  '楓可憐',
  '篠田優',
  '大槻響',
  '三上悠亞',
  '橋本有菜',
  '河北彩花',
  '紗倉真菜',
  '吉澤明步',
  '上原亞衣',
  '七澤美亞',
  '高橋聖子',
  '深田詠美',
  '楓富愛',
  '倉本菜未',
  '麻美由真',
  '美波志保',
  '波多野結衣',
  '神宮寺奈緒',
  '桐谷茉莉',
  '涼森玲夢',
  '永井瑪利亞',
];

const STUDIO_TAGS_KEY = 'moontv_studio_tags_v1';
const STUDIO_FAVS_KEY = 'moontv_studio_favs_v1';
const KEYWORDS_KEY = 'moontv_keywords_v1';
const ACTRESSES_KEY = 'moontv_actresses_v1';

const ls = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, val: string) => {
    try {
      localStorage.setItem(key, val);
    } catch {
      /* ignore */
    }
  },
};

const loadStudioFavs = (): Set<string> => {
  try {
    const raw = ls.get(STUDIO_FAVS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
};

const loadStudioTags = (): StudioTag[] => {
  try {
    const raw = ls.get(STUDIO_TAGS_KEY);
    if (!raw) return STUDIO_TAGS_DEFAULT;
    const parsed = JSON.parse(raw) as StudioTag[];
    return Array.isArray(parsed) ? parsed : STUDIO_TAGS_DEFAULT;
  } catch {
    return STUDIO_TAGS_DEFAULT;
  }
};

const loadKeywords = (): string[] => {
  try {
    const raw = ls.get(KEYWORDS_KEY);
    if (!raw) return KEYWORDS_DEFAULT;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : KEYWORDS_DEFAULT;
  } catch {
    return KEYWORDS_DEFAULT;
  }
};

const loadActresses = (): string[] => {
  try {
    const raw = ls.get(ACTRESSES_KEY);
    if (!raw) return ACTRESSES_DEFAULT;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : ACTRESSES_DEFAULT;
  } catch {
    return ACTRESSES_DEFAULT;
  }
};

const mergeDefaults = <T,>(
  stored: T[],
  defaults: T[],
  key: (t: T) => string
): T[] => {
  const storedKeys = new Set(stored.map(key));
  const missing = defaults.filter((t) => !storedKeys.has(key(t)));
  return missing.length > 0 ? [...stored, ...missing] : stored;
};

interface StudioQuickSearchPanelProps {
  onSearch: (q: string) => void;
}

export default function StudioQuickSearchPanel({
  onSearch,
}: StudioQuickSearchPanelProps) {
  const [studioTags, setStudioTags] = useState<StudioTag[]>(() => {
    if (typeof window === 'undefined') return STUDIO_TAGS_DEFAULT;
    const stored = loadStudioTags();
    return mergeDefaults(stored, STUDIO_TAGS_DEFAULT, (t) => t.code);
  });
  const [studioFavs, setStudioFavs] = useState<Set<string>>(() =>
    typeof window !== 'undefined' ? loadStudioFavs() : new Set()
  );
  const [keywords, setKeywords] = useState<string[]>(() => {
    if (typeof window === 'undefined') return KEYWORDS_DEFAULT;
    const stored = loadKeywords();
    return mergeDefaults(stored, KEYWORDS_DEFAULT, (k) => k);
  });
  const [actresses, setActresses] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ACTRESSES_DEFAULT;
    const stored = loadActresses();
    return mergeDefaults(stored, ACTRESSES_DEFAULT, (a) => a);
  });

  const actressesByLength = useMemo(() => {
    const groups = new Map<number, string[]>();
    actresses.forEach((name) => {
      const len = name.length;
      const arr = groups.get(len) || [];
      arr.push(name);
      groups.set(len, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [actresses]);

  const saveStudioTags = (tags: StudioTag[]) =>
    ls.set(STUDIO_TAGS_KEY, JSON.stringify(tags));
  const saveStudioFavs = (set: Set<string>) =>
    ls.set(STUDIO_FAVS_KEY, JSON.stringify(Array.from(set)));
  const saveKeywords = (kws: string[]) =>
    ls.set(KEYWORDS_KEY, JSON.stringify(kws));
  const saveActresses = (names: string[]) =>
    ls.set(ACTRESSES_KEY, JSON.stringify(names));

  const toggleStudioFav = (code: string) => {
    const next = new Set(studioFavs);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setStudioFavs(next);
    saveStudioFavs(next);
  };

  const handleAddStudioTag = () => {
    const codeInput = window.prompt('輸入片商代號（如 OFJE）');
    if (!codeInput) return;
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-Z]{2,8}$/.test(code)) {
      window.alert('代號只能是 2-8 個英文字母');
      return;
    }
    if (studioTags.some((t) => t.code === code)) {
      window.alert(`「${code}」已經在標籤裡了`);
      return;
    }
    const styleInput = window.prompt(
      `輸入「${code}」的風格說明（可空、最多 6 字）`,
      ''
    );
    const style = (styleInput || '').trim().slice(0, 6) || '自訂';
    const next = [...studioTags, { code, style }];
    setStudioTags(next);
    saveStudioTags(next);
  };

  const handleDeleteStudioTag = (code: string) => {
    if (!window.confirm(`確定要移除「${code}」標籤嗎？`)) return;
    const next = studioTags.filter((t) => t.code !== code);
    setStudioTags(next);
    saveStudioTags(next);
  };

  const handleResetStudioTags = () => {
    if (!window.confirm('確定要還原預設清單嗎？（你目前自訂的代號會被覆蓋）'))
      return;
    setStudioTags(STUDIO_TAGS_DEFAULT);
    saveStudioTags(STUDIO_TAGS_DEFAULT);
  };

  const handleBulkAddStudioTags = () => {
    const input = window.prompt(
      '批量新增片商代號（逗號/頓號/換行/空格分隔，如 OFJE,SNIS,DOCP）'
    );
    if (!input) return;
    const candidates = input
      .split(/[,，、\n\r\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const existing = new Set(studioTags.map((t) => t.code));
    const added: StudioTag[] = [];
    const skipped: string[] = [];
    const invalid: string[] = [];
    for (const code of candidates) {
      if (!/^[A-Z]{2,8}$/.test(code)) {
        invalid.push(code);
        continue;
      }
      if (existing.has(code) || added.some((t) => t.code === code)) {
        skipped.push(code);
        continue;
      }
      added.push({ code, style: '自訂' });
    }
    if (added.length > 0) {
      const next = [...studioTags, ...added];
      setStudioTags(next);
      saveStudioTags(next);
    }
    const lines = [`✅ 新增 ${added.length} 個`];
    if (skipped.length > 0)
      lines.push(`⚠ 重複略過 ${skipped.length} 個：${skipped.join('、')}`);
    if (invalid.length > 0)
      lines.push(`❌ 格式錯誤略過 ${invalid.length} 個：${invalid.join('、')}`);
    window.alert(lines.join('\n'));
  };

  const handleExtractStudioCodesFromText = () => {
    const input = window.prompt(
      '從文字過濾片商代號（貼任何混雜內容，會自動只留代號）\n範例：今天推薦 SSIS-456、IPX-789 → 抓出 SSIS、IPX'
    );
    if (!input) return;
    const CATEGORY_PATTERNS: Array<[string, RegExp]> = [
      ['人妻', /人妻|已婚|主婦|婦女|有夫之婦/],
      ['中出', /中出|內射/],
      ['巨乳', /巨乳|大奶|爆乳|[A-Z]罩杯/],
      ['熟女', /熟女|成熟|御[姉姊]/],
      ['出軌', /NTR|出軌|不倫|偷情/],
      ['美少女', /美少女|女子高生|JK/],
      ['多P', /多P|3P|4P|群交/],
      ['教師', /教師|老師|女教師/],
      ['制服', /制服|OL|護士|空姐/],
      ['調教', /調教|奴隸|SM|綑綁/],
    ];
    const detectCategory = (idx: number, codeLen: number): string => {
      const ctx = input.slice(Math.max(0, idx - 30), idx + codeLen + 200);
      const hits: string[] = [];
      for (const [cat, re] of CATEGORY_PATTERNS) {
        if (re.test(ctx)) {
          hits.push(cat);
          if (hits.length >= 2) break;
        }
      }
      return hits.length === 0 ? '自訂' : hits.join('');
    };
    const noiseBlocklist = new Set([
      'HTML',
      'CSS',
      'JS',
      'API',
      'URL',
      'HTTP',
      'HTTPS',
      'HD',
      'FHD',
      'UHD',
      'SD',
      'BD',
      'DVD',
      'CD',
      'HEVC',
      'AVC',
      'AV1',
      'AV',
      'JAV',
      'MP',
      'MP3',
      'MP4',
      'MKV',
      'MOV',
      'AVI',
      'FLV',
      'WEBM',
      'TS',
      'JPG',
      'JPEG',
      'PNG',
      'GIF',
      'WEBP',
      'PDF',
      'TXT',
      'ZIP',
      'RAR',
      'GB',
      'MB',
      'KB',
      'TB',
      'FPS',
      'USA',
      'UK',
      'JP',
      'CN',
      'TW',
      'HK',
      'KR',
      'EU',
      'VIP',
      'NEW',
      'HOT',
      'TOP',
      'LIVE',
      'FULL',
      'ID',
      'IP',
      'OS',
      'UI',
      'UX',
      'DB',
      'AI',
      'ML',
      'GPU',
      'CPU',
      'RAM',
      'PC',
      'MAC',
      'IOS',
      'WIN',
      'NTR',
      'DMM',
      'FUCK',
      'SEX',
      'BDSM',
      'BBC',
      'POV',
      'RAW',
      'CEN',
      'UNCEN',
      'MILF',
      'OL',
      'JK',
      'GANG',
      'HQ',
      'LQ',
      'OK',
      'NO',
      'YES',
      'ON',
      'OFF',
      'GO',
      'AM',
      'PM',
      'GMT',
      'UTC',
      'PG',
      'PV',
      'OP',
      'ED',
      'EP',
      'OST',
      'BGM',
      'SE',
      'MV',
      'LOL',
      'OMG',
      'WTF',
      'IMG',
      'ABC',
      'ETC',
      'XYZ',
    ]);
    const upperInput = input.toUpperCase();
    const regex = /\b[A-Z]{2,8}\b/g;
    const codeContexts = new Map<string, Set<string>>();
    let m: RegExpExecArray | null;
    while ((m = regex.exec(upperInput)) !== null) {
      const code = m[0];
      const cat = detectCategory(m.index, code.length);
      let set = codeContexts.get(code);
      if (!set) {
        set = new Set();
        codeContexts.set(code, set);
      }
      if (cat !== '自訂') set.add(cat);
    }
    const existing = new Set(studioTags.map((t) => t.code));
    const added: StudioTag[] = [];
    const noise: string[] = [];
    const duplicated: string[] = [];
    for (const code of Array.from(codeContexts.keys())) {
      if (noiseBlocklist.has(code)) {
        noise.push(code);
        continue;
      }
      if (existing.has(code)) {
        duplicated.push(code);
        continue;
      }
      const cats = Array.from(codeContexts.get(code) || []);
      added.push({ code, style: cats.length > 0 ? cats.join('') : '自訂' });
    }
    if (added.length > 0) {
      const next = [...studioTags, ...added];
      setStudioTags(next);
      saveStudioTags(next);
    }
    const lines: string[] = [];
    if (added.length > 0) {
      const detail = added
        .map((t) => (t.style === '自訂' ? t.code : `${t.code}(${t.style})`))
        .join('、');
      lines.push(`✅ 已新增 ${added.length} 個：${detail}`);
    }
    if (duplicated.length > 0)
      lines.push(`🔥 已存在 ${duplicated.length} 個：${duplicated.join('、')}`);
    if (noise.length > 0) lines.push(`🚫 過濾雜訊 ${noise.length} 個`);
    window.alert(lines.join('\n') || '無變動');
  };

  const handleAddKeyword = () => {
    const input = window.prompt(
      '輸入關鍵字（中文 / 英文，如：三上悠亞 / 巨乳 / OL）'
    );
    if (!input) return;
    const kw = input.trim();
    if (!kw) return;
    if (kw.length > 20) {
      window.alert('關鍵字最多 20 個字');
      return;
    }
    if (keywords.includes(kw)) {
      window.alert(`「${kw}」已經在關鍵字裡了`);
      return;
    }
    const next = [...keywords, kw];
    setKeywords(next);
    saveKeywords(next);
  };

  const handleDeleteKeyword = (kw: string) => {
    if (!window.confirm(`確定要移除「${kw}」嗎？`)) return;
    const next = keywords.filter((k) => k !== kw);
    setKeywords(next);
    saveKeywords(next);
  };

  const handleResetKeywords = () => {
    if (!window.confirm('確定要還原預設關鍵字嗎？（你自訂的關鍵字會被覆蓋）'))
      return;
    setKeywords(KEYWORDS_DEFAULT);
    saveKeywords(KEYWORDS_DEFAULT);
  };

  const handleBulkAddKeywords = () => {
    const input = window.prompt(
      '批量新增關鍵字（逗號/頓號/換行/空格分隔）\n範例：巨乳,人妻,清純'
    );
    if (!input) return;
    const candidates = input
      .split(/[,，、\n\r\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const existing = new Set(keywords);
    const added: string[] = [];
    const skipped: string[] = [];
    const tooLong: string[] = [];
    for (const kw of candidates) {
      if (kw.length > 20) {
        tooLong.push(kw);
        continue;
      }
      if (existing.has(kw) || added.includes(kw)) {
        skipped.push(kw);
        continue;
      }
      added.push(kw);
    }
    if (added.length > 0) {
      const next = [...keywords, ...added];
      setKeywords(next);
      saveKeywords(next);
    }
    const lines = [`✅ 新增 ${added.length} 個`];
    if (skipped.length > 0)
      lines.push(`⚠ 重複略過 ${skipped.length} 個：${skipped.join('、')}`);
    if (tooLong.length > 0) lines.push(`❌ 太長略過 ${tooLong.length} 個`);
    window.alert(lines.join('\n'));
  };

  const handleAddActress = () => {
    const input = window.prompt(
      '輸入演員名（繁體 / 簡體 / 日文，如：三上悠亞）'
    );
    if (!input) return;
    const name = input.trim();
    if (!name) return;
    if (name.length > 12) {
      window.alert('演員名最多 12 字');
      return;
    }
    if (actresses.includes(name)) {
      window.alert(`「${name}」已經在演員清單裡了`);
      return;
    }
    const next = [...actresses, name];
    setActresses(next);
    saveActresses(next);
  };

  const handleDeleteActress = (name: string) => {
    if (!window.confirm(`確定要移除「${name}」嗎？`)) return;
    const next = actresses.filter((n) => n !== name);
    setActresses(next);
    saveActresses(next);
  };

  const handleBulkAddActresses = () => {
    const input = window.prompt(
      '批量新增演員（逗號/頓號/換行/空格分隔）\n範例：三上悠亞,橋本有菜'
    );
    if (!input) return;
    const candidates = input
      .split(/[,，、\n\r\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const existing = new Set(actresses);
    const added: string[] = [];
    const skipped: string[] = [];
    const tooLong: string[] = [];
    for (const name of candidates) {
      if (name.length > 12) {
        tooLong.push(name);
        continue;
      }
      if (existing.has(name) || added.includes(name)) {
        skipped.push(name);
        continue;
      }
      added.push(name);
    }
    if (added.length > 0) {
      const next = [...actresses, ...added];
      setActresses(next);
      saveActresses(next);
    }
    const lines = [`✅ 新增 ${added.length} 個`];
    if (skipped.length > 0)
      lines.push(`⚠ 重複略過 ${skipped.length} 個：${skipped.join('、')}`);
    if (tooLong.length > 0) lines.push(`❌ 太長略過 ${tooLong.length} 個`);
    window.alert(lines.join('\n'));
  };

  const handleResetActresses = () => {
    if (!window.confirm('確定要還原預設演員清單嗎？（你自訂的會被覆蓋）'))
      return;
    setActresses(ACTRESSES_DEFAULT);
    saveActresses(ACTRESSES_DEFAULT);
  };

  return (
    <div className='space-y-8 mt-4'>
      {/* 推薦片商代號 */}
      <section>
        <h2 className='mb-4 text-lg font-bold text-gray-800 dark:text-gray-200'>
          推薦片商代號
          <span className='ml-3 text-sm font-normal text-gray-500 dark:text-gray-400'>
            點一下直接搜 · 滑過按 × 可移除
          </span>
          <button
            onClick={handleResetStudioTags}
            className='ml-3 text-sm font-normal text-gray-500 hover:text-rose-500 transition-colors dark:text-gray-400 dark:hover:text-rose-400'
          >
            還原預設
          </button>
        </h2>
        <div className='flex flex-wrap gap-2'>
          {[...studioTags]
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((tag) => {
              const isFav = studioFavs.has(tag.code);
              return (
                <div key={tag.code} className='relative group'>
                  <button
                    onClick={() => onSearch(tag.code)}
                    className={`px-3 py-2 rounded-full text-sm transition-colors duration-200 flex items-center gap-2 ${
                      isFav
                        ? 'bg-rose-500/25 ring-1 ring-rose-400 dark:bg-rose-500/30'
                        : 'bg-rose-500/10 hover:bg-rose-500/20 dark:bg-rose-500/15 dark:hover:bg-rose-500/25'
                    } text-gray-700 dark:text-gray-200`}
                  >
                    <span className='font-semibold text-rose-700 dark:text-rose-400'>
                      {tag.code}
                    </span>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      {tag.style}
                    </span>
                    <span
                      role='button'
                      aria-label={
                        isFav ? `取消收藏 ${tag.code}` : `收藏 ${tag.code}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleStudioFav(tag.code);
                      }}
                      className={`text-base leading-none cursor-pointer transition-colors ${
                        isFav
                          ? 'text-pink-500 hover:text-gray-400 dark:text-pink-400'
                          : 'text-gray-300 hover:text-pink-500 dark:text-gray-600 dark:hover:text-pink-400'
                      }`}
                      title={isFav ? '取消收藏' : '加入收藏'}
                    >
                      {isFav ? '❤' : '♡'}
                    </span>
                  </button>
                  <button
                    aria-label={`刪除 ${tag.code}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteStudioTag(tag.code);
                    }}
                    className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                  >
                    <X className='w-3 h-3' />
                  </button>
                </div>
              );
            })}
          <button
            onClick={handleAddStudioTag}
            className='px-3 py-2 bg-gray-500/10 hover:bg-rose-500/20 border-2 border-dashed border-gray-300 hover:border-rose-500 rounded-full text-sm text-gray-500 hover:text-rose-700 dark:bg-gray-700/30 dark:hover:bg-rose-500/15 dark:border-gray-600 dark:hover:border-rose-400 dark:text-gray-400 dark:hover:text-rose-400 transition-colors duration-200 flex items-center gap-1'
          >
            <Plus className='w-4 h-4' />
            <span>新增</span>
          </button>
          <button
            onClick={handleBulkAddStudioTags}
            className='px-3 py-2 bg-rose-500/10 hover:bg-rose-500/30 border-2 border-rose-300 hover:border-rose-500 rounded-full text-sm text-rose-700 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:border-rose-400 dark:text-rose-300 transition-colors duration-200 flex items-center gap-1'
          >
            <Plus className='w-4 h-4' />
            <span>批量新增</span>
          </button>
          <button
            onClick={handleExtractStudioCodesFromText}
            className='px-3 py-2 bg-blue-500/10 hover:bg-blue-500/30 border-2 border-blue-300 hover:border-blue-500 rounded-full text-sm text-blue-700 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:border-blue-400 dark:text-blue-300 transition-colors duration-200 flex items-center gap-1'
          >
            <Plus className='w-4 h-4' />
            <span>文字過濾</span>
          </button>
        </div>
      </section>

      {/* 常用關鍵字 */}
      <section>
        <h2 className='mb-4 text-lg font-bold text-gray-800 dark:text-gray-200'>
          常用關鍵字
          <span className='ml-3 text-sm font-normal text-gray-500 dark:text-gray-400'>
            點一下直接搜 · 滑過按 × 可移除
          </span>
          <button
            onClick={handleResetKeywords}
            className='ml-3 text-sm font-normal text-gray-500 hover:text-rose-500 transition-colors dark:text-gray-400 dark:hover:text-rose-400'
          >
            還原預設
          </button>
        </h2>
        <div className='flex flex-wrap gap-2'>
          {keywords.map((kw) => (
            <div key={kw} className='relative group'>
              <button
                onClick={() => onSearch(kw)}
                className='px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:text-gray-200'
              >
                <span className='font-semibold text-blue-700 dark:text-blue-400'>
                  {kw}
                </span>
              </button>
              <button
                aria-label={`刪除 ${kw}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDeleteKeyword(kw);
                }}
                className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
              >
                <X className='w-3 h-3' />
              </button>
            </div>
          ))}
          <button
            onClick={handleAddKeyword}
            className='px-3 py-2 bg-gray-500/10 hover:bg-blue-500/20 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-full text-sm text-gray-500 hover:text-blue-700 dark:bg-gray-700/30 dark:hover:bg-blue-500/15 dark:border-gray-600 dark:hover:border-blue-400 dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200 flex items-center gap-1'
          >
            <Plus className='w-4 h-4' />
            <span>新增</span>
          </button>
          <button
            onClick={handleBulkAddKeywords}
            className='px-3 py-2 bg-blue-500/10 hover:bg-blue-500/30 border-2 border-blue-300 hover:border-blue-500 rounded-full text-sm text-blue-700 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:border-blue-400 dark:text-blue-300 transition-colors duration-200 flex items-center gap-1'
          >
            <Plus className='w-4 h-4' />
            <span>批量新增</span>
          </button>
        </div>
      </section>

      {/* 推薦演員 */}
      <section>
        <h2 className='mb-4 text-lg font-bold text-gray-800 dark:text-gray-200'>
          推薦演員
          <span className='ml-3 text-sm font-normal text-gray-500 dark:text-gray-400'>
            按字數分組 · 點一下直接搜
          </span>
          <button
            onClick={handleResetActresses}
            className='ml-3 text-sm font-normal text-gray-500 hover:text-rose-500 transition-colors dark:text-gray-400 dark:hover:text-rose-400'
          >
            還原預設
          </button>
        </h2>
        <div className='space-y-3'>
          {actressesByLength.map(([len, names]) => (
            <div key={len}>
              <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2'>
                {len} 字
              </div>
              <div className='flex flex-wrap gap-2'>
                {names.map((name) => (
                  <div key={name} className='relative group'>
                    <button
                      onClick={() => onSearch(name)}
                      className='px-3 py-2 bg-pink-500/10 hover:bg-pink-500/20 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-pink-500/15 dark:hover:bg-pink-500/25 dark:text-gray-200'
                    >
                      <span className='font-semibold text-pink-700 dark:text-pink-400'>
                        {name}
                      </span>
                    </button>
                    <button
                      aria-label={`刪除 ${name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteActress(name);
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className='flex flex-wrap gap-2'>
            <button
              onClick={handleAddActress}
              className='px-3 py-2 bg-gray-500/10 hover:bg-pink-500/20 border-2 border-dashed border-gray-300 hover:border-pink-500 rounded-full text-sm text-gray-500 hover:text-pink-700 dark:bg-gray-700/30 dark:hover:bg-pink-500/15 dark:border-gray-600 dark:hover:border-pink-400 dark:text-gray-400 dark:hover:text-pink-400 transition-colors duration-200 inline-flex items-center gap-1'
            >
              <Plus className='w-4 h-4' />
              <span>新增</span>
            </button>
            <button
              onClick={handleBulkAddActresses}
              className='px-3 py-2 bg-pink-500/10 hover:bg-pink-500/30 border-2 border-pink-300 hover:border-pink-500 rounded-full text-sm text-pink-700 dark:bg-pink-500/15 dark:hover:bg-pink-500/25 dark:border-pink-400 dark:text-pink-300 transition-colors duration-200 inline-flex items-center gap-1'
            >
              <Plus className='w-4 h-4' />
              <span>批量新增</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
