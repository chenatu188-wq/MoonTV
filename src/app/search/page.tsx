/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { Plus, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

// 阿公專區常見片商代號（公開的工業識別碼，FANZA / DMM 都列出來）
// 預設清單，可在 UI 上新增 / 刪除（存 localStorage）
type StudioTag = { code: string; style: string };
const STUDIO_TAGS_DEFAULT: StudioTag[] = [
  // 主流大廠
  { code: 'SSIS', style: '大廠' },
  { code: 'IPX', style: '偶像系' },
  { code: 'IPZZ', style: '偶像系' },
  { code: 'IDBD', style: '精選' },
  { code: 'STARS', style: '偶像' },
  { code: 'PRED', style: '中堅' },
  // MOODYZ 家族
  { code: 'MIDV', style: '老牌' },
  { code: 'MIAA', style: '老牌' },
  { code: 'MIAB', style: '老牌' },
  { code: 'MIDA', style: '老牌' },
  { code: 'MIDE', style: '老牌' },
  // SOD 家族
  { code: 'SDDE', style: '老牌' },
  { code: 'SDAB', style: '老牌' },
  { code: 'SW', style: '老牌' },
  // Madonna / 人妻系
  { code: 'JUL', style: '人妻' },
  { code: 'JUQ', style: '人妻' },
  { code: 'JUFE', style: '人妻' },
  { code: 'ROE', style: '人妻' },
  { code: 'MDYD', style: '人妻' },
  { code: 'MEYD', style: '人妻' },
  { code: 'VEC', style: '人妻' },
  { code: 'VENX', style: '熟女' },
  // Faleno / 新興
  { code: 'FSDSS', style: '新興' },
  // Wanz 家族
  { code: 'WAAA', style: '大眾' },
  { code: 'WANZ', style: '大眾' },
  // kawaii
  { code: 'CAWD', style: '清純' },
  // E-BODY 巨乳
  { code: 'EBOD', style: '巨乳' },
  // Attackers 劇情
  { code: 'ATID', style: '劇情' },
  { code: 'SHKD', style: '劇情' },
  // DANDY / HUNTER 戲劇系
  { code: 'DANDY', style: '戲劇' },
  { code: 'HUNTC', style: '戲劇' },
  // h.m.p / 老牌
  { code: 'HODV', style: '老牌' },
  // Bibian 女女
  { code: 'HMDB', style: '女女' },
  // 素人系
  { code: 'HJMO', style: '素人' },
  // 其他中堅
  { code: 'HMN', style: '中堅' },
  { code: 'DASS', style: '中堅' },
  { code: 'GVH', style: '中堅' },
  { code: 'FERA', style: '中堅' },
  { code: 'TPPN', style: '中堅' },
  // 較少見 / 自訂
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
const STUDIO_TAGS_KEY = 'moontv_studio_tags_v1';
const STUDIO_FAVS_KEY = 'moontv_studio_favs_v1';

const loadStudioFavs = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STUDIO_FAVS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
};

const saveStudioFavs = (set: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDIO_FAVS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
};

// 常用關鍵字（中文 / 任意字串）—— 跟片商代號分開存，避免格式混淆
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
  // 韓國（阿公要求 2026-05-12）— 現有採集站「韩国」關鍵字有大量結果，含三級 / 主播
  '韓國',
  '韓國三級',
  '韓國主播',
  '倫理三級',
  // 歐美 / 美國（阿公要求 2026-05-12）— hsckzy 1480 筆、fhapi9 598 筆「黑人」
  '歐美',
  '歐美三級',
  '美國',
  '黑人',
  // 畫質篩選（阿公嫌片太老不清楚，2026-05-12）— lbapiby 4K 5260 筆、fhapi9 高清 2958 筆
  '4K',
  '高清',
  '1080P',
];
const KEYWORDS_KEY = 'moontv_keywords_v1';

// 推薦演員（依字數分組顯示）—— 用繁體寫，後端已有 繁→簡 + 繁→日 自動轉換
const ACTRESSES_DEFAULT: string[] = [
  // 2 字
  '葵司',
  // 3 字
  '蒼井空',
  '麻倉憂',
  '楓可憐',
  '篠田優',
  '大槻響',
  // 4 字
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
  // 5 字
  '波多野結衣',
  '神宮寺奈緒',
  '桐谷茉莉',
  '涼森玲夢',
  '永井瑪利亞',
];
const ACTRESSES_KEY = 'moontv_actresses_v1';

const loadStudioTags = (): StudioTag[] => {
  if (typeof window === 'undefined') return STUDIO_TAGS_DEFAULT;
  try {
    const raw = localStorage.getItem(STUDIO_TAGS_KEY);
    if (!raw) return STUDIO_TAGS_DEFAULT;
    const parsed = JSON.parse(raw) as StudioTag[];
    if (!Array.isArray(parsed)) return STUDIO_TAGS_DEFAULT;
    return parsed;
  } catch {
    return STUDIO_TAGS_DEFAULT;
  }
};

const saveStudioTags = (tags: StudioTag[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDIO_TAGS_KEY, JSON.stringify(tags));
  } catch {
    // ignore quota / privacy mode
  }
};

const loadKeywords = (): string[] => {
  if (typeof window === 'undefined') return KEYWORDS_DEFAULT;
  try {
    const raw = localStorage.getItem(KEYWORDS_KEY);
    if (!raw) return KEYWORDS_DEFAULT;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return KEYWORDS_DEFAULT;
    return parsed;
  } catch {
    return KEYWORDS_DEFAULT;
  }
};

const saveKeywords = (keywords: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYWORDS_KEY, JSON.stringify(keywords));
  } catch {
    // ignore
  }
};

const loadActresses = (): string[] => {
  if (typeof window === 'undefined') return ACTRESSES_DEFAULT;
  try {
    const raw = localStorage.getItem(ACTRESSES_KEY);
    if (!raw) return ACTRESSES_DEFAULT;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return ACTRESSES_DEFAULT;
    return parsed;
  } catch {
    return ACTRESSES_DEFAULT;
  }
};

const saveActresses = (names: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTRESSES_KEY, JSON.stringify(names));
  } catch {
    // ignore
  }
};

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 片商代號標籤（可由阿公自行新增 / 刪除）
  const [studioTags, setStudioTags] =
    useState<StudioTag[]>(STUDIO_TAGS_DEFAULT);
  // 片商代號收藏（純記號，不影響清單）
  const [studioFavs, setStudioFavs] = useState<Set<string>>(new Set());
  // 常用關鍵字（中文 / 任意字串）
  const [keywords, setKeywords] = useState<string[]>(KEYWORDS_DEFAULT);
  // 推薦演員（依字數分組顯示）
  const [actresses, setActresses] = useState<string[]>(ACTRESSES_DEFAULT);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // 获取默认聚合设置：只读取用户本地设置，默认为 true
  const getDefaultAggregate = () => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true; // 默认启用聚合
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });

  // 搜索結果分頁（每頁 100 筆）
  const SEARCH_PAGE_SIZE = 100;
  const [searchPage, setSearchPage] = useState(1);
  useEffect(() => {
    setSearchPage(1);
  }, [searchQuery, viewMode]);

  // 聚合后的结果（按标题和年份分组）
  const aggregatedResults = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    searchResults.forEach((item) => {
      // 使用 title + year + type 作为键，year 必然存在，但依然兜底 'unknown'
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      // 优先排序：标题与搜索词完全一致的排在前面
      const aExactMatch = a[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));
      const bExactMatch = b[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 評分排序：有分優先，高分靠前
      const aScore = a[1][0].score ?? 0;
      const bScore = b[1][0].score ?? 0;
      if (aScore !== bScore) {
        return bScore - aScore;
      }

      // 同分再按年份
      const aYear = a[1][0].year;
      const bYear = b[1][0].year;
      if (aYear === bYear) {
        return a[0].localeCompare(b[0]);
      }
      if (aYear === 'unknown') return 1;
      if (bYear === 'unknown') return -1;
      return aYear > bYear ? -1 : 1;
    });
  }, [searchResults]);

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

    // 初始加载片商代號（從 localStorage 讀；首次無資料時用預設）
    // 載入片商代號收藏
    setStudioFavs(loadStudioFavs());

    // 非破壞式合併：使用者已自訂的不動，把預設裡有但本機沒有的代號自動補進來
    const stored = loadStudioTags();
    const storedCodes = new Set(stored.map((t) => t.code));
    const missingDefaults = STUDIO_TAGS_DEFAULT.filter(
      (t) => !storedCodes.has(t.code)
    );
    if (missingDefaults.length > 0) {
      const merged = [...stored, ...missingDefaults];
      setStudioTags(merged);
      saveStudioTags(merged);
    } else {
      setStudioTags(stored);
    }

    // 同樣方式載入關鍵字
    const storedKeywords = loadKeywords();
    const storedKwSet = new Set(storedKeywords);
    const missingKeywords = KEYWORDS_DEFAULT.filter((k) => !storedKwSet.has(k));
    if (missingKeywords.length > 0) {
      const mergedKeywords = [...storedKeywords, ...missingKeywords];
      setKeywords(mergedKeywords);
      saveKeywords(mergedKeywords);
    } else {
      setKeywords(storedKeywords);
    }

    // 同樣方式載入演員
    const storedActresses = loadActresses();
    const storedActSet = new Set(storedActresses);
    const missingActresses = ACTRESSES_DEFAULT.filter(
      (a) => !storedActSet.has(a)
    );
    if (missingActresses.length > 0) {
      const mergedActresses = [...storedActresses, ...missingActresses];
      setActresses(mergedActresses);
      saveActresses(mergedActresses);
    } else {
      setActresses(storedActresses);
    }

    // 监听搜索历史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    // 当搜索参数变化时更新搜索状态
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      fetchSearchResults(query);

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(query);
    } else {
      setShowResults(false);
    }
  }, [searchParams]);

  const fetchSearchResults = async (query: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}`
      );
      const data = await response.json();
      setSearchResults(
        data.results.sort((a: SearchResult, b: SearchResult) => {
          // 优先排序：标题与搜索词完全一致的排在前面
          const aExactMatch = a.title === query.trim();
          const bExactMatch = b.title === query.trim();

          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;

          // 評分高的靠前，無分排後
          const aScore = a.score ?? 0;
          const bScore = b.score ?? 0;
          if (aScore !== bScore) return bScore - aScore;

          // 同分按年份
          if (a.year === 'unknown' && b.year === 'unknown') return 0;
          if (a.year === 'unknown') return 1;
          if (b.year === 'unknown') return -1;
          if (a.year !== b.year)
            return parseInt(a.year) > parseInt(b.year) ? -1 : 1;
          return a.title.localeCompare(b.title);
        })
      );
      setShowResults(true);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 阿公新增一個片商代號
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
      `輸入「${code}」的風格說明（可空、最多 6 字，例：偶像 / 人妻 / 巨乳）`,
      ''
    );
    const style = (styleInput || '').trim().slice(0, 6) || '自訂';
    const next = [...studioTags, { code, style }];
    setStudioTags(next);
    saveStudioTags(next);
  };

  // 刪除一個片商代號
  const handleDeleteStudioTag = (code: string) => {
    if (!window.confirm(`確定要移除「${code}」標籤嗎？`)) return;
    const next = studioTags.filter((t) => t.code !== code);
    setStudioTags(next);
    saveStudioTags(next);
  };

  // 還原預設清單（手滑刪錯救命用）
  // 切換片商代號收藏
  const toggleStudioFav = (code: string) => {
    const next = new Set(studioFavs);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setStudioFavs(next);
    saveStudioFavs(next);
  };

  const handleResetStudioTags = () => {
    if (
      !window.confirm(
        `確定要還原預設清單嗎？\n（你目前自訂的代號會被覆蓋，預設清單會回來）`
      )
    )
      return;
    setStudioTags(STUDIO_TAGS_DEFAULT);
    saveStudioTags(STUDIO_TAGS_DEFAULT);
  };

  // 新增關鍵字
  const handleAddKeyword = () => {
    const input = window.prompt(
      '輸入關鍵字（中文 / 英文皆可，例：三上悠亞 / 巨乳 / OL）'
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

  // 刪除關鍵字
  const handleDeleteKeyword = (kw: string) => {
    if (!window.confirm(`確定要移除「${kw}」嗎？`)) return;
    const next = keywords.filter((k) => k !== kw);
    setKeywords(next);
    saveKeywords(next);
  };

  // 還原預設關鍵字
  const handleResetKeywords = () => {
    if (!window.confirm('確定要還原預設關鍵字嗎？\n（你自訂的關鍵字會被覆蓋）'))
      return;
    setKeywords(KEYWORDS_DEFAULT);
    saveKeywords(KEYWORDS_DEFAULT);
  };

  // 批量新增關鍵字（支援逗號 / 頓號 / 換行 / 空白分隔）
  const handleBulkAddKeywords = () => {
    const input = window.prompt(
      [
        '批量新增關鍵字',
        '分隔可用：逗號 , 頓號 、 換行或空格',
        '',
        '範例：',
        '巨乳,人妻,清純,OL',
      ].join('\n')
    );
    if (!input) return;
    const candidates = input
      .split(/[,，、\n\r\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (candidates.length === 0) return;

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
    if (tooLong.length > 0)
      lines.push(`❌ 太長略過 ${tooLong.length} 個：${tooLong.join('、')}`);
    window.alert(lines.join('\n'));
  };

  // 批量新增片商代號（每筆只有代號、style 自動設「自訂」）
  const handleBulkAddStudioTags = () => {
    const input = window.prompt(
      [
        '批量新增片商代號（風格自動標「自訂」、之後可單筆編輯）',
        '分隔可用：逗號 , 頓號 、 換行或空格',
        '',
        '範例：',
        'OFJE,SNIS,DOCP',
      ].join('\n')
    );
    if (!input) return;
    const candidates = input
      .split(/[,，、\n\r\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (candidates.length === 0) return;

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
      lines.push(
        `❌ 格式錯誤略過 ${invalid.length} 個：${invalid.join(
          '、'
        )}（限 2-8 個英文字母）`
      );
    window.alert(lines.join('\n'));
  };

  // 從一段任意文字過濾出片商代號（複製整篇文章 / 排行榜貼進來，自動只留代號）
  const handleExtractStudioCodesFromText = () => {
    const input = window.prompt(
      [
        '從文字過濾片商代號（貼任何混雜內容都行，會自動只留代號）',
        '會抓出所有 2-8 個連續大寫英文字母當候選，過濾常見雜訊（HTML/API/DVD…）',
        '',
        '範例輸入：',
        '今天推薦 SSIS-456、IPX-789，還有 OFJE-345 也好看 (HD 1080P)',
        '→ 會抓出 SSIS、IPX、OFJE',
      ].join('\n')
    );
    if (!input) return;
    // 分類關鍵字 → 比對代號附近文字（順序就是優先順序）
    const CATEGORY_PATTERNS: Array<[string, RegExp]> = [
      ['人妻', /人妻|已婚|主婦|婦女|有夫之婦|老婆|妻子/],
      ['中出', /中出|內射|懷孕|生殖器/],
      ['巨乳', /巨乳|大奶|爆乳|奶子|[A-Z]罩杯|乳交|豐滿/],
      ['熟女', /熟女|成熟|御[姉姊]|阿姨|大姐|姐姐/],
      ['出軌', /NTR|出軌|不倫|偷情|背叛|外遇/],
      ['美少女', /美少女|女子高生|高中女生|JK|高中生/],
      ['亂倫', /亂倫|姐妹|妹妹|義[姐姊母]|繼母|表姐|阿姨/],
      ['多P', /多P|3P|4P|群交|亂交|輪[姦插]/],
      ['企畫', /企畫|企劃/],
      ['教師', /教師|老師|女教師|家庭教師/],
      ['口交', /口交|接吻|法式|口水|咽喉|吸吮|舔/],
      ['潮吹', /潮吹|噴水|失禁|漏尿/],
      ['痴漢', /痴漢|電車/],
      ['制服', /制服|OL|護士|空姐|警察|女僕/],
      ['調教', /調教|奴隸|束縛|SM|綑綁/],
      ['強姦', /強[姦暴]|強制|強迫/],
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
    // 抓代號 + 取附近文字判類型；重複代號合併它們各自的上下文
    const upperInput = input.toUpperCase();
    const regex = /\b[A-Z]{2,8}\b/g;
    const codeContexts = new Map<string, Set<string>>(); // code → set of categories
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
    // 常見雜訊（網頁 / 影音 / 檔案 / 地區），不會被當片商代號
    const noiseBlocklist = new Set([
      'HTML',
      'CSS',
      'JS',
      'API',
      'URL',
      'URI',
      'HTTP',
      'HTTPS',
      'FTP',
      'SSH',
      'SSL',
      'TLS',
      'HD',
      'FHD',
      'UHD',
      'SD',
      'BD',
      'DVD',
      'CD',
      'VCD',
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
      'WMV',
      'FLV',
      'WEBM',
      'TS',
      'JPG',
      'JPEG',
      'PNG',
      'GIF',
      'WEBP',
      'BMP',
      'PDF',
      'TXT',
      'DOC',
      'XLS',
      'ZIP',
      'RAR',
      'TAR',
      'GZ',
      '7Z',
      'EXE',
      'APK',
      'DMG',
      'ISO',
      'GB',
      'MB',
      'KB',
      'TB',
      'FPS',
      'BPS',
      'BIT',
      'BYTE',
      'USA',
      'UK',
      'JP',
      'CN',
      'TW',
      'HK',
      'KR',
      'EU',
      'CA',
      'VIP',
      'FREE',
      'NEW',
      'HOT',
      'TOP',
      'LIVE',
      'FULL',
      'PRO',
      'EXT',
      'EXP',
      'ID',
      'IP',
      'OS',
      'UI',
      'UX',
      'DB',
      'AI',
      'ML',
      'NN',
      'GPU',
      'CPU',
      'RAM',
      'PC',
      'MAC',
      'IOS',
      'WIN',
      'LINUX',
      'IPHONE',
      'IPAD',
      'XYZ',
      'ABC',
      'ETC',
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
      'EST',
      'JST',
      'CST',
      'PG',
      'PV',
      'OP',
      'ED',
      'EP',
      'OST',
      'BGM',
      'SE',
      'MV',
      // 成人網常見雜訊
      'NTR',
      'DMM',
      'DMCA',
      'FUCK',
      'SEX',
      'BDSM',
      'BBC',
      'POV',
      'RAW',
      'CEN',
      'UNCEN',
      'MILF',
      'GILF',
      'OL',
      'JK',
      'JAV',
      'GANG',
      'HQ',
      'LQ',
      'TAG',
      'TAGS',
      'TIP',
      'TIPS',
      'LOL',
      'OMG',
      'WTF',
      'IMG',
      'GIF',
    ]);
    const existing = new Set(studioTags.map((t) => t.code));
    const candidates: string[] = [];
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
      candidates.push(code);
    }
    if (candidates.length === 0 && duplicated.length === 0) {
      const lines = [`📭 沒抓到片商代號`];
      if (noise.length > 0)
        lines.push(`🚫 過濾雜訊 ${noise.length} 個：${noise.join('、')}`);
      window.alert(lines.join('\n'));
      return;
    }
    // 新代號 → 用自動分類當 style（多分類組合，例：「人妻中出」）
    const added: StudioTag[] = candidates.map((code) => {
      const cats = Array.from(codeContexts.get(code) || []);
      return { code, style: cats.length > 0 ? cats.join('') : '自訂' };
    });
    // 已存在代號 → 原 style 前加 🔥（保留原類型），且把這次新偵測到的分類合進去
    const dupSet = new Set(duplicated);
    const updated: string[] = [];
    const nextList = studioTags.map((t) => {
      if (!dupSet.has(t.code)) return t;
      const newCats = Array.from(codeContexts.get(t.code) || []);
      const baseStyle = t.style.startsWith('🔥') ? t.style : `🔥${t.style}`;
      // 若這次偵測到新分類且原 style 沒有，追加
      let mergedStyle = baseStyle;
      for (const c of newCats) {
        if (!mergedStyle.includes(c)) mergedStyle += c;
      }
      if (mergedStyle !== t.style) {
        updated.push(t.code);
        return { ...t, style: mergedStyle };
      }
      return t;
    });
    const next = [...nextList, ...added];
    setStudioTags(next);
    saveStudioTags(next);
    const lines: string[] = [];
    if (added.length > 0) {
      const detail = added
        .map((t) => (t.style === '自訂' ? t.code : `${t.code}(${t.style})`))
        .join('、');
      lines.push(`✅ 已新增 ${added.length} 個：${detail}`);
    }
    if (updated.length > 0)
      lines.push(
        `🔥 已存在 ${updated.length} 個加熱榜標記：${updated.join('、')}`
      );
    if (noise.length > 0)
      lines.push(`🚫 過濾雜訊 ${noise.length} 個：${noise.join('、')}`);
    window.alert(lines.join('\n') || '無變動');
  };

  // 新增演員
  const handleAddActress = () => {
    const input = window.prompt(
      '輸入演員名（繁體 / 簡體 / 日文皆可，例：三上悠亞）'
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

  // 刪除演員
  const handleDeleteActress = (name: string) => {
    if (!window.confirm(`確定要移除「${name}」嗎？`)) return;
    const next = actresses.filter((n) => n !== name);
    setActresses(next);
    saveActresses(next);
  };

  // 批量新增演員（支援逗號 / 頓號 / 換行 / 空白分隔）
  const handleBulkAddActresses = () => {
    const input = window.prompt(
      [
        '批量新增演員 — 可一次貼一串',
        '分隔可用：逗號 , 頓號 、 換行或空格',
        '',
        '範例：',
        '三上悠亞,橋本有菜,河北彩花',
        '或',
        '三上悠亞、橋本有菜、河北彩花',
      ].join('\n')
    );
    if (!input) return;

    // 拆分：逗號 / 頓號 / 換行 / 全形逗號 / 多空白
    const candidates = input
      .split(/[,，、\n\r\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (candidates.length === 0) return;

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

    // 結果回報
    const lines = [`✅ 新增 ${added.length} 個`];
    if (skipped.length > 0)
      lines.push(`⚠ 重複略過 ${skipped.length} 個：${skipped.join('、')}`);
    if (tooLong.length > 0)
      lines.push(`❌ 太長略過 ${tooLong.length} 個：${tooLong.join('、')}`);
    window.alert(lines.join('\n'));
  };

  // 還原預設演員清單
  const handleResetActresses = () => {
    if (!window.confirm('確定要還原預設演員清單嗎？\n（你自訂的會被覆蓋）'))
      return;
    setActresses(ACTRESSES_DEFAULT);
    saveActresses(ACTRESSES_DEFAULT);
  };

  // 演員按字數分組（用於 UI 渲染）
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    // 回显搜索框
    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    // 直接发请求
    fetchSearchResults(trimmed);

    // 保存到搜索历史 (事件监听会自动更新界面)
    addSearchHistory(trimmed);
  };

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='片名 / 演員 / 片商代號（如 SSIS、ABP）'
                className='w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {isLoading ? (
            <div className='flex justify-center items-center h-40'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
            </div>
          ) : showResults ? (
            <section className='mb-12'>
              {/* 标题 + 聚合开关 */}
              <div className='mb-8 flex items-center justify-between'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  搜索结果
                </h2>
                {/* 聚合开关 */}
                <label className='flex items-center gap-2 cursor-pointer select-none'>
                  <span className='text-sm text-gray-700 dark:text-gray-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>
              <div
                key={`search-results-${viewMode}`}
                className='justify-start grid grid-cols-2 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(14rem,_1fr))] sm:gap-x-8'
              >
                {viewMode === 'agg'
                  ? aggregatedResults
                      .slice(
                        (searchPage - 1) * SEARCH_PAGE_SIZE,
                        searchPage * SEARCH_PAGE_SIZE
                      )
                      .map(([mapKey, group]) => {
                        return (
                          <div key={`agg-${mapKey}`} className='w-full'>
                            <VideoCard
                              from='search'
                              items={group}
                              query={
                                searchQuery.trim() !== group[0].title
                                  ? searchQuery.trim()
                                  : ''
                              }
                            />
                          </div>
                        );
                      })
                  : searchResults
                      .slice(
                        (searchPage - 1) * SEARCH_PAGE_SIZE,
                        searchPage * SEARCH_PAGE_SIZE
                      )
                      .map((item) => (
                        <div
                          key={`all-${item.source}-${item.id}`}
                          className='w-full'
                        >
                          <VideoCard
                            id={item.id}
                            title={item.title}
                            poster={item.poster}
                            episodes={item.episodes.length}
                            source={item.source}
                            source_name={item.source_name}
                            douban_id={item.douban_id?.toString()}
                            query={
                              searchQuery.trim() !== item.title
                                ? searchQuery.trim()
                                : ''
                            }
                            year={item.year}
                            from='search'
                            type={item.episodes.length > 1 ? 'tv' : 'movie'}
                          />
                        </div>
                      ))}
                {searchResults.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相关结果
                  </div>
                )}
              </div>
              {/* 搜索結果分頁（每頁 100 筆） */}
              {(() => {
                const total =
                  viewMode === 'agg'
                    ? aggregatedResults.length
                    : searchResults.length;
                if (total <= SEARCH_PAGE_SIZE) return null;
                const totalPages = Math.ceil(total / SEARCH_PAGE_SIZE);
                const safePage = Math.min(Math.max(1, searchPage), totalPages);
                return (
                  <div className='mt-8 flex flex-wrap items-center justify-center gap-2'>
                    <span className='text-sm text-gray-500 dark:text-gray-400 mr-2'>
                      共 {total} 筆，第 {safePage} / {totalPages} 頁
                    </span>
                    <button
                      disabled={safePage <= 1}
                      onClick={() => {
                        setSearchPage(safePage - 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className='px-3 py-1 rounded text-sm bg-gray-200 hover:bg-green-500/30 disabled:opacity-40 dark:bg-gray-700 dark:hover:bg-green-500/30'
                    >
                      ← 上一頁
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - safePage) <= 2
                      )
                      .map((p, idx, arr) => (
                        <span key={p} className='flex items-center gap-2'>
                          {idx > 0 && arr[idx - 1] !== p - 1 && (
                            <span className='text-gray-400'>…</span>
                          )}
                          <button
                            onClick={() => {
                              setSearchPage(p);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`px-3 py-1 rounded text-sm ${
                              p === safePage
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 hover:bg-green-500/30 dark:bg-gray-700 dark:hover:bg-green-500/30'
                            }`}
                          >
                            {p}
                          </button>
                        </span>
                      ))}
                    <button
                      disabled={safePage >= totalPages}
                      onClick={() => {
                        setSearchPage(safePage + 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className='px-3 py-1 rounded text-sm bg-gray-200 hover:bg-green-500/30 disabled:opacity-40 dark:bg-gray-700 dark:hover:bg-green-500/30'
                    >
                      下一頁 →
                    </button>
                  </div>
                );
              })()}
            </section>
          ) : (
            <>
              {/* 推薦片商代號（adult-edition 阿公專區用，一鍵搜常見片商） */}
              <section className='mb-8'>
                <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                  推薦片商代號
                  <span className='ml-3 text-sm font-normal text-gray-500 dark:text-gray-400'>
                    點一下直接搜 · 滑過按 × 可移除
                  </span>
                  <button
                    onClick={handleResetStudioTags}
                    className='ml-3 text-sm font-normal text-gray-500 hover:text-green-600 transition-colors dark:text-gray-400 dark:hover:text-green-400'
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
                            onClick={() => {
                              setSearchQuery(tag.code);
                              router.push(
                                `/search?q=${encodeURIComponent(tag.code)}`
                              );
                            }}
                            className={`px-3 py-2 rounded-full text-sm transition-colors duration-200 flex items-center gap-2 ${
                              isFav
                                ? 'bg-green-500/25 ring-1 ring-green-400 dark:bg-green-500/30'
                                : 'bg-green-500/10 hover:bg-green-500/20 dark:bg-green-500/15 dark:hover:bg-green-500/25'
                            } text-gray-700 dark:text-gray-200`}
                          >
                            <span className='font-semibold text-green-700 dark:text-green-400'>
                              {tag.code}
                            </span>
                            <span className='text-xs text-gray-500 dark:text-gray-400'>
                              {tag.style}
                            </span>
                            <span
                              role='button'
                              aria-label={
                                isFav
                                  ? `取消收藏 ${tag.code}`
                                  : `收藏 ${tag.code}`
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
                  {/* 新增代號（單筆） */}
                  <button
                    onClick={handleAddStudioTag}
                    className='px-3 py-2 bg-gray-500/10 hover:bg-green-500/20 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-full text-sm text-gray-500 hover:text-green-700 dark:bg-gray-700/30 dark:hover:bg-green-500/15 dark:border-gray-600 dark:hover:border-green-400 dark:text-gray-400 dark:hover:text-green-400 transition-colors duration-200 flex items-center gap-1'
                    title='新增片商代號（單筆）'
                  >
                    <Plus className='w-4 h-4' />
                    <span>新增</span>
                  </button>
                  {/* 批量新增 */}
                  <button
                    onClick={handleBulkAddStudioTags}
                    className='px-3 py-2 bg-green-500/10 hover:bg-green-500/30 border-2 border-green-300 hover:border-green-500 rounded-full text-sm text-green-700 dark:bg-green-500/15 dark:hover:bg-green-500/25 dark:border-green-400 dark:text-green-300 transition-colors duration-200 flex items-center gap-1'
                    title='批量新增（一次貼一串）'
                  >
                    <Plus className='w-4 h-4' />
                    <span>批量新增</span>
                  </button>
                  {/* 從文字過濾代號（貼整篇文章自動抓） */}
                  <button
                    onClick={handleExtractStudioCodesFromText}
                    className='px-3 py-2 bg-blue-500/10 hover:bg-blue-500/30 border-2 border-blue-300 hover:border-blue-500 rounded-full text-sm text-blue-700 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:border-blue-400 dark:text-blue-300 transition-colors duration-200 flex items-center gap-1'
                    title='從文字過濾代號（貼整篇文章 / 排行榜，自動抓代號加入）'
                  >
                    <Plus className='w-4 h-4' />
                    <span>文字過濾</span>
                  </button>
                </div>
              </section>

              {/* 常用關鍵字（中文 / 任意字串，跟代號分開） */}
              <section className='mb-8'>
                <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                  常用關鍵字
                  <span className='ml-3 text-sm font-normal text-gray-500 dark:text-gray-400'>
                    點一下直接搜 · 滑過按 × 可移除
                  </span>
                  <button
                    onClick={handleResetKeywords}
                    className='ml-3 text-sm font-normal text-gray-500 hover:text-green-600 transition-colors dark:text-gray-400 dark:hover:text-green-400'
                  >
                    還原預設
                  </button>
                </h2>
                <div className='flex flex-wrap gap-2'>
                  {keywords.map((kw) => (
                    <div key={kw} className='relative group'>
                      <button
                        onClick={() => {
                          setSearchQuery(kw);
                          router.push(`/search?q=${encodeURIComponent(kw)}`);
                        }}
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
                    title='新增關鍵字（單筆）'
                  >
                    <Plus className='w-4 h-4' />
                    <span>新增</span>
                  </button>
                  <button
                    onClick={handleBulkAddKeywords}
                    className='px-3 py-2 bg-blue-500/10 hover:bg-blue-500/30 border-2 border-blue-300 hover:border-blue-500 rounded-full text-sm text-blue-700 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:border-blue-400 dark:text-blue-300 transition-colors duration-200 flex items-center gap-1'
                    title='批量新增（一次貼一串）'
                  >
                    <Plus className='w-4 h-4' />
                    <span>批量新增</span>
                  </button>
                </div>
              </section>

              {/* 推薦演員（按字數分組） */}
              <section className='mb-8'>
                <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                  推薦演員
                  <span className='ml-3 text-sm font-normal text-gray-500 dark:text-gray-400'>
                    按字數分組 · 點一下直接搜
                  </span>
                  <button
                    onClick={handleResetActresses}
                    className='ml-3 text-sm font-normal text-gray-500 hover:text-green-600 transition-colors dark:text-gray-400 dark:hover:text-green-400'
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
                              onClick={() => {
                                setSearchQuery(name);
                                router.push(
                                  `/search?q=${encodeURIComponent(name)}`
                                );
                              }}
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
                      title='新增演員（單一）'
                    >
                      <Plus className='w-4 h-4' />
                      <span>新增</span>
                    </button>
                    <button
                      onClick={handleBulkAddActresses}
                      className='px-3 py-2 bg-pink-500/10 hover:bg-pink-500/30 border-2 border-pink-300 hover:border-pink-500 rounded-full text-sm text-pink-700 dark:bg-pink-500/15 dark:hover:bg-pink-500/25 dark:border-pink-400 dark:text-pink-300 transition-colors duration-200 inline-flex items-center gap-1'
                      title='批量新增（一次貼一串）'
                    >
                      <Plus className='w-4 h-4' />
                      <span>批量新增</span>
                    </button>
                  </div>
                </div>
              </section>

              {searchHistory.length > 0 && (
                // 搜索历史
                <section className='mb-12'>
                  <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                    搜索历史
                    <button
                      onClick={() => {
                        clearSearchHistory();
                      }}
                      className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                    >
                      清空
                    </button>
                  </h2>
                  <div className='flex flex-wrap gap-2'>
                    {searchHistory.map((item) => (
                      <div key={item} className='relative group'>
                        <button
                          onClick={() => {
                            setSearchQuery(item);
                            router.push(
                              `/search?q=${encodeURIComponent(item.trim())}`
                            );
                          }}
                          className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                        >
                          {item}
                        </button>
                        <button
                          aria-label='删除搜索历史'
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            deleteSearchHistory(item);
                          }}
                          className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                        >
                          <X className='w-3 h-3' />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
