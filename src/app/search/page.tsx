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

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 片商代號標籤（可由阿公自行新增 / 刪除）
  const [studioTags, setStudioTags] =
    useState<StudioTag[]>(STUDIO_TAGS_DEFAULT);

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

      // 年份排序
      if (a[1][0].year === b[1][0].year) {
        return a[0].localeCompare(b[0]);
      } else {
        // 处理 unknown 的情况
        const aYear = a[1][0].year;
        const bYear = b[1][0].year;

        if (aYear === 'unknown' && bYear === 'unknown') {
          return 0;
        } else if (aYear === 'unknown') {
          return 1; // a 排在后面
        } else if (bYear === 'unknown') {
          return -1; // b 排在后面
        } else {
          // 都是数字年份，按数字大小排序（大的在前面）
          return aYear > bYear ? -1 : 1;
        }
      }
    });
  }, [searchResults]);

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

    // 初始加载片商代號（從 localStorage 讀；首次無資料時用預設）
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

          // 如果都匹配或都不匹配，则按原来的逻辑排序
          if (a.year === b.year) {
            return a.title.localeCompare(b.title);
          } else {
            // 处理 unknown 的情况
            if (a.year === 'unknown' && b.year === 'unknown') {
              return 0;
            } else if (a.year === 'unknown') {
              return 1; // a 排在后面
            } else if (b.year === 'unknown') {
              return -1; // b 排在后面
            } else {
              // 都是数字年份，按数字大小排序（大的在前面）
              return parseInt(a.year) > parseInt(b.year) ? -1 : 1;
            }
          }
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
  const handleResetStudioTags = () => {
    if (
      !window.confirm(
        `確定要還原預設清單嗎？\n（你目前自訂的代號會被覆蓋，預設 19 個會回來）`
      )
    )
      return;
    setStudioTags(STUDIO_TAGS_DEFAULT);
    saveStudioTags(STUDIO_TAGS_DEFAULT);
  };

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
                className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
              >
                {viewMode === 'agg'
                  ? aggregatedResults.map(([mapKey, group]) => {
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
                  : searchResults.map((item) => (
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
                  {studioTags.map((tag) => (
                    <div key={tag.code} className='relative group'>
                      <button
                        onClick={() => {
                          setSearchQuery(tag.code);
                          router.push(
                            `/search?q=${encodeURIComponent(tag.code)}`
                          );
                        }}
                        className='px-3 py-2 bg-green-500/10 hover:bg-green-500/20 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-green-500/15 dark:hover:bg-green-500/25 dark:text-gray-200 flex items-center gap-2'
                      >
                        <span className='font-semibold text-green-700 dark:text-green-400'>
                          {tag.code}
                        </span>
                        <span className='text-xs text-gray-500 dark:text-gray-400'>
                          {tag.style}
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
                  ))}
                  {/* 新增代號 */}
                  <button
                    onClick={handleAddStudioTag}
                    className='px-3 py-2 bg-gray-500/10 hover:bg-green-500/20 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-full text-sm text-gray-500 hover:text-green-700 dark:bg-gray-700/30 dark:hover:bg-green-500/15 dark:border-gray-600 dark:hover:border-green-400 dark:text-gray-400 dark:hover:text-green-400 transition-colors duration-200 flex items-center gap-1'
                    title='新增片商代號'
                  >
                    <Plus className='w-4 h-4' />
                    <span>新增代號</span>
                  </button>
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
