/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';

import HScroll from '@/components/HScroll';

export interface RankItem {
  id: string;
  title: string;
  poster: string;
  source: string;
  source_name: string;
  /** 上架時間，Unix 秒 */
  added: number;
  hits?: number;
}

/** Unix 秒 → 台北時間的「10/09」 */
function shortDate(sec: number): string {
  if (!sec) return '';
  const d = new Date((sec + 8 * 3600) * 1000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

/**
 * 彩虹頻道的榜單：最新上架榜／熱門榜（熱門只在點擊數可信時才有）。
 * query 決定看哪個範圍：region=地區 或 source=單一片源。
 * 榜單抓不到或是空的就整塊不顯示，不影響下面的瀏覽。
 */
export default function AdultRankStrip({
  title,
  query,
  enabled,
  latestHint,
  showSource = true,
  onPlay,
}: {
  title: string;
  query: string;
  enabled: boolean;
  latestHint: string;
  /** 單一片源的榜單每格都是同一個來源，不用再寫 */
  showSource?: boolean;
  onPlay: (it: RankItem) => void;
}) {
  const [tab, setTab] = useState<'latest' | 'hot'>('latest');
  const [ranks, setRanks] = useState<{
    latest: RankItem[];
    hot: RankItem[];
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stale = false; // 切到別的範圍後，舊範圍晚到的結果不要蓋上來
    setRanks(null);
    setTab('latest');
    fetch(`/api/adult/latest?${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!stale && d?.latest)
          setRanks({ latest: d.latest, hot: d.hot ?? [] });
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [query, enabled]);

  if (!ranks || ranks.latest.length === 0) return null;
  const items = ranks[tab];

  return (
    <div data-rank-strip={query}>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-800 dark:text-white'>
          {title}
        </h2>
        {(
          [
            { key: 'latest', name: '最新上架榜', n: ranks.latest.length },
            { key: 'hot', name: '熱門榜', n: ranks.hot.length },
          ] as { key: 'latest' | 'hot'; name: string; n: number }[]
        )
          .filter((t) => t.n > 0)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-full text-sm ${
                tab === t.key
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t.name}
            </button>
          ))}
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          {tab === 'latest' ? latestHint : '依本月點擊數排名，點了直接播'}
        </span>
      </div>
      <HScroll resetKey={`${query}:${tab}:${items.length}`} arrowTop='2.75rem'>
        {items.map((it, i) => (
          <button
            key={`${it.source}-${it.id}`}
            onClick={() => onPlay(it)}
            className='group w-44 shrink-0 text-left'
            data-rank
          >
            <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
              {it.poster && (
                <img
                  src={it.poster}
                  alt={it.title}
                  loading='lazy'
                  referrerPolicy='no-referrer'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
              )}
              <span className='absolute left-0 top-0 rounded-br-lg bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                {tab === 'latest' ? shortDate(it.added) : i + 1}
              </span>
            </div>
            <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
              {it.title}
            </div>
            <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
              {[
                tab === 'hot' && it.hits ? `${it.hits} 次點擊` : '',
                showSource ? it.source_name : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </button>
        ))}
      </HScroll>
    </div>
  );
}
