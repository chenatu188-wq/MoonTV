/* eslint-disable @next/next/no-img-element */
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import type { LatestItem } from '@/lib/browse-latest';
import { SearchResult } from '@/lib/types';

import HScroll from '@/components/HScroll';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
type Category = 'movie' | 'hollywood' | 'duanju' | 'tv' | 'anime3d';
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'movie', label: '電影' },
  { key: 'hollywood', label: '好萊塢' },
  { key: 'duanju', label: '短劇' },
  { key: 'tv', label: '電視劇' },
  { key: 'anime3d', label: '3D動漫' },
];

function isCategory(value: string | null): value is Category {
  return (
    value === 'movie' ||
    value === 'hollywood' ||
    value === 'duanju' ||
    value === 'tv' ||
    value === 'anime3d'
  );
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

type RankTab = 'latest' | 'hot';
interface RankCard {
  key: string;
  title: string;
  poster: string;
  /** 卡片左上角的字：上架日期或名次 */
  badge: string;
  /** 片名下面那一行 */
  note: string;
  href: string;
}

/** Unix 秒 → 台北时间的「10/09」 */
function shortDate(sec: number): string {
  const d = new Date((sec + 8 * 3600) * 1000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
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
  // 動漫分區上方的榜單：最新上架（各來源合併）／熱門（豆瓣近期熱門動畫）
  const [rankTab, setRankTab] = useState<RankTab>('latest');
  const [latestRank, setLatestRank] = useState<RankCard[]>([]);
  const [hotRank, setHotRank] = useState<RankCard[]>([]);

  useEffect(() => {
    if (category !== 'anime3d' || latestRank.length > 0) return;
    fetch('/api/browse/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: LatestItem[] } | null) => {
        if (!d?.items) return;
        setLatestRank(
          d.items.map((it) => ({
            key: `${it.source}-${it.id}`,
            title: it.title,
            poster: it.poster,
            badge: shortDate(it.added),
            note: it.remarks || it.source_name,
            href: `/play?source=${encodeURIComponent(
              it.source
            )}&id=${encodeURIComponent(it.id)}&title=${encodeURIComponent(
              it.title
            )}${it.year ? `&year=${it.year}` : ''}`,
          }))
        );
      })
      .catch(() => undefined); // 榜單抓不到就不顯示，不影響下面的瀏覽
    fetch(
      '/api/douban/categories?kind=tv&category=tv&type=tv_animation&limit=30&start=0'
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            list?: {
              id: string;
              title: string;
              poster: string;
              rate: string;
              year: string;
            }[];
          } | null
        ) => {
          if (!d?.list) return;
          setHotRank(
            d.list.map((it, i) => ({
              key: `douban-${it.id}`,
              title: it.title,
              // 豆瓣圖床擋外站直接載入（回 418），走站內的圖片代理
              poster: it.poster
                ? `/api/image-proxy?url=${encodeURIComponent(it.poster)}`
                : '',
              badge: String(i + 1),
              note: it.rate ? `豆瓣 ${it.rate}` : '暫無評分',
              // 跟首頁的豆瓣卡片一樣：帶片名去播放頁，自動找有這部片的來源
              href: `/play?title=${encodeURIComponent(it.title.trim())}${
                it.year ? `&year=${it.year}` : ''
              }&stype=tv`,
            }))
          );
        }
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const rankCards = rankTab === 'latest' ? latestRank : hotRank;

  // Derived: sources filtered by current category
  const sources = allSources.filter((s) =>
    category === 'duanju'
      ? s.group === '短劇'
      : category === 'hollywood'
      ? s.group === '好萊塢'
      : category === 'movie'
      ? s.group === '電影'
      : category === 'anime3d'
      ? (s.group || '').startsWith('3D動漫')
      : s.group === '電視劇'
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
          {category === 'movie'
            ? '電影瀏覽'
            : category === 'hollywood'
            ? '好萊塢大片'
            : category === 'duanju'
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

        {/* 動漫榜：最新上架／熱門 */}
        {category === 'anime3d' &&
          (latestRank.length > 0 || hotRank.length > 0) && (
            <div>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <h2 className='text-base font-bold text-gray-800 dark:text-white'>
                  動漫榜
                </h2>
                {(
                  [
                    { key: 'latest', name: '最新上架榜', n: latestRank.length },
                    { key: 'hot', name: '熱門榜', n: hotRank.length },
                  ] as { key: RankTab; name: string; n: number }[]
                )
                  .filter((t) => t.n > 0)
                  .map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setRankTab(t.key)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        (rankCards.length > 0 ? rankTab : '') === t.key
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                <span className='text-xs text-gray-500 dark:text-gray-400'>
                  {rankTab === 'latest'
                    ? '各來源最近上架的動漫，點了直接播'
                    : '豆瓣近期熱門動畫，點了自動找片源'}
                </span>
              </div>
              <HScroll
                resetKey={`${rankTab}:${rankCards.length}`}
                arrowTop='4.5rem'
              >
                {rankCards.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => router.push(c.href)}
                    className='group w-28 shrink-0 text-left'
                    data-rank
                  >
                    <div className='relative aspect-[5/7] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                      {c.poster && (
                        <img
                          src={c.poster}
                          alt={c.title}
                          loading='lazy'
                          referrerPolicy='no-referrer'
                          className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                        />
                      )}
                      <span className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                        {c.badge}
                      </span>
                    </div>
                    <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                      {c.title}
                    </div>
                    <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                      {c.note}
                    </div>
                  </button>
                ))}
              </HScroll>
            </div>
          )}

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
