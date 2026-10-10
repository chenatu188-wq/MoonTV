/* eslint-disable @next/next/no-img-element */
'use client';

import { formatPosition } from '@/lib/watch-marks';

import HScroll from '@/components/HScroll';

export interface WatchLaterCard {
  id: string;
  title: string;
  thumbnail: string;
  /** 片名下面那一行（频道／帐号名） */
  note: string;
  seconds: number;
}

/**
 * 「继续观看」：使用者在播放器按了标记的影片。点了从上次的位置接着播，右上角的 × 拿掉标记。
 * 没有标记就整块不显示。
 */
export default function WatchLaterStrip({
  items,
  portrait = false,
  onPlay,
  onRemove,
}: {
  items: WatchLaterCard[];
  /** TikTok 的缩图是直的 */
  portrait?: boolean;
  onPlay: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className='mb-6' data-watch-later>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          继续观看
        </h2>
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          你标记的影片，点了从上次的位置接着播 · 只存在这台装置
        </span>
      </div>
      <HScroll
        resetKey={`marks:${items.length}`}
        arrowTop={portrait ? '4.5rem' : '2.75rem'}
      >
        {items.map((it) => (
          <div
            key={it.id}
            className={`group relative shrink-0 ${portrait ? 'w-28' : 'w-44'}`}
          >
            <button
              onClick={() => onPlay(it.id)}
              className='block w-full text-left'
              data-watch-later-card
            >
              <div
                className={`relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 ${
                  portrait ? 'aspect-[5/7]' : 'aspect-video'
                }`}
              >
                {it.thumbnail && (
                  <img
                    src={it.thumbnail}
                    alt={it.title}
                    loading='lazy'
                    referrerPolicy='no-referrer'
                    className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                  />
                )}
                <span className='absolute bottom-0 left-0 rounded-tr-lg bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                  {it.seconds > 0
                    ? `看到 ${formatPosition(it.seconds)}`
                    : '已标记'}
                </span>
              </div>
              <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                {it.title || '（无标题）'}
              </div>
              <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                {it.note}
              </div>
            </button>
            <button
              aria-label='拿掉标记'
              title='拿掉标记'
              onClick={() => onRemove(it.id)}
              className='absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-sm leading-none text-white hover:bg-red-600'
            >
              ×
            </button>
          </div>
        ))}
      </HScroll>
    </div>
  );
}
