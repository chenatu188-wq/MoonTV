'use client';

import { useEffect, useState } from 'react';

import {
  deleteFavorite,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';

/**
 * 卡片角落一直显示的 ☆：按了收藏起来日后再看，再按取消。
 * 收藏依片源分区：彩虹频道的片会进彩虹频道的收藏夹。
 * 卡片本身是连结，所以用 span 当按钮（<a> 里不能再放 <button>），并挡掉点击往外传。
 */
export default function StarLaterButton({
  source,
  id,
  title,
  poster,
  sourceName,
  year = '',
  episodes = 1,
  query = '',
  className = 'left-1.5 top-1.5',
}: {
  source: string;
  id: string;
  title: string;
  poster: string;
  sourceName: string;
  year?: string;
  episodes?: number;
  /** 搜寻用的片名，从收藏夹点开时用来找其他片源 */
  query?: string;
  /** 摆在卡片哪个角 */
  className?: string;
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;
    isFavorited(source, id)
      .then((v) => alive && setOn(v))
      .catch(() => null);
    const key = generateStorageKey(source, id);
    const off = subscribeToDataUpdates(
      'favoritesUpdated',
      (all: Record<string, unknown>) => setOn(!!all[key])
    );
    return () => {
      alive = false;
      off();
    };
  }, [source, id]);

  const toggle = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (on) {
        await deleteFavorite(source, id);
        setOn(false);
      } else {
        await saveFavorite(source, id, {
          title,
          source_name: sourceName || source,
          year,
          cover: poster,
          total_episodes: episodes,
          save_time: Date.now(),
          search_title: query || undefined,
        });
        setOn(true);
      }
    } catch {
      // 存不了（无痕模式之类）就维持原状
    }
  };

  return (
    <span
      role='button'
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(e)}
      className={`absolute z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-lg leading-none text-white shadow-md transition-transform hover:scale-110 ${
        on ? 'bg-amber-400' : 'bg-black/50'
      } ${className}`}
      title={on ? '已收藏 · 再按取消' : '收藏起来，日后再看'}
      aria-label={on ? '取消收藏' : '收藏起来日后再看'}
      aria-pressed={on}
      data-star-later={on ? 'on' : 'off'}
    >
      {on ? '★' : '☆'}
    </span>
  );
}
