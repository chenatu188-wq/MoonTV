/* eslint-disable @next/next/no-img-element */
'use client';

import {
  type SeriesEpisode,
  type SeriesFollow,
  episodeLabel,
  followKey,
  newCount,
  sortFollows,
} from '@/lib/ai-manju-series-follow';
import { takeOverClick } from '@/lib/link-click';
import { aiManjuHref } from '@/lib/video-links';

import HScroll from '@/components/HScroll';

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
}: {
  follows: SeriesFollow[];
  /** 正在检查的那部（followKey） */
  checking: string | null;
  onPlay: (ep: SeriesEpisode, follow: SeriesFollow) => void;
  onAll: (follow: SeriesFollow) => void;
  /** 红果的剧：点了另开红果官网（电脑播放页、手机剧集页） */
  onHongguo: (follow: SeriesFollow) => void;
  onRemove: (key: string) => void;
}) {
  if (follows.length === 0) return null;
  const list = sortFollows(follows);
  const fresh = list.filter((f) => newCount(f) > 0).length;

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
      <HScroll resetKey={`series:${list.length}`} arrowTop='2.75rem'>
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
                  </div>
                  <div className='mt-1 line-clamp-1 text-xs font-bold text-gray-900 dark:text-gray-100'>
                    {f.name}
                  </div>
                  <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                    红果 · 共 {hg.total} 集 ↗
                  </div>
                </button>
                <div className='mt-1 flex gap-2 text-xs'>
                  <button
                    onClick={() => onAll(f)}
                    className='rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    title='看 YouTube 上有没有人上传'
                  >
                    YouTube 找
                  </button>
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
              <div className='mt-1 flex gap-2 text-xs'>
                <button
                  onClick={() => onAll(f)}
                  className='rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                >
                  全集
                </button>
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
