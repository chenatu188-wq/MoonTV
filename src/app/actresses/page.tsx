'use client';

import { Search as SearchIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import PageLayout from '@/components/PageLayout';

// 跟 search/page.tsx 共用同一個 localStorage key
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

// 一筆 = [name, videoCount]
type PoolEntry = [string, number];

const DEFAULT_LIMIT = 200; // filter 空時顯示前 200 筆（按 videoCount 排序）

function ActressesPageInner() {
  const router = useRouter();
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  // 載入 pool + 個人收藏
  useEffect(() => {
    setFavorites(loadFavorites());
    fetch('/actresses-pool.json')
      .then((r) => r.json())
      .then((data: PoolEntry[]) => {
        setPool(data);
        setLoading(false);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('load actresses pool failed', e);
        setLoading(false);
      });
  }, []);

  // 過濾 + 限制顯示數量
  const { displayed, totalMatched } = useMemo(() => {
    const f = filter.trim();
    const matched = f ? pool.filter(([name]) => name.includes(f)) : pool;
    if (showAll || f) {
      return { displayed: matched, totalMatched: matched.length };
    }
    return {
      displayed: matched.slice(0, DEFAULT_LIMIT),
      totalMatched: matched.length,
    };
  }, [pool, filter, showAll]);

  // 收藏 / 取消收藏
  const toggleFavorite = (name: string) => {
    const next = new Set(favorites);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setFavorites(next);
    saveFavorites(next);
  };

  const handleSearch = (name: string) => {
    router.push(`/search?q=${encodeURIComponent(name)}`);
  };

  return (
    <PageLayout activePath='/actresses'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 mb-10'>
        {/* 標題 */}
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            演員資料庫
          </h1>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            收錄 <strong>{pool.length.toLocaleString()}</strong>{' '}
            位演員，按熱門度排序 · 點名字直接搜尋 · 點 ❤ 加入個人收藏
            {favorites.size > 0 && (
              <span>
                {' '}
                · 你已收藏 <strong>{favorites.size}</strong> 位
              </span>
            )}
          </p>
        </div>

        {/* 過濾框 */}
        <div className='mb-6 max-w-xl'>
          <div className='relative'>
            <SearchIcon className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
            <input
              type='text'
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder='輸入關鍵字過濾（例：三上 / ゆみ / ひな）'
              className='w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
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
        </div>

        {/* 統計列 */}
        <div className='mb-4 flex items-center justify-between text-sm'>
          <div className='text-gray-500 dark:text-gray-400'>
            {loading ? (
              '載入中...'
            ) : filter ? (
              <span>
                符合「{filter}」<strong>{totalMatched}</strong> 位
              </span>
            ) : showAll ? (
              <span>顯示全部 {pool.length.toLocaleString()} 位</span>
            ) : (
              <span>
                顯示前 {DEFAULT_LIMIT} 位（共 {pool.length.toLocaleString()}）
              </span>
            )}
          </div>
          {!filter && !showAll && pool.length > DEFAULT_LIMIT && (
            <button
              onClick={() => setShowAll(true)}
              className='text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 font-medium'
            >
              顯示全部 →
            </button>
          )}
        </div>

        {/* chip 清單 */}
        {loading ? (
          <div className='py-12 text-center'>
            <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500'></div>
          </div>
        ) : displayed.length === 0 ? (
          <div className='text-center text-gray-500 dark:text-gray-400 py-12'>
            {filter ? `沒有符合「${filter}」的演員` : '資料庫是空的'}
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
                  {/* 收藏按鈕 */}
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

        {/* 顯示全部後可以收回 */}
        {!filter && showAll && (
          <div className='mt-6 text-center'>
            <button
              onClick={() => setShowAll(false)}
              className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm'
            >
              收回（只顯示前 {DEFAULT_LIMIT}）
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function ActressesPage() {
  return (
    <Suspense>
      <ActressesPageInner />
    </Suspense>
  );
}
