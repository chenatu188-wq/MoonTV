'use client';

import { Search as SearchIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const ACTRESSES_KEY = 'moontv_actresses_v1';

const loadFavorites = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ACTRESSES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
};

const saveFavorites = (set: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTRESSES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
};

type PoolEntry = [string, number];
const PAGE_SIZE = 200;

interface ActressesPanelProps {
  onSearch?: (name: string) => void;
}

export default function ActressesPanel({ onSearch }: ActressesPanelProps = {}) {
  const router = useRouter();
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFavOnly, setShowFavOnly] = useState(false);

  useEffect(() => {
    setFavorites(loadFavorites());
    fetch('/actresses-pool.json')
      .then((r) => r.json())
      .then((data: PoolEntry[]) => {
        setPool(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, showFavOnly]);

  const { displayed, totalMatched, totalPages, currentPage } = useMemo(() => {
    const f = filter.trim();
    let matched: PoolEntry[] = [];
    try {
      const base = showFavOnly
        ? pool.filter((entry) => favorites.has(entry?.[0]))
        : pool;
      matched = f
        ? base.filter((entry) => {
            const name = entry?.[0];
            return typeof name === 'string' && name.includes(f);
          })
        : base;
      if (!showFavOnly && favorites.size > 0) {
        const favList: PoolEntry[] = [];
        const restList: PoolEntry[] = [];
        for (const entry of matched) {
          if (favorites.has(entry?.[0])) favList.push(entry);
          else restList.push(entry);
        }
        matched = [...favList, ...restList];
      }
    } catch {
      matched = [];
    }
    const tp = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), tp);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
      displayed: matched.slice(start, start + PAGE_SIZE),
      totalMatched: matched.length,
      totalPages: tp,
      currentPage: safePage,
    };
  }, [pool, filter, page, showFavOnly, favorites]);

  const pageNumbers = useMemo<(number | 'gap')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const result: (number | 'gap')[] = [1];
    if (currentPage > 3) result.push('gap');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) result.push(i);
    if (currentPage < totalPages - 2) result.push('gap');
    result.push(totalPages);
    return result;
  }, [currentPage, totalPages]);

  const toggleFavorite = (name: string) => {
    const next = new Set(favorites);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setFavorites(next);
    saveFavorites(next);
  };

  const handleSearch = (name: string) => {
    if (onSearch) {
      onSearch(name);
    } else {
      router.push(`/search?q=${encodeURIComponent(name)}`);
    }
  };

  return (
    <div className='px-0 sm:px-6 py-2 mb-10'>
      {/* 標題 */}
      <div className='mb-4'>
        <p className='text-sm text-gray-500 dark:text-gray-400'>
          收錄 <strong>{pool.length.toLocaleString()}</strong> 位演員，收藏優先
          · 其餘按熱門度排序 · 點名字直接搜尋 · 點 ❤ 加入個人收藏
          {favorites.size > 0 && (
            <span>
              {' '}
              · 你已收藏 <strong>{favorites.size}</strong> 位
            </span>
          )}
        </p>
      </div>

      {/* 過濾框 + 只看收藏 */}
      <div className='mb-4 flex gap-3 items-center max-w-xl'>
        <div className='relative flex-1'>
          <SearchIcon className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
          <input
            type='text'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder='輸入關鍵字過濾（例：三上 / ゆみ / ひな）'
            className='w-full h-10 rounded-lg bg-gray-50/80 py-2 pl-10 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              aria-label='清除過濾'
              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>
        {favorites.size > 0 && (
          <button
            onClick={() => setShowFavOnly((v) => !v)}
            className={`shrink-0 flex items-center gap-1.5 px-4 h-10 rounded-lg text-sm font-medium transition-colors ${
              showFavOnly
                ? 'bg-rose-500 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-rose-100 hover:text-rose-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-rose-900/30 dark:hover:text-rose-300'
            }`}
          >
            ❤ 我的收藏{showFavOnly ? `（${favorites.size}）` : ''}
          </button>
        )}
      </div>

      {/* 統計列 */}
      <div className='mb-3 text-sm text-gray-500 dark:text-gray-400'>
        {loading ? (
          '載入中...'
        ) : filter ? (
          <span>
            符合「{filter}」<strong>{totalMatched}</strong> 位 · 第{' '}
            {currentPage}/{totalPages} 頁
          </span>
        ) : (
          <span>
            共 {pool.length.toLocaleString()} 位 · 第 {currentPage}/{totalPages}{' '}
            頁 ·{' '}
            {favorites.size > 0 ? '收藏優先 · 其餘按熱門度' : '按熱門度排序'}
          </span>
        )}
      </div>

      {/* chip 清單 */}
      {loading ? (
        <div className='py-12 text-center'>
          <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500'></div>
        </div>
      ) : displayed.length === 0 ? (
        <div className='text-center text-gray-500 dark:text-gray-400 py-12'>
          {showFavOnly
            ? '還沒有收藏任何演員，點 ♡ 加入收藏'
            : filter
            ? `沒有符合「${filter}」的演員`
            : '資料庫是空的'}
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          {displayed.map(([name]) => {
            const isFav = favorites.has(name);
            return (
              <div key={name} className='relative group'>
                <button
                  onClick={() => handleSearch(name)}
                  className={`pl-3 pr-9 py-2 rounded-full text-sm transition-colors duration-200 ${
                    isFav
                      ? 'bg-pink-500/25 text-pink-700 dark:bg-pink-500/30 dark:text-pink-200 ring-1 ring-pink-400'
                      : 'bg-pink-500/10 text-gray-700 hover:bg-pink-500/20 dark:bg-pink-500/15 dark:text-gray-200 dark:hover:bg-pink-500/25'
                  }`}
                >
                  <span className='font-semibold text-pink-700 dark:text-pink-400'>
                    {name}
                  </span>
                </button>
                <button
                  aria-label={isFav ? `取消收藏 ${name}` : `收藏 ${name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleFavorite(name);
                  }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-base transition-colors ${
                    isFav
                      ? 'text-pink-600 hover:text-gray-400 dark:text-pink-300'
                      : 'text-gray-300 hover:text-pink-500 dark:text-gray-600 dark:hover:text-pink-400'
                  }`}
                  title={isFav ? '取消收藏' : '加入個人收藏'}
                >
                  {isFav ? '❤' : '♡'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 分頁控制 */}
      {!loading && totalPages > 1 && (
        <div className='mt-6 flex items-center justify-center gap-1 flex-wrap'>
          <button
            onClick={() => {
              setPage(Math.max(1, currentPage - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === 1}
            className='px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 transition-colors'
          >
            上一頁
          </button>
          {pageNumbers.map((p, idx) =>
            p === 'gap' ? (
              <span key={`gap-${idx}`} className='px-2 text-gray-400'>
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => {
                  setPage(p);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`min-w-[40px] px-3 py-2 rounded-lg text-sm transition-colors ${
                  p === currentPage
                    ? 'bg-rose-500 text-white font-bold'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => {
              setPage(Math.min(totalPages, currentPage + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === totalPages}
            className='px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 transition-colors'
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
