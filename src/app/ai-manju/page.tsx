/* eslint-disable @next/next/no-img-element */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import PageLayout from '@/components/PageLayout';

import type { AiManjuVideo } from '@/app/api/ai-manju/route';

interface ApiResponse {
  videos: AiManjuVideo[];
  sources: { key: string; name: string; id: string }[];
  failed: { key: string; name: string; error: string }[];
}

/** 使用者自己追踪的来源。存在浏览器 localStorage，所以每台装置各自一份 */
interface Follow {
  type: 'channel' | 'playlist';
  id: string;
  name: string;
}

/** 一次显示几支影片 */
const PAGE_SIZE = 120;

const FOLLOWS_KEY = 'moontv_ai_manju_follows';
const MAX_FOLLOWS = 30;

function loadFollows(): Follow[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLLOWS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (f): f is Follow =>
        f &&
        (f.type === 'channel' || f.type === 'playlist') &&
        typeof f.id === 'string' &&
        typeof f.name === 'string'
    );
  } catch {
    return [];
  }
}

function saveFollows(list: Follow[]) {
  try {
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(list));
  } catch {
    // 无痕模式或容量满了就只保留在这次画面里
  }
}

/** 从 feed 给的频道网址取出 UCxxxx */
function channelIdOf(url: string): string | null {
  return /\/channel\/(UC[\w-]{22})/.exec(url)?.[1] ?? null;
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
  const [limit, setLimit] = useState(PAGE_SIZE);

  // null = 还没从 localStorage 读出来，读完才发第一次请求，避免抓两次
  const [follows, setFollows] = useState<Follow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    setFollows(loadFollows());
  }, []);

  useEffect(() => {
    if (follows === null) return;
    let cancelled = false;
    const extra = follows
      .map((f) => `${f.type === 'channel' ? 'c' : 'p'}:${f.id}`)
      .join(',');
    setRefreshing(true);
    // v=2：换网址，避开浏览器里旧版 API 留下的两小时缓存
    fetch(
      `/api/ai-manju?v=2${extra ? `&extra=${encodeURIComponent(extra)}` : ''}`
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setRefreshing(false));
    return () => {
      cancelled = true;
    };
  }, [follows]);

  const updateFollows = useCallback((next: Follow[]) => {
    setFollows(next);
    saveFollows(next);
  }, []);

  // 自己追的频道后来变成内建来源时，从自己的清单拿掉，免得筛选列出现两个
  useEffect(() => {
    if (!follows || !data) return;
    const builtin = new Set(data.sources.map((s) => s.id));
    if (follows.some((f) => builtin.has(f.id))) {
      updateFollows(follows.filter((f) => !builtin.has(f.id)));
    }
  }, [follows, data, updateFollows]);

  const isTracked = useCallback(
    (id: string) =>
      (follows ?? []).some((f) => f.id === id) ||
      (data?.sources ?? []).some((s) => s.id === id),
    [follows, data]
  );

  const addFollow = useCallback(
    (f: Follow): string | null => {
      const list = follows ?? [];
      if (isTracked(f.id)) return `「${f.name}」已经在追踪清单里`;
      if (list.length >= MAX_FOLLOWS)
        return `最多追踪 ${MAX_FOLLOWS} 个，请先移除不看的`;
      updateFollows([...list, f]);
      return null;
    },
    [follows, isTracked, updateFollows]
  );

  const removeFollow = useCallback(
    (id: string) => {
      updateFollows((follows ?? []).filter((f) => f.id !== id));
      setActive((cur) => (cur === id ? 'all' : cur));
    },
    [follows, updateFollows]
  );

  const submitInput = useCallback(async () => {
    const q = input.trim();
    if (!q || adding) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const r = await fetch(`/api/ai-manju/resolve?q=${encodeURIComponent(q)}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      const err = addFollow({ type: body.type, id: body.id, name: body.name });
      if (err) {
        setAddMsg({ ok: false, text: err });
      } else {
        setInput('');
        setAddMsg({
          ok: true,
          text: body.pending
            ? `已追踪「${body.name}」，YouTube 暂时没回应，影片稍后才会出现`
            : body.videoCount > 0
            ? `已追踪「${body.name}」，抓到 ${body.videoCount} 支影片`
            : `已追踪「${body.name}」，但目前没有公开影片`,
        });
      }
    } catch (e) {
      setAddMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAdding(false);
    }
  }, [input, adding, addFollow]);

  // 打开播放器时锁背景滚动
  useEffect(() => {
    document.body.style.overflow = playing || manageOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [playing, manageOpen]);

  const close = useCallback(() => {
    setPlaying(null);
    setManageOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const videos =
    data?.videos.filter((v) => active === 'all' || v.sourceKey === active) ??
    [];

  // 来源多了以后一次有上千支影片，分批显示，免得页面卡
  const shown = videos.slice(0, limit);

  const followList = follows ?? [];
  const followName = (key: string) =>
    followList.find((f) => f.id === key)?.name;
  const chips = [
    { key: 'all', name: '全部' },
    ...(data?.sources ?? []),
    ...followList.map((f) => ({ key: f.id, name: f.name })),
  ];
  const playingChannelId = playing ? channelIdOf(playing.channelUrl) : null;

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
          <div className='mb-6 flex max-h-40 flex-wrap items-center gap-2 overflow-y-auto'>
            {chips.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setActive(s.key);
                  setLimit(PAGE_SIZE);
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  active === s.key
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {s.name}
              </button>
            ))}
            <button
              onClick={() => {
                setAddMsg(null);
                setManageOpen(true);
              }}
              className='px-3 py-1.5 rounded-full text-sm border border-dashed border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
            >
              ＋ 管理追踪
            </button>
            {refreshing && (
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                更新中…
              </span>
            )}
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
          <div className='mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'>
            <div className='font-medium'>这些来源暂时抓不到：</div>
            <ul className='mt-1 space-y-0.5'>
              {data.failed.map((f) => (
                <li key={f.key}>
                  {followName(f.key) ?? f.name} —{' '}
                  <span className='opacity-80'>{f.error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && videos.length === 0 && (
          <div className='text-gray-500 dark:text-gray-400'>暂无内容</div>
        )}

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          {shown.map((v) => (
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
              <div className='flex shrink-0 items-center gap-2'>
                {playingChannelId &&
                  (isTracked(playingChannelId) ? (
                    <span className='rounded-full bg-white/10 px-4 py-2 text-sm text-gray-300'>
                      已追踪此频道
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        addFollow({
                          type: 'channel',
                          id: playingChannelId,
                          name: playing.channel || playingChannelId,
                        })
                      }
                      className='rounded-full bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500'
                    >
                      ＋ 追踪此频道
                    </button>
                  ))}
                <button
                  onClick={close}
                  className='rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20'
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 管理追踪：新增 / 移除自己追的频道与播放列表 */}
      {manageOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          onClick={close}
        >
          <div
            className='flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between'>
              <h2 className='text-lg font-bold text-gray-900 dark:text-gray-100'>
                管理追踪
              </h2>
              <button
                onClick={close}
                className='rounded-full px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              >
                关闭
              </button>
            </div>

            <form
              className='mt-4 flex gap-2'
              onSubmit={(e) => {
                e.preventDefault();
                submitInput();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='贴上频道网址、@帐号、播放列表或影片网址'
                autoFocus
                className='min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
              />
              <button
                type='submit'
                disabled={adding || !input.trim()}
                className='shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50'
              >
                {adding ? '查询中…' : '追踪'}
              </button>
            </form>
            {addMsg && (
              <p
                className={`mt-2 text-sm ${
                  addMsg.ok
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {addMsg.text}
              </p>
            )}
            <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              贴影片网址会追踪发布那支影片的频道。清单存在这台装置的浏览器里，换装置要重新加。
            </p>

            <div className='mt-4 min-h-0 flex-1 overflow-y-auto'>
              <h3 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                我追踪的（{followList.length}/{MAX_FOLLOWS}）
              </h3>
              {followList.length === 0 ? (
                <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>
                  还没有追踪任何帐号
                </p>
              ) : (
                <ul className='mt-2 divide-y divide-gray-100 dark:divide-gray-800'>
                  {followList.map((f) => (
                    <li
                      key={f.id}
                      className='flex items-center justify-between gap-3 py-2'
                    >
                      <a
                        href={
                          f.type === 'channel'
                            ? `https://www.youtube.com/channel/${f.id}`
                            : `https://www.youtube.com/playlist?list=${f.id}`
                        }
                        target='_blank'
                        rel='noopener noreferrer'
                        className='min-w-0 truncate text-sm text-gray-900 hover:underline dark:text-gray-100'
                      >
                        {f.name}
                        <span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
                          {f.type === 'channel' ? '频道' : '播放列表'}
                        </span>
                      </a>
                      <button
                        onClick={() => removeFollow(f.id)}
                        className='shrink-0 rounded-full px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {data && data.sources.length > 0 && (
                <>
                  <h3 className='mt-4 text-sm font-medium text-gray-700 dark:text-gray-300'>
                    内建来源（所有装置共用，不能在这里移除）
                  </h3>
                  <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                    {data.sources.map((s) => s.name).join('、')}
                  </p>
                </>
              )}
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
