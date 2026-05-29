'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
type Category = 'duanju' | 'tv' | 'anime3d';
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'duanju', label: '短劇' },
  { key: 'tv', label: '電視劇' },
  { key: 'anime3d', label: '3D動漫' },
];

function isCategory(value: string | null): value is Category {
  return value === 'duanju' || value === 'tv' || value === 'anime3d';
}

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

function BrowseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<Category>(() => {
    const categoryParam = searchParams.get('category');
    return isCategory(categoryParam) ? categoryParam : 'duanju';
  });
  const [allSources, setAllSources] = useState<ApiSiteInfo[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [activeYear, setActiveYear] = useState<string>('');
  const [results, setResults] = useState<BrowseResult[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [pagecount, setPagecount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Derived: sources filtered by current category
  const sources = allSources.filter((s) =>
    category === 'duanju'
      ? s.group === '短劇'
      : category === 'anime3d'
      ? (s.group || '').startsWith('3D動漫')
      : s.group !== '短劇' &&
        s.group !== '🔞' &&
        !(s.group || '').startsWith('3D動漫')
  );

  // Load all sources once
  useEffect(() => {
    fetch('/api/search/resources')
      .then((r) => r.json())
      .then((sites: ApiSiteInfo[]) => {
        setAllSources(sites);
      })
      .catch(() => {
        /* ignore */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When category or source list changes, reset to first source
  useEffect(() => {
    if (sources.length > 0) {
      setActiveSource(sources[0].key);
      setPage(1);
    } else {
      setActiveSource('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, allSources.length]);

  const fetchBrowse = useCallback(
    async (source: string, year: string, pg: number) => {
      if (!source) return;
      setLoading(true);
      try {
        const yearParam = year ? `&year=${year}` : '';
        const resp = await fetch(
          `/api/browse?source=${source}${yearParam}&page=${pg}&category=${category}`
        );
        if (!resp.ok) throw new Error('fetch failed');
        const data = await resp.json();
        setResults(data.results || []);
        setTotal(data.total || 0);
        setPagecount(data.pagecount || 1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  useEffect(() => {
    if (activeSource) {
      setPage(1);
      fetchBrowse(activeSource, activeYear, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource, activeYear]);

  useEffect(() => {
    if (activeSource) fetchBrowse(activeSource, activeYear, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredResults = filterQuery.trim()
    ? results.filter((r) =>
        r.title.toLowerCase().includes(filterQuery.trim().toLowerCase())
      )
    : results;

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
  const btnActive = 'bg-green-500 text-white border-green-500';
  const btnInactive =
    'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:text-gray-300';

  return (
    <PageLayout>
      <div className='p-4 space-y-4'>
        <h1 className='text-xl font-bold text-gray-800 dark:text-white'>
          {category === 'duanju'
            ? '短劇瀏覽'
            : category === 'anime3d'
            ? '3D動漫瀏覽'
            : '電視劇瀏覽'}
        </h1>

        {/* Category tabs */}
        <div className='flex gap-2'>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setCategory(cat.key);
                setActiveYear('');
                setFilterQuery('');
                setResults([]);
                router.replace(`/browse?category=${cat.key}`);
                window.scrollTo({ top: 0 });
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                category === cat.key
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Source tabs */}
        {sources.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {sources.map((s) => (
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
            onClick={() => setActiveYear('')}
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

        {/* Page filter search */}
        {results.length > 0 && (
          <div className='relative'>
            <input
              type='text'
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder='篩選本頁結果…'
              className='w-full sm:w-72 px-3 py-1.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400'
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
        {!loading && total > 0 && (
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            共 {total} 部，第 {page} / {pagecount} 頁
            {filterQuery && filteredResults.length !== results.length && (
              <span className='ml-2 text-green-600 dark:text-green-400'>
                篩選出 {filteredResults.length} 筆
              </span>
            )}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
            載入中…
          </div>
        ) : filteredResults.length === 0 ? (
          <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
            {filterQuery ? '無符合結果' : '暫無內容'}
          </div>
        ) : (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'>
            {filteredResults.map((item) => (
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
              className='px-3 py-1 rounded text-sm bg-gray-200 hover:bg-green-500/30 disabled:opacity-40 dark:bg-gray-700'
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
              className='px-3 py-1 rounded text-sm bg-gray-200 hover:bg-green-500/30 disabled:opacity-40 dark:bg-gray-700'
            >
              下一頁 →
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseClient />
    </Suspense>
  );
}
