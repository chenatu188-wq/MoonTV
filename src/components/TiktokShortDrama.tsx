/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';

import { shortDramaUrl } from '@/lib/tiktok-shortdrama';

import HScroll from '@/components/HScroll';

import type { ShortDramaList } from '@/app/api/tiktok-manju/shortdrama/route';

function formatWatched(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)} 亿次观看`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万次观看`;
  return n > 0 ? `${n} 次观看` : '';
}

/**
 * TikTok 短剧专区的片单。这些剧站内播不了（要登入 TikTok），
 * 所以每一格都是连结，另开 TikTok 的短剧页从第 1 集看起。
 */
export default function TiktokShortDrama() {
  const [lists, setLists] = useState<ShortDramaList[] | null>(null);
  const [tab, setTab] = useState('');

  useEffect(() => {
    fetch('/api/tiktok-manju/shortdrama')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.lists?.length && setLists(d.lists))
      .catch(() => undefined); // 抓不到就不显示这一块
  }, []);

  if (!lists) return null;
  const list = lists.find((l) => l.key === tab) ?? lists[0];

  return (
    <div className='mb-6'>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          TikTok 短剧
        </h2>
        {lists.map((l) => (
          <button
            key={l.key}
            onClick={() => setTab(l.key)}
            className={`px-3 py-1 rounded-full text-sm ${
              list.key === l.key
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {l.name}
          </button>
        ))}
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          点了另开 TikTok 短剧页，要登入 TikTok 才能看
        </span>
      </div>
      <HScroll resetKey={`${list.key}:${list.items.length}`} arrowTop='4.5rem'>
        {list.items.map((d, i) => (
          <a
            key={d.id}
            href={shortDramaUrl(d.id)}
            target='_blank'
            rel='noopener noreferrer'
            title={d.description}
            className='group w-28 shrink-0 text-left'
            data-shortdrama
          >
            <div className='relative aspect-[5/7] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
              {d.cover && (
                <img
                  src={d.cover}
                  alt={d.name}
                  loading='lazy'
                  referrerPolicy='no-referrer'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
              )}
              <span className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                {i + 1}
              </span>
              {d.episodes > 0 && (
                <span className='absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white'>
                  {d.episodes} 集
                </span>
              )}
            </div>
            <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
              {d.name}
            </div>
            <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
              {formatWatched(d.watched)}
            </div>
          </a>
        ))}
      </HScroll>
    </div>
  );
}
