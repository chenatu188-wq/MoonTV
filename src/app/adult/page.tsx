/* eslint-disable @next/next/no-img-element */
'use client';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  type SavedPick,
  BUILTIN_PICKS,
  loadPicks,
  pickKey,
  removePick,
  savePicks,
} from '@/lib/adult-picks';
import { takeOverClick } from '@/lib/link-click';
import { SearchResult } from '@/lib/types';

import ActressesPanel from '@/components/ActressesPanel';
import PageLayout from '@/components/PageLayout';
import SourceRankStrip, { type RankItem } from '@/components/SourceRankStrip';
import StudioQuickSearchPanel from '@/components/StudioQuickSearchPanel';
import VideoCard from '@/components/VideoCard';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
type Tab = 'browse' | 'search' | 'actresses' | 'picks';

const SESSION_KEY = 'adult_unlocked';
/** 各片源一列的榜單，一開始顯示幾個片源 */
const SOURCE_ROWS_FIRST = 5;

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!input || loading) return;
    setLoading(true);
    setError(false);
    try {
      const resp = await fetch('/api/adult/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input }),
      });
      const { ok } = await resp.json();
      if (ok) {
        sessionStorage.setItem(SESSION_KEY, '1');
        onUnlock();
      } else {
        setError(true);
        setInput('');
        inputRef.current?.focus();
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black'>
      <div className='bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-5'>
        <div className='text-4xl'>🔞</div>
        <div className='text-center'>
          <p className='text-lg font-bold text-gray-800 dark:text-gray-100'>
            彩虹頻道
          </p>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            請輸入密碼以繼續
          </p>
        </div>
        <input
          ref={inputRef}
          type='password'
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder='密碼'
          className={`w-full px-4 py-2.5 rounded-lg border text-center text-sm tracking-widest focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100 ${
            error
              ? 'border-rose-500 focus:ring-rose-400 placeholder-rose-300'
              : 'border-gray-300 dark:border-gray-600 focus:ring-rose-400'
          }`}
        />
        {error && (
          <p className='text-xs text-rose-500 -mt-2'>密碼錯誤，請重試</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !input}
          className='w-full py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-50 transition-colors'
        >
          {loading ? '驗證中…' : '進入'}
        </button>
      </div>
    </div>
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

function AdultClient() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>('browse');

  // Check sessionStorage on mount
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') setUnlocked(true);
  }, []);

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
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeRegion, setActiveRegion] = useState<string>('all');

  // 精選影片：在播放頁存下來的那些。每次切到這個分頁重讀一次（可能剛從播放頁加了新的回來）
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);
  useEffect(() => {
    if (tab === 'picks') setSavedPicks(loadPicks());
  }, [tab]);

  const pickHref = (p: { source: string; id: string; title: string }) =>
    `/play?source=${encodeURIComponent(p.source)}&id=${encodeURIComponent(
      p.id
    )}&title=${encodeURIComponent(p.title)}&stitle=${encodeURIComponent(
      p.title
    )}&adult=1`;

  const playRank = useCallback(
    (it: RankItem) =>
      `/play?source=${encodeURIComponent(it.source)}&id=${encodeURIComponent(
        it.id
      )}&title=${encodeURIComponent(it.title)}&stitle=${encodeURIComponent(
        it.title
      )}&adult=1`,
    []
  );

  // 各片源一列的榜單先顯示幾個；換地區就收回來
  const [sourceRows, setSourceRows] = useState(SOURCE_ROWS_FIRST);
  const browseRef = useRef<HTMLDivElement>(null);
  useEffect(() => setSourceRows(SOURCE_ROWS_FIRST), [activeRegion]);

  const REGIONS = [
    { key: 'all', label: '全部' },
    { key: '🔞', label: '🇯🇵 日本' },
    { key: '🔞韓國', label: '🇰🇷 韓國' },
    { key: '🔞歐美', label: '🇺🇸 歐美' },
  ];

  const adultSources = allSources.filter((s) => s.group?.startsWith('🔞'));

  const regionedSources =
    activeRegion === 'all'
      ? adultSources
      : adultSources.filter((s) => s.group === activeRegion);

  useEffect(() => {
    fetch('/api/adult/resources')
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

  // 切換分區時，自動選第一個該區的片源
  useEffect(() => {
    if (regionedSources.length > 0) {
      setActiveSource(regionedSources[0].key);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegion]);

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

  const handleSearch = useCallback(
    async (directQuery?: string) => {
      const q = (directQuery ?? searchInput).trim();
      if (!q) return;
      if (directQuery !== undefined) setSearchInput(directQuery);
      setLastSearchedQuery(q);
      setTab('search');
      setSearchLoading(true);
      setSearchDone(false);
      try {
        const resp = await fetch(
          `/api/adult/search?q=${encodeURIComponent(q)}`
        );
        const data = await resp.json();
        const results: SearchResult[] = data.results || [];
        // 演員名稱出現在標題的靠前
        const qLower = q.toLowerCase();
        results.sort((a, b) => {
          const aHit = a.title.toLowerCase().includes(qLower) ? 1 : 0;
          const bHit = b.title.toLowerCase().includes(qLower) ? 1 : 0;
          return bHit - aHit;
        });
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
        setSearchDone(true);
      }
    },
    [searchInput]
  );

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
      {!unlocked && <PasswordGate onUnlock={() => setUnlocked(true)} />}
      <div className='p-4 space-y-4'>
        <h1 className='text-xl font-bold text-gray-800 dark:text-white'>
          🌈 彩虹頻道
        </h1>

        {/* Tab switcher */}
        <div className='flex gap-2'>
          {(
            [
              { key: 'browse', label: '瀏覽' },
              { key: 'search', label: '搜索' },
              { key: 'actresses', label: '演員' },
              { key: 'picks', label: '精選影片' },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                window.scrollTo({ top: 0 });
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-rose-100 dark:hover:bg-rose-900/30'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Browse tab ── */}
        {tab === 'browse' && (
          <>
            {/* Region tabs */}
            <div className='flex flex-wrap gap-2'>
              {REGIONS.filter(
                (r) =>
                  r.key === 'all' || adultSources.some((s) => s.group === r.key)
              ).map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setActiveRegion(r.key);
                    setFilterQuery('');
                    window.scrollTo({ top: 0 });
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeRegion === r.key
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-rose-100 dark:hover:bg-rose-900/30'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 地區榜單 */}
            <SourceRankStrip
              title='排行榜'
              query={`region=${encodeURIComponent(activeRegion)}`}
              enabled={unlocked}
              latestHint='各來源最近上架的，點了直接播'
              playHref={playRank}
            />

            {/* 各片源一列：最新上架／熱門。捲到才載入，先顯示幾個再按鈕展開 */}
            {regionedSources.slice(0, sourceRows).map((src) => (
              <SourceRankStrip
                key={src.key}
                title={src.name}
                query={`source=${encodeURIComponent(src.key)}`}
                enabled={unlocked}
                latestHint='最近上架的，點了直接播'
                showSource={false}
                lazy
                onMore={() => {
                  setActiveSource(src.key);
                  setFilterQuery('');
                  browseRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                playHref={playRank}
              />
            ))}
            {sourceRows < regionedSources.length && (
              <button
                onClick={() => setSourceRows((n) => n + 8)}
                className='w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              >
                顯示更多片源（還有 {regionedSources.length - sourceRows} 個）
              </button>
            )}

            <div ref={browseRef} className='scroll-mt-20' />
            {/* Source tabs */}
            {regionedSources.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {regionedSources.map((s) => (
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
                    <VideoCard
                      from='search'
                      items={[toSearchResult(item)]}
                      query={item.title}
                      adultSearch
                    />
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
                onClick={() => handleSearch()}
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

            {/* Quick search panel（無搜索結果時顯示） */}
            {!searchLoading && !searchDone && (
              <StudioQuickSearchPanel onSearch={(q) => handleSearch(q)} />
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
                    <VideoCard
                      from='search'
                      items={[item]}
                      query={lastSearchedQuery}
                      adultSearch
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Actresses tab ── */}
        {tab === 'actresses' && (
          <ActressesPanel onSearch={(name) => handleSearch(name)} />
        )}

        {/* ── 精選影片 tab ── */}
        {tab === 'picks' && (
          <div className='space-y-6' data-picks>
            {/* 在播放頁按「加到精選影片」存下來的：點了直接播那個片源 */}
            <div>
              <h2 className='mb-2 text-base font-bold text-gray-800 dark:text-white'>
                我加入的
                <span className='ml-2 text-xs font-normal text-gray-500 dark:text-gray-400'>
                  {savedPicks.length > 0
                    ? `${savedPicks.length} 部 · 只存在這台裝置`
                    : '看片時在片名旁按「加到精選影片」，就會出現在這裡'}
                </span>
              </h2>
              {savedPicks.length > 0 && (
                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'>
                  {savedPicks.map((p) => (
                    <div key={pickKey(p)} className='group relative'>
                      <a
                        href={pickHref(p)}
                        onClick={(e) =>
                          takeOverClick(e) && router.push(pickHref(p))
                        }
                        className='block w-full text-left'
                        data-saved-pick
                      >
                        <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                          {p.poster && (
                            <img
                              src={p.poster}
                              alt={p.title}
                              loading='lazy'
                              referrerPolicy='no-referrer'
                              className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                            />
                          )}
                        </div>
                        <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                          {p.title}
                        </div>
                        <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                          {p.sourceName}
                        </div>
                      </a>
                      <button
                        aria-label='從精選影片拿掉'
                        title='從精選影片拿掉'
                        onClick={() => {
                          const next = removePick(savedPicks, p);
                          setSavedPicks(next);
                          savePicks(next);
                        }}
                        className='absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-sm leading-none text-white hover:bg-red-600'
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 內建的番號清單：點了用番號去各片源搜 */}
            <div>
              <h2 className='mb-2 text-base font-bold text-gray-800 dark:text-white'>
                精選番號
                <span className='ml-2 text-xs font-normal text-gray-500 dark:text-gray-400'>
                  {BUILTIN_PICKS.length} 部 · 點了用番號到各片源搜尋
                </span>
              </h2>
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'>
                {BUILTIN_PICKS.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => {
                      handleSearch(p.code);
                      window.scrollTo({ top: 0 });
                    }}
                    className='rounded-lg bg-gray-100 p-3 text-left transition-colors hover:bg-rose-100 dark:bg-gray-800 dark:hover:bg-rose-900/30'
                    data-code-pick
                  >
                    <div className='text-sm font-bold text-rose-500'>
                      {p.code}
                    </div>
                    <div className='mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200'>
                      {p.actress}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
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
