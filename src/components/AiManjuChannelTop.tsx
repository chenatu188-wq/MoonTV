/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';

import type { AiManjuVideo } from '@/lib/ai-manju-feed';

import HScroll from '@/components/HScroll';

type TopVideo = AiManjuVideo & { channelId: string };

/** 每个频道一排，全部摊开会有一百多排：先显示几排，再按钮一次多几排 */
const FIRST = 4;
const STEP = 8;

/** 一个频道一排：观看数最高的 20 支。卷到附近才去抓，免得一开页就打一百多次 */
function ChannelRow({
  id,
  name,
  onPlay,
}: {
  id: string;
  name: string;
  onPlay: (v: TopVideo) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [videos, setVideos] = useState<TopVideo[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    fetch(`/api/ai-manju/top?id=${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => !cancelled && setVideos(d.videos ?? []))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [near, id]);

  // 抓不到或频道没影片就整排不显示
  if (failed || videos?.length === 0) return null;

  return (
    <div ref={ref} className='mb-4' data-channel-top={id}>
      <h3 className='mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200'>
        {name}
      </h3>
      {videos ? (
        <HScroll resetKey={`top:${id}`} arrowTop='2.75rem'>
          {videos.map((v, i) => (
            <button
              key={v.videoId}
              onClick={() => onPlay({ ...v, channel: v.channel || name })}
              className='group w-44 shrink-0 text-left'
            >
              <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  loading='lazy'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
                <span className='absolute left-0 top-0 rounded-br-lg bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white'>
                  {i + 1}
                </span>
              </div>
              <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                {v.title}
              </div>
              {v.meta && (
                <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                  {v.meta}
                </div>
              )}
            </button>
          ))}
        </HScroll>
      ) : (
        <div className='h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800' />
      )}
    </div>
  );
}

export default function AiManjuChannelTop({
  channels,
  onPlay,
}: {
  channels: { id: string; name: string }[];
  onPlay: (v: TopVideo) => void;
}) {
  const [count, setCount] = useState(FIRST);
  if (channels.length === 0) return null;

  return (
    <div className='mb-6'>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          各频道热门 20
        </h2>
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          每个追踪频道观看数最高的 20 支 · 最近有更新的频道排前面 · 共{' '}
          {channels.length} 个频道
        </span>
      </div>
      {channels.slice(0, count).map((c) => (
        <ChannelRow key={c.id} id={c.id} name={c.name} onPlay={onPlay} />
      ))}
      {count < channels.length && (
        <button
          onClick={() => setCount((n) => n + STEP)}
          className='w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        >
          显示更多频道（还有 {channels.length - count} 个）
        </button>
      )}
    </div>
  );
}
