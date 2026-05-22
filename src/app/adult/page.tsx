'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
type Tab = 'browse' | 'search';

interface BrowseResult {
  id: string;
  title: string;
  poster: string;
  year: string;
  remarks: string;
  score?: number;
  source: string;
  source_name: string;
  episodes: string[];
}

interface ApiSiteInfo {
  key: string;
  name: string;
  group?: string;
}

function AdultClient() {
  const [tab, setTab] = useState<Tab>('browse');

  // ── Browse state ──
  const [allSources, setAllSources] = useState<ApiSiteInfo[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [activeYear, setActiveYear] = useState<string>('');
  const [browseResults, setBrowseResults] = useState<BrowseResult[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [pagecount, setPagecount] = useState(1);
  const [page, setPage] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);

  // ── Search state ──
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const adultSources = allSources.filter((s) => s.group === '🔞');

  useEffect(() => {
    fetch('/api/search/resources')
      .then((r) => r.json())
      .then((sites: ApiSiteInfo[]) => setAllSources(sites))
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    if (adultSources.length > 0 && !activeSource) {
      setActiveSource(adultSources[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSources.length]);

  const fetchBrowse = useCallback(
    async (source: string, year: string, pg: number) => {
      if (!source) return;
      setBrowseLoading(true);
      try {
        const yearParam = year ? `&year=${year}` : '';
        const resp = await fetch(
          `/api/browse?source=${source}${yearParam}&page=${pg}&category=adult`
        );
        if (!resp.ok) throw new Error('fetch failed');
        const data = await resp.json();
        setBrowseResults(data.results || []);
        setTotal(data.total || 0);
        setPagecount(data.pagecount || 1);
      } catch {
        setBrowseResults([]);
      } finally {
        setBrowseLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeSource && tab === 'browse') {
      setPage(1);
      fetchBrowse(activeSource, activeYear, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource, activeYear, tab]);

  useEffect(() => {
    if (activeSource && tab === 'browse')
      fetchBrowse(activeSource, activeYear, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredBrowse = filterQuery.trim()
    ? browseResults.filter((r) =>
        r.title.toLowerCase().includes(filterQuery.trim().toLowerCase())
      )
    : browseResults;

  const handleSearch = useCallback(async () => {
    const q = searchInput.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const resp = await fetch(`/api/adult/search?q=${encodeURIComponent(q)}`);
      const data = await resp.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
      setSearchDone(true);
    }
  }, [searchInput]);

  const toSearchResult = (item: BrowseResult): SearchResult => ({
    id: item.id,
    title: item.title,
    poster: item.poster,
    year: item.year,
    episodes: item.episodes,
    source: item.source,
    source_name: item.source_name,
    score: item.score,
    desc: item.remarks,
  });

  const btnBase = 'px-3 py-1 rounded-full text-sm border transition-colors';
  const btnActive = 'bg-rose-500 text-white border-rose-500';
  const btnInactive =
    'border-gray-300 dark:border-gray-600 hover:border-rose-400 dark:text-gray-300';

  return (
    <PageLayout>
      <div className='p-4 space-y-4'>
        <h1 className='text-xl font-bold text-gray-800 dark:text-white'>
          🔞 18禁專區
        </h1>

        {/* Tab switcher */}
        <div className='flex gap-2'>
          {(['browse', 'search'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                window.scrollTo({ top: 0 });
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-rose-100 dark:hover:bg-rose-900/30'
              }`}
            >
              {t === 'browse' ? '瀏覽' : '搜索'}
            </button>
          ))}
        </div>

        {/* ── Browse tab ── */}
        {tab === 'browse' && (
          <>
            {/* Source tabs */}
            {adultSources.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {adultSources.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setActiveSource(s.key);
                      setFilterQuery('');
                      window.scrollTo({ top: 0 });
                    }}
                    className={`${btnBase} ${
                      activeSource === s.key ? btnActive : btnInactive
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Year filter */}
            <div className='flex flex-wrap gap-2'>
              <button
                onClick={() => {
                  setActiveYear('');
                  setPage(1);
                }}
                className={`${btnBase} ${
                  activeYear === '' ? btnActive : btnInactive
                }`}
              >
                全部
              </button>
              {YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setActiveYear(y);
                    setPage(1);
                  }}
                  className={`${btnBase} ${
                    activeYear === y ? btnActive : btnInactive
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Page filter */}
            {browseResults.length > 0 && (
              <div className='relative'>
                <input
                  type='text'
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder='篩選本頁結果…'
                  className='w-full sm:w-72 px-3 py-1.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-400'
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery('')}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-base leading-none'
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Results info */}
            {!browseLoading && total > 0 && (
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                共 {total} 部，第 {page} / {pagecount} 頁
                {filterQuery &&
                  filteredBrowse.length !== browseResults.length && (
                    <span className='ml-2 text-rose-500'>
                      篩選出 {filteredBrowse.length} 筆
                    </span>
                  )}
              </p>
            )}

            {/* Grid */}
            {browseLoading ? (
              <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
                載入中…
              </div>
            ) : filteredBrowse.length === 0 ? (
              <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
                {filterQuery ? '無符合結果' : '暫無內容'}
              </div>
            ) : (
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'>
                {filteredBrowse.map((item) => (
                  <div key={`${item.source}-${item.id}`} className='w-full'>
                    <VideoCard from='search' items={[toSearchResult(item)]} />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagecount > 1 && (
              <div className='flex flex-wrap items-center justify-center gap-2 mt-4'>
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => p - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className='px-3 py-1 rounded text-sm bg-gray-200 hover:bg-rose-500/30 disabled:opacity-40 dark:bg-gray-700'
                >
                  ← 上一頁
                </button>
                <span className='text-sm text-gray-500 dark:text-gray-400'>
                  {page} / {pagecount}
                </span>
                <button
                  disabled={page >= pagecount}
                  onClick={() => {
                    setPage((p) => p + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className='px-3 py-1 rounded text-sm bg-gray-200 hover:bg-rose-500/30 disabled:opacity-40 dark:bg-gray-700'
                >
                  下一頁 →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Search tab ── */}
        {tab === 'search' && (
          <>
            {/* Search input */}
            <div className='flex gap-2'>
              <input
                ref={inputRef}
                type='text'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder='輸入片名搜索所有18禁片源…'
                className='flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-400'
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading || !searchInput.trim()}
                className='px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-50 transition-colors'
              >
                {searchLoading ? '搜索中…' : '搜索'}
              </button>
            </div>

            {/* Search results info */}
            {searchDone && !searchLoading && (
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                找到 {searchResults.length} 筆結果
              </p>
            )}

            {/* Search results grid */}
            {searchLoading ? (
              <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
                搜索中…
              </div>
            ) : searchDone && searchResults.length === 0 ? (
              <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
                無結果
              </div>
            ) : (
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'>
                {searchResults.map((item) => (
                  <div key={`${item.source}-${item.id}`} className='w-full'>
                    <VideoCard from='search' items={[item]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default function AdultPage() {
  return (
    <Suspense>
      <AdultClient />
    </Suspense>
  );
}
