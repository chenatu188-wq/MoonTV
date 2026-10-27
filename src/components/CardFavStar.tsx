'use client';

import { createContext, useContext } from 'react';

import type { AiManjuVideo } from '@/lib/ai-manju-feed';

/** 卡片缩图右上角的 ☆：先收藏，有空再看。由页面提供收藏清单 */
export const CardFavContext = createContext<{
  isFav: (id: string) => boolean;
  toggle: (v: AiManjuVideo) => void;
} | null>(null);

export default function CardFavStar({ video }: { video: AiManjuVideo }) {
  const ctx = useContext(CardFavContext);
  if (!ctx) return null;
  const on = ctx.isFav(video.videoId);
  return (
    <button
      type='button'
      aria-label={on ? '取消收藏' : '收藏，有空再看'}
      title={on ? '取消收藏' : '收藏，有空再看'}
      onClick={(e) => {
        // 卡片本身是连结，别让它跟着开播
        e.preventDefault();
        e.stopPropagation();
        ctx.toggle(video);
      }}
      className={`absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-white ${
        on ? 'bg-amber-500' : 'bg-black/60 hover:bg-amber-500'
      }`}
      data-card-fav
    >
      {on ? '★' : '☆'}
    </button>
  );
}
