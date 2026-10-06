/* eslint-disable @next/next/no-img-element */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import { toSimplifiedFull } from '@/lib/t2s-table';

import PageLayout from '@/components/PageLayout';

import type {
  TiktokManjuData,
  TiktokManjuVideo,
} from '@/app/api/tiktok-manju/route';

function timeAgo(sec: number): string {
  if (!sec) return '';
  const diff = Date.now() - sec * 1000;
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

function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 一次显示几支影片 */
const PAGE_SIZE = 120;

/** 搜寻比对用：转简体、去空白、转小写，繁简混打都找得到 */
const norm = (s: string) =>
  toSimplifiedFull(s).replace(/\s+/g, '').toLowerCase();

function TiktokManjuClient() {
  const [data, setData] = useState<TiktokManjuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>('all');
  const [playing, setPlaying] = useState<TiktokManjuVideo | null>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch('/api/tiktok-manju')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then(setData)
      .catch((e) => setError((e as Error).message));
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

  // 搜寻只搜已经抓下来的影片（每个帐号最新 30 支），可用空白隔开多个关键字
  const words = norm(query) ? query.split(/\s+/).map(norm).filter(Boolean) : [];
  const videos =
    data?.videos.filter((v) => {
      if (active !== 'all' && v.handle !== active) return false;
      if (words.length === 0) return true;
      const hay = norm(`${v.title} ${v.name} ${v.handle}`);
      return words.every((w) => hay.includes(w));
    }) ?? [];
  const shown = videos.slice(0, limit);
  // 完全没有旧资料可顶的帐号才提示；有旧资料的照常显示，不打扰
  const missing = data?.failed.filter((f) => !f.stale) ?? [];

  return (
    <PageLayout activePath='/tiktok-manju'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            TikTok 漫剧
          </h1>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            追踪 TikTok 上的 AI 漫剧帐号，用官方播放器播放
            {data && ` · 资料更新于 ${timeAgo(data.updated)}`}
          </p>
        </div>

        {/* 搜寻 */}
        {data && (
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <div className='relative w-full max-w-md'>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
                placeholder='搜寻片名、标签或帐号（繁简皆可）'
                className='w-full rounded-full border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm text-gray-900 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
              />
              {query && (
                <button
                  aria-label='清除搜寻'
                  onClick={() => setQuery('')}
                  className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 text-lg leading-none text-gray-500 hover:text-gray-900 dark:hover:text-white'
                >
                  ×
                </button>
              )}
            </div>
            {words.length > 0 && (
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                找到 {videos.length} 支
                {active !== 'all' && '（只搜目前选的帐号）'}
              </span>
            )}
          </div>
        )}

        {/* 帐号筛选 */}
        {data && (
          <div className='mb-6 flex flex-wrap items-center gap-2'>
            {[{ handle: 'all', name: '全部' }, ...data.accounts].map((a) => (
              <button
                key={a.handle}
                onClick={() => {
                  setActive(a.handle);
                  setLimit(PAGE_SIZE);
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  active === a.handle
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {a.name}
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
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className='animate-pulse'>
                <div className='aspect-[9/16] rounded-lg bg-gray-200 dark:bg-gray-800' />
                <div className='mt-2 h-4 rounded bg-gray-200 dark:bg-gray-800' />
              </div>
            ))}
          </div>
        )}

        {missing.length > 0 && (
          <div className='mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'>
            这些帐号暂时抓不到：{missing.map((f) => `@${f.handle}`).join('、')}
          </div>
        )}

        {data && videos.length === 0 && (
          <div className='text-gray-500 dark:text-gray-400'>
            {words.length > 0
              ? `找不到「${query.trim()}」。这里只搜得到已追踪帐号最近的影片，搜不到整个 TikTok`
              : '暂无内容'}
          </div>
        )}

        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
          {shown.map((v) => (
            <button
              key={v.id}
              onClick={() => setPlaying(v)}
              className='group text-left'
            >
              <div className='relative aspect-[9/16] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                {v.thumbnail && (
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    loading='lazy'
                    referrerPolicy='no-referrer'
                    className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                  />
                )}
                {v.duration ? (
                  <span className='absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white'>
                    {formatDuration(v.duration)}
                  </span>
                ) : null}
              </div>
              <h3 className='mt-2 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
                {v.title || '（无标题）'}
              </h3>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                {v.name}
                {v.views != null && ` · ${formatViews(v.views)}`}
                {v.published ? ` · ${timeAgo(v.published)}` : ''}
              </p>
            </button>
          ))}
        </div>
        {videos.length > shown.length && (
          <div className='mt-6 flex justify-center'>
            <button
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className='rounded-full bg-gray-100 px-6 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            >
              显示更多（还有 {videos.length - shown.length} 支）
            </button>
          </div>
        )}
      </div>

      {/* 播放器：TikTok 官方嵌入播放器，直式影片 */}
      {playing && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
          onClick={close}
        >
          <div
            className='flex max-h-full flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className='relative overflow-hidden rounded-lg bg-black'
              style={{
                height: 'min(78vh, calc((100vw - 2rem) * 16 / 9))',
                aspectRatio: '9 / 16',
              }}
            >
              <iframe
                src={`https://www.tiktok.com/player/v1/${playing.id}?autoplay=1&rel=0&description=0&music_info=0`}
                title={playing.title}
                allow='autoplay; fullscreen; encrypted-media; picture-in-picture'
                allowFullScreen
                className='h-full w-full'
              />
            </div>
            <div className='mt-3 flex items-center justify-between gap-3'>
              <a
                href={`https://www.tiktok.com/@${playing.handle}/video/${playing.id}`}
                target='_blank'
                rel='noopener noreferrer'
                className='min-w-0 truncate text-sm text-gray-300 hover:text-white'
              >
                {playing.name} ↗
              </a>
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

export default function TiktokManjuPage() {
  return (
    <Suspense>
      <TiktokManjuClient />
    </Suspense>
  );
}
