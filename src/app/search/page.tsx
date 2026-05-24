/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { Search, X } from 'lucide-react';
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

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

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

  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const filteredAggResults = useMemo(() => {
    if (!selectedYear) return aggregatedResults;
    return aggregatedResults.filter(
      ([, group]) => group[0].year === selectedYear
    );
  }, [aggregatedResults, selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set(
      aggregatedResults
        .map(([, g]) => g[0].year)
        .filter((y) => y && y !== 'unknown')
    );
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [aggregatedResults]);

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    // 回显搜索框
    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);
    setSelectedYear(null);

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
              {showResults && availableYears.length > 1 && (
                <div className='flex flex-wrap gap-2 mb-3'>
                  <button
                    onClick={() => {
                      setSelectedYear(null);
                      setSearchPage(1);
                    }}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      !selectedYear
                        ? 'bg-green-500 text-white border-green-500'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:text-gray-300'
                    }`}
                  >
                    全部
                  </button>
                  {availableYears.map((y) => (
                    <button
                      key={y}
                      onClick={() => {
                        setSelectedYear(y);
                        setSearchPage(1);
                      }}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selectedYear === y
                          ? 'bg-green-500 text-white border-green-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:text-gray-300'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
              <div
                key={`search-results-${viewMode}`}
                className='justify-start grid grid-cols-2 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(14rem,_1fr))] sm:gap-x-8'
              >
                {viewMode === 'agg'
                  ? filteredAggResults
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
                    ? filteredAggResults.length
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
