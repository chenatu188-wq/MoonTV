/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';

import type { AiManjuVideo } from '@/lib/ai-manju-feed';
import { type TopSort, sortTop } from '@/lib/ai-manju-top-sort';
import { takeOverClick } from '@/lib/link-click';
import { aiManjuHref } from '@/lib/video-links';

import CardFavStar from '@/components/CardFavStar';
import HScroll from '@/components/HScroll';

type TopVideo = AiManjuVideo & { channelId: string };

/** 每个频道一排，全部摊开会有一百多排：先显示几排，再按钮一次多几排 */
const FIRST = 4;
const STEP = 8;

/** 一个频道一排：观看数最高的 20 支，可按「换一批」看下一批。卷到附近才去抓，免得一开页就打一百多次 */
function ChannelRow({
  id,
  name,
  pinned,
  onTogglePin,
  onPlay,
}: {
  id: string;
  name: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  onPlay: (v: TopVideo) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [videos, setVideos] = useState<TopVideo[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** 「换一批」：照热门顺序往下一页 20 支，翻到底再回第一批 */
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  /** 只排目前这一批 20 支；再按一次同一颗回到热门顺序 */
  const [sortBy, setSortBy] = useState<TopSort>('hot');

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

  const nextBatch = async () => {
    if (loading) return;
    let next = page + 1;
    if (pages !== null && next >= pages) next = 0;
    setLoading(true);
    setNote('');
    try {
      const r = await fetch(`/api/ai-manju/top?id=${id}&page=${next}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const list: TopVideo[] = d.videos ?? [];
      if (typeof d.pages === 'number') setPages(d.pages);
      if (list.length === 0) {
        // 已经是最后一批了：回到第一批（第一批手上就有，重抓一次也快）
        if (next > 0) setPages(next);
        setNote(
          next > 1 ? '已经看完热门前几名，回到第一批' : '这个频道没有其他影片了'
        );
        if (next > 1) {
          const r0 = await fetch(`/api/ai-manju/top?id=${id}&page=0`);
          const d0 = await r0.json();
          setVideos(d0.videos ?? []);
          setPage(0);
        }
        return;
      }
      setVideos(list);
      setPage(next);
    } catch {
      setNote('换不了，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 抓不到或频道没影片：留一行灰字，不要整排消失（不然按「显示更多」像没反应）
  if (failed || (page === 0 && videos?.length === 0))
    return (
      <div
        ref={ref}
        className='mb-2 text-xs text-gray-400 dark:text-gray-500'
        data-channel-top={id}
      >
        {pinned && '📌 '}
        {name} · {failed ? '暂时读不到热门影片' : '没有影片'}
      </div>
    );

  return (
    <div ref={ref} className='mb-4' data-channel-top={id}>
      <h3 className='mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200'>
        {pinned && <span title='已置顶'>📌</span>}
        {name}
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className='rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            data-pin-toggle
          >
            {pinned ? '取消置顶' : '置顶'}
          </button>
        )}
        {videos && (
          <button
            onClick={nextBatch}
            disabled={loading}
            className='rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            data-next-batch
          >
            {loading
              ? '换一批…'
              : `🔄 换一批${
                  pages
                    ? `（${page + 1}/${pages}）`
                    : page > 0
                    ? `（第 ${page + 1} 批）`
                    : ''
                }`}
          </button>
        )}
        {videos &&
          (
            [
              ['long', '⏱ 片长'],
              ['date', '📅 日期'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSortBy((s) => (s === k ? 'hot' : k))}
              className={`rounded-full px-2 py-0.5 text-xs font-normal ${
                sortBy === k
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              title={
                sortBy === k
                  ? '再按一次回到热门排序'
                  : k === 'long'
                  ? '这一批依片长排序，长的在前'
                  : '这一批依上传日期排序，新的在前'
              }
              data-top-sort={k}
            >
              {label}
              {sortBy === k && ' ✓'}
            </button>
          ))}
        {note && (
          <span className='text-xs font-normal text-gray-500 dark:text-gray-400'>
            {note}
          </span>
        )}
      </h3>
      {videos ? (
        <HScroll resetKey={`top:${id}:${page}:${sortBy}`} arrowTop='2.75rem'>
          {sortTop(videos, sortBy).map((v) => (
            <a
              key={v.videoId}
              href={aiManjuHref({ ...v, channel: v.channel || name })}
              onClick={(e) =>
                takeOverClick(e) && onPlay({ ...v, channel: v.channel || name })
              }
              className='group w-44 shrink-0 text-left'
            >
              <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  loading='lazy'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
                <CardFavStar video={{ ...v, channel: v.channel || name }} />
                <span className='absolute left-0 top-0 rounded-br-lg bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white'>
                  {page * 20 + videos.indexOf(v) + 1}
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
            </a>
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
  onTogglePin,
  onPlay,
}: {
  /** pinned：使用者置顶的频道，呼叫端已经把它们排在最前面 */
  channels: { id: string; name: string; key: string; pinned: boolean }[];
  onTogglePin: (key: string) => void;
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
          每个追踪频道观看数最高的 20 支 ·
          置顶频道最前面，其余每天轮播，每周全部轮一遍，再按最近更新排列 · 共{' '}
          {channels.length} 个频道
        </span>
      </div>
      {channels.slice(0, count).map((c) => (
        <ChannelRow
          key={c.id}
          id={c.id}
          name={c.name}
          pinned={c.pinned}
          onTogglePin={() => onTogglePin(c.key)}
          onPlay={onPlay}
        />
      ))}
      {count < channels.length && (
        <button
          onClick={() => setCount((n) => n + STEP)}
          className='w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        >
          显示更多频道（已显示 {Math.min(count, channels.length)} / 共{' '}
          {channels.length} 个）
        </button>
      )}
    </div>
  );
}
