/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';

import {
  type SeriesEpisode,
  type SeriesFollow,
  type WatchStatus,
  episodeLabel,
  followKey,
  newCount,
  sortFollows,
  WATCH_STATUS_LABEL,
  watchStatus,
} from '@/lib/ai-manju-series-follow';
import { takeOverClick } from '@/lib/link-click';
import { aiManjuHref } from '@/lib/video-links';

import HScroll from '@/components/HScroll';

const FILTER_KEY = 'moontv_ai_manju_series_filter';
const FILTERS: (WatchStatus | 'all')[] = ['all', 'watching', 'unwatched', 'done'];

const STATUS_BADGE: Record<WatchStatus, string> = {
  watching: 'bg-blue-600',
  unwatched: 'bg-gray-500',
  done: 'bg-green-600',
};

/** 卡片左下角的看过没；按钮切「看完了」 */
function StatusRow({
  follow,
  onDone,
}: {
  follow: SeriesFollow;
  onDone: (key: string, done: boolean) => void;
}) {
  const done = watchStatus(follow) === 'done';
  return (
    <button
      onClick={() => onDone(followKey(follow), !done)}
      className={`rounded-full px-2 py-0.5 ${
        done
          ? 'bg-green-600 text-white hover:bg-green-500'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
      title={done ? '改回还没看完' : '标成看完了，排到最后面'}
      data-series-done
    >
      {done ? '✓ 看完了' : '看完了'}
    </button>
  );
}

function StatusBadge({ follow }: { follow: SeriesFollow }) {
  const st = watchStatus(follow);
  return (
    <span
      className={`absolute bottom-1 left-1 rounded px-1 py-0.5 text-[10px] text-white ${STATUS_BADGE[st]}`}
      data-series-status={st}
    >
      {WATCH_STATUS_LABEL[st]}
    </span>
  );
}

/**
 * 「追剧」：在播放器按「🔔 追这部剧」的剧。出了新集就标红色的「新」，
 * 点卡片播最新一集，按「全集」列出所有季、所有集。没追任何剧就整块不显示。
 */
export default function AiManjuSeriesStrip({
  follows,
  checking,
  onPlay,
  onAll,
  onHongguo,
  onRemove,
  onDone,
}: {
  follows: SeriesFollow[];
  /** 正在检查的那部（followKey） */
  checking: string | null;
  onPlay: (ep: SeriesEpisode, follow: SeriesFollow) => void;
  onAll: (follow: SeriesFollow) => void;
  /** 红果的剧：点了另开红果官网（电脑播放页、手机剧集页） */
  onHongguo: (follow: SeriesFollow) => void;
  onRemove: (key: string) => void;
  onDone: (key: string, done: boolean) => void;
}) {
  const [filter, setFilter] = useState<WatchStatus | 'all'>('all');
  useEffect(() => {
    try {
      const v = localStorage.getItem(FILTER_KEY) as WatchStatus | 'all' | null;
      if (v && FILTERS.includes(v)) setFilter(v);
    } catch {
      // 读不到就看全部
    }
  }, []);
  const choose = (v: WatchStatus | 'all') => {
    setFilter(v);
    try {
      localStorage.setItem(FILTER_KEY, v);
    } catch {
      // 无痕模式就只记这一次
    }
  };

  if (follows.length === 0) return null;
  const sorted = sortFollows(follows);
  const fresh = sorted.filter((f) => newCount(f) > 0).length;
  const count = (st: WatchStatus) =>
    sorted.filter((f) => watchStatus(f) === st).length;
  const list =
    filter === 'all' ? sorted : sorted.filter((f) => watchStatus(f) === filter);

  return (
    <div className='mb-6' data-series-follows>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          追剧
        </h2>
        {fresh > 0 && (
          <span className='rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white'>
            {fresh} 部有新集
          </span>
        )}
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          出了新集会标「新」· 每次打开这页自动检查（同一部半小时查一次）· 红果的剧点了另开红果官网（部分要登入红果） · 只存在这台装置
        </span>
      </div>
      <div className='mb-2 flex flex-wrap gap-2' data-series-filters>
        {FILTERS.map((v) => (
          <button
            key={v}
            onClick={() => choose(v)}
            className={`rounded-full px-3 py-0.5 text-xs ${
              filter === v
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            data-series-filter={v}
          >
            {v === 'all' ? '全部' : WATCH_STATUS_LABEL[v]}（
            {v === 'all' ? sorted.length : count(v)}）
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <div className='py-4 text-sm text-gray-500 dark:text-gray-400'>
          这一类没有剧
        </div>
      )}
      <HScroll resetKey={`series:${filter}:${list.length}`} arrowTop='2.75rem'>
        {list.map((f) => {
          const key = followKey(f);
          const ep = f.latest;
          if (f.hg) {
            const hg = f.hg;
            return (
              <div key={key} className='w-44 shrink-0' data-series-follow={f.name}>
                <button
                  onClick={() => onHongguo(f)}
                  className='group block w-full text-left'
                  data-hongguo-follow={hg.id}
                >
                  <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                    {hg.cover && (
                      <img
                        src={hg.cover}
                        alt={f.name}
                        loading='lazy'
                        referrerPolicy='no-referrer'
                        className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                      />
                    )}
                    {newCount(f) > 0 && (
                      <span
                        className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'
                        data-series-new
                      >
                        新 {newCount(f)} 集
                      </span>
                    )}
                    <span className='absolute bottom-1 right-1 rounded bg-red-600 px-1 py-0.5 text-[10px] text-white'>
                      {checking === key ? '检查中…' : '红果'}
                    </span>
                    <StatusBadge follow={f} />
                  </div>
                  <div className='mt-1 line-clamp-1 text-xs font-bold text-gray-900 dark:text-gray-100'>
                    {f.name}
                  </div>
                  <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                    红果 · 共 {hg.total} 集 ↗
                  </div>
                </button>
                <div className='mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap text-xs'>
                  <button
                    onClick={() => onAll(f)}
                    className='rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    title='看 YouTube 上有没有人上传'
                  >
                    YouTube 找
                  </button>
                  <StatusRow follow={f} onDone={onDone} />
                  <button
                    onClick={() => {
                      if (confirm(`不再追「${f.name}」？`)) onRemove(key);
                    }}
                    className='text-gray-400 hover:text-red-500'
                  >
                    不追了
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={key} className='w-44 shrink-0' data-series-follow={f.name}>
              <a
                href={ep ? aiManjuHref(ep) : undefined}
                onClick={(e) => {
                  if (!ep) return e.preventDefault();
                  if (takeOverClick(e)) onPlay(ep, f);
                }}
                className='group block cursor-pointer text-left'
              >
                <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                  {ep && (
                    <img
                      src={ep.thumbnail}
                      alt={ep.title}
                      loading='lazy'
                      className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                  )}
                  {newCount(f) > 0 && (
                    <span
                      className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'
                      data-series-new
                    >
                      新 {newCount(f)} 集
                    </span>
                  )}
                  {(checking === key || !ep) && (
                    <span className='absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white'>
                      {checking === key ? '检查中…' : '还没找到集数'}
                    </span>
                  )}
                  <StatusBadge follow={f} />
                </div>
                <div className='mt-1 line-clamp-1 text-xs font-bold text-gray-900 dark:text-gray-100'>
                  {f.name}
                </div>
                <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                  {ep
                    ? ep.season !== null || ep.episode !== null
                      ? `最新：${episodeLabel(ep)}`
                      : ep.title
                    : f.channel}
                </div>
              </a>
              <div className='mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap text-xs'>
                <button
                  onClick={() => onAll(f)}
                  className='rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                >
                  全集
                </button>
                <StatusRow follow={f} onDone={onDone} />
                <button
                  onClick={() => {
                    if (confirm(`不再追「${f.name}」？`)) onRemove(key);
                  }}
                  className='text-gray-400 hover:text-red-500'
                >
                  不追了
                </button>
              </div>
            </div>
          );
        })}
      </HScroll>
    </div>
  );
}
