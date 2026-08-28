/* eslint-disable @next/next/no-img-element */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import PageLayout from '@/components/PageLayout';

import type { AiManjuVideo } from '@/app/api/ai-manju/route';

interface ApiResponse {
  videos: AiManjuVideo[];
  sources: { key: string; name: string }[];
  failed: string[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const day = Math.floor(diff / 86400000);
  if (day > 30) return `${Math.floor(day / 30)} 个月前`;
  if (day > 0) return `${day} 天前`;
  const hr = Math.floor(diff / 3600000);
  if (hr > 0) return `${hr} 小时前`;
  return '刚刚';
}

function formatViews(n: number | null): string {
  if (n == null) return '';
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万次观看`;
  return `${n} 次观看`;
}

function AiManjuClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>('all');
  const [playing, setPlaying] = useState<AiManjuVideo | null>(null);

  useEffect(() => {
    fetch('/api/ai-manju')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // 打开播放器时锁背景滚动
  useEffect(() => {
    document.body.style.overflow = playing ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [playing]);

  const close = useCallback(() => setPlaying(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const videos =
    data?.videos.filter((v) => active === 'all' || v.sourceKey === active) ??
    [];

  return (
    <PageLayout activePath='/ai-manju'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            AI 漫剧
          </h1>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            聚合 YouTube 上的 AI 漫剧频道，用官方播放器播放
          </p>
        </div>

        {/* 来源筛选 */}
        {data && (
          <div className='mb-6 flex flex-wrap gap-2'>
            {[{ key: 'all', name: '全部' }, ...data.sources].map((s) => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  active === s.key
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className='text-red-600 dark:text-red-400'>
            载入失败：{error}
          </div>
        )}

        {!data && !error && (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='animate-pulse'>
                <div className='aspect-video rounded-lg bg-gray-200 dark:bg-gray-800' />
                <div className='mt-2 h-4 rounded bg-gray-200 dark:bg-gray-800' />
              </div>
            ))}
          </div>
        )}

        {data && data.failed.length > 0 && (
          <div className='mb-4 text-sm text-amber-600 dark:text-amber-400'>
            这些来源暂时抓不到：{data.failed.join('、')}
          </div>
        )}

        {data && videos.length === 0 && (
          <div className='text-gray-500 dark:text-gray-400'>暂无内容</div>
        )}

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          {videos.map((v) => (
            <button
              key={v.videoId}
              onClick={() => setPlaying(v)}
              className='group text-left'
            >
              <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  loading='lazy'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
                <div className='absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30'>
                  <div className='opacity-0 transition-opacity group-hover:opacity-100 rounded-full bg-white/90 p-3'>
                    <svg
                      className='h-6 w-6 text-gray-900'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path d='M8 5v14l11-7z' />
                    </svg>
                  </div>
                </div>
              </div>
              <h3 className='mt-2 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
                {v.title}
              </h3>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                {v.channel}
                {v.views != null && ` · ${formatViews(v.views)}`}
                {v.published && ` · ${timeAgo(v.published)}`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 播放器：YouTube 官方 iframe，播放数与收益仍归原作者 */}
      {playing && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
          onClick={close}
        >
          <div
            className='w-full max-w-4xl'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative aspect-video overflow-hidden rounded-lg bg-black'>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playing.videoId}?autoplay=1&rel=0`}
                title={playing.title}
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                allowFullScreen
                className='h-full w-full'
              />
            </div>
            <div className='mt-3 flex items-start justify-between gap-4'>
              <div className='min-w-0'>
                <h2 className='truncate text-base font-medium text-white'>
                  {playing.title}
                </h2>
                <a
                  href={playing.channelUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-sm text-gray-300 hover:text-white'
                >
                  {playing.channel} ↗
                </a>
              </div>
              <button
                onClick={close}
                className='shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20'
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function AiManjuPage() {
  return (
    <Suspense>
      <AiManjuClient />
    </Suspense>
  );
}
