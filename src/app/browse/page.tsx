'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];

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
  const [sources, setSources] = useState<ApiSiteInfo[]>([]);
  const [activeSource, setActiveSource] = useState<string>('');
  const [activeYear, setActiveYear] = useState<string>('');
  const [results, setResults] = useState<BrowseResult[]>([]);
  const [total, setTotal] = useState(0);
  const [pagecount, setPagecount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Suppress unused vars lint for router/searchParams (may be used later)
  void router;
  void searchParams;

  // Load short drama sources from API
  useEffect(() => {
    fetch('/api/search/resources')
      .then((r) => r.json())
      .then((sites: ApiSiteInfo[]) => {
        const djSites = sites.filter((s) => s.group === '短劇');
        setSources(djSites);
        if (djSites.length > 0 && !activeSource)
          setActiveSource(djSites[0].key);
      })
      .catch(() => {
        /* ignore */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBrowse = useCallback(
    async (source: string, year: string, pg: number) => {
      if (!source) return;
      setLoading(true);
      try {
        const yearParam = year ? `&year=${year}` : '';
        const resp = await fetch(
          `/api/browse?source=${source}${yearParam}&page=${pg}`
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
    []
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
          短劇瀏覽
        </h1>

        {/* Source tabs */}
        {sources.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {sources.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setActiveSource(s.key);
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

        {/* Results info */}
        {!loading && total > 0 && (
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            共 {total} 部，第 {page} / {pagecount} 頁
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
            載入中…
          </div>
        ) : results.length === 0 ? (
          <div className='flex justify-center py-16 text-gray-500 dark:text-gray-400'>
            暫無內容
          </div>
        ) : (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'>
            {results.map((item) => (
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
