/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { YtVideo } from '@/lib/ai-manju-youtube';
import {
  type FavoriteSong,
  favoritesAsVideos,
  MUSIC_FAVORITES_KEY,
  sanitizeFavorites,
  toggleFavorite,
} from '@/lib/music-favorites';
import { musicEmbedUrl, parseYtMessage } from '@/lib/music-player';

import HScroll from '@/components/HScroll';
import PageLayout from '@/components/PageLayout';

interface Follow {
  type: 'channel' | 'playlist';
  id: string;
  name: string;
}

interface Queue {
  /** 这份清单从哪来（频道名），显示用 */
  from: string;
  videos: YtVideo[];
  /** 现在播到第几首 */
  index: number;
  /** 从第几首开始交给播放器（换清单或按上一首／下一首时才变） */
  startAt: number;
}

const LOOP_KEY = 'moontv_music_loop';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body as T;
}

const listUrl = (f: Follow, cont?: string | null) =>
  `/api/ai-manju/channel?type=${f.type}&id=${f.id}&name=${encodeURIComponent(
    f.name
  )}${cont ? `&cont=${encodeURIComponent(cont)}` : ''}`;

function VideoCard({
  v,
  playing,
  onClick,
  wide,
}: {
  v: YtVideo;
  playing: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left ${wide ? 'w-full' : 'w-44 shrink-0'}`}
      data-music-video={v.videoId}
    >
      <div
        className={`relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 ${
          playing ? 'ring-2 ring-green-500' : ''
        }`}
      >
        <img
          src={v.thumbnail}
          alt={v.title}
          loading='lazy'
          className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
        />
        {playing && (
          <span className='absolute left-0 top-0 rounded-br-lg bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white'>
            ♪ 播放中
          </span>
        )}
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
  );
}

/** 一个频道一排最新的歌，卷到附近才去抓 */
function ChannelRow({
  follow,
  playingId,
  onPlay,
  onOpen,
}: {
  follow: Follow;
  playingId: string | null;
  onPlay: (videos: YtVideo[], index: number, from: string) => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [videos, setVideos] = useState<YtVideo[] | null>(null);
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
    fetchJson<{ videos: YtVideo[] }>(listUrl(follow))
      .then((d) => !cancelled && setVideos(d.videos ?? []))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [near, follow]);

  return (
    <div ref={ref} className='mb-6' data-music-row={follow.id}>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <button
          onClick={onOpen}
          className='text-sm font-bold text-gray-900 hover:text-green-600 dark:text-gray-100 dark:hover:text-green-400'
        >
          {follow.name} ›
        </button>
        {videos && videos.length > 0 && (
          <button
            onClick={() => onPlay(videos, 0, follow.name)}
            className='rounded-full bg-green-600 px-3 py-0.5 text-xs text-white hover:bg-green-500'
            data-play-all
          >
            ▶ 全部播放
          </button>
        )}
      </div>
      {failed ? (
        <div className='text-xs text-gray-500'>这个频道暂时读不到</div>
      ) : videos ? (
        videos.length === 0 ? (
          <div className='text-xs text-gray-500'>没有影片</div>
        ) : (
          <HScroll resetKey={`music:${follow.id}`} arrowTop='2.75rem'>
            {videos.map((v, i) => (
              <VideoCard
                key={v.videoId}
                v={v}
                playing={v.videoId === playingId}
                onClick={() => onPlay(videos, i, follow.name)}
              />
            ))}
          </HScroll>
        )
      ) : (
        <div className='h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800' />
      )}
    </div>
  );
}

/** 我的最爱歌单：播放器按 ☆ 加进来的歌，存在这台装置 */
function FavoritesRow({
  favorites,
  playingId,
  onPlay,
  onRemove,
}: {
  favorites: FavoriteSong[];
  playingId: string | null;
  onPlay: (videos: YtVideo[], index: number, from: string) => void;
  onRemove: (videoId: string) => void;
}) {
  if (favorites.length === 0) return null;
  const videos = favoritesAsVideos(favorites);
  return (
    <div className='mb-6' data-music-favorites>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-sm font-bold text-gray-900 dark:text-gray-100'>
          ⭐ 我的最爱（{favorites.length} 首）
        </h2>
        <button
          onClick={() => onPlay(videos, 0, '我的最爱')}
          className='rounded-full bg-green-600 px-3 py-0.5 text-xs text-white hover:bg-green-500'
          data-play-favorites
        >
          ▶ 全部播放
        </button>
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          播放器按 ☆ 加入 · 只存在这台装置
        </span>
      </div>
      <HScroll resetKey={`fav:${favorites.length}`} arrowTop='2.75rem'>
        {videos.map((v, i) => (
          <div key={v.videoId} className='w-44 shrink-0'>
            <VideoCard
              v={v}
              wide
              playing={v.videoId === playingId}
              onClick={() => onPlay(videos, i, '我的最爱')}
            />
            <button
              onClick={() => onRemove(v.videoId)}
              className='mt-0.5 text-xs text-gray-400 hover:text-red-500'
            >
              移出最爱
            </button>
          </div>
        ))}
      </HScroll>
    </div>
  );
}

/** 点进某个频道：全部的歌，可以一直往下载 */
function ChannelView({
  follow,
  playingId,
  onPlay,
  onBack,
}: {
  follow: Follow;
  playingId: string | null;
  onPlay: (videos: YtVideo[], index: number, from: string) => void;
  onBack: () => void;
}) {
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (cont: string | null) => {
      setLoading(true);
      try {
        const d = await fetchJson<{ videos: YtVideo[]; next: string | null }>(
          listUrl(follow, cont)
        );
        setVideos((cur) => {
          const seen = new Set(cur.map((v) => v.videoId));
          return [...cur, ...d.videos.filter((v) => !seen.has(v.videoId))];
        });
        setNext(d.next);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [follow]
  );

  useEffect(() => {
    setVideos([]);
    setNext(null);
    setError('');
    load(null);
  }, [load]);

  return (
    <div data-music-channel={follow.id}>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <button
          onClick={onBack}
          className='rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        >
          ‹ 返回
        </button>
        <h2 className='text-lg font-bold text-gray-900 dark:text-gray-100'>
          {follow.name}
        </h2>
        {videos.length > 0 && (
          <button
            onClick={() => onPlay(videos, 0, follow.name)}
            className='rounded-full bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500'
          >
            ▶ 全部播放（{videos.length} 首）
          </button>
        )}
      </div>
      {error && (
        <div className='mb-2 text-sm text-red-500'>读取失败：{error}</div>
      )}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
        {videos.map((v, i) => (
          <VideoCard
            key={v.videoId}
            v={v}
            wide
            playing={v.videoId === playingId}
            onClick={() => onPlay(videos, i, follow.name)}
          />
        ))}
      </div>
      {loading ? (
        <div className='mt-4 h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800' />
      ) : (
        next && (
          <button
            onClick={() => load(next)}
            className='mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          >
            载入更多
          </button>
        )
      )}
    </div>
  );
}

function MusicClient() {
  const [follows, setFollows] = useState<Follow[] | null>(null);
  const [pending, setPending] = useState<{ op: string; id: string }[]>([]);
  const [error, setError] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [opened, setOpened] = useState<Follow | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loop, setLoop] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteSong[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const applyState = (d: {
    follows: Follow[];
    pending: { op: string; id: string }[];
  }) => {
    setFollows(d.follows);
    setPending(d.pending);
  };

  useEffect(() => {
    fetchJson<{ follows: Follow[]; pending: { op: string; id: string }[] }>(
      '/api/music/follows',
      { cache: 'no-store' }
    )
      .then(applyState)
      .catch((e) => setError((e as Error).message));
    try {
      setLoop(localStorage.getItem(LOOP_KEY) === '1');
      setFavorites(
        sanitizeFavorites(
          JSON.parse(localStorage.getItem(MUSIC_FAVORITES_KEY) || '[]')
        )
      );
    } catch {
      // 读不到就用预设
    }
  }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      applyState(
        await fetchJson('/api/music/follows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
      return true;
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addFollow = async () => {
    const raw = input.trim();
    if (!raw) return;
    setBusy(true);
    setMsg(null);
    let found: Follow & { pending?: boolean };
    try {
      found = await fetchJson(
        `/api/ai-manju/resolve?q=${encodeURIComponent(raw)}`
      );
    } catch (e) {
      setBusy(false);
      setMsg({ text: (e as Error).message, error: true });
      return;
    }
    if (follows?.some((f) => f.id === found.id)) {
      setBusy(false);
      setMsg({ text: `「${found.name}」已经追踪了`, error: false });
      return;
    }
    if (
      await post({
        op: 'add',
        type: found.type,
        id: found.id,
        name: found.name,
      })
    ) {
      setInput('');
      setMsg({
        text: `已加入「${found.name}」。所有装置约 5～10 分钟后都会看到（要等站长的 Mac 同步）`,
        error: false,
      });
    }
  };

  const updateFavorites = (fn: (list: FavoriteSong[]) => FavoriteSong[]) =>
    setFavorites((cur) => {
      const next = fn(cur);
      try {
        localStorage.setItem(MUSIC_FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // 存不了就算了
      }
      return next;
    });

  // ── 播放 ──
  const play = (videos: YtVideo[], index: number, from: string) => {
    setQueue({ from, videos, index, startAt: index });
    setMinimized(false);
  };
  const jump = (index: number) =>
    setQueue((q) =>
      q && index >= 0 && index < q.videos.length
        ? { ...q, index, startAt: index }
        : q
    );
  const toggleLoop = () => {
    // 从现在这首重新交给播放器，免得跳回最早点的那首
    setQueue((q) => (q ? { ...q, startAt: q.index } : q));
    setLoop((v) => {
      try {
        localStorage.setItem(LOOP_KEY, v ? '0' : '1');
      } catch {
        // 存不了就算了
      }
      return !v;
    });
  };

  // 播放器自己换到下一首时，从它回报的讯息知道现在是哪首
  const startAt = queue?.startAt ?? -1;
  const queueVideos = queue?.videos;
  useEffect(() => {
    if (!queueVideos) return;
    let heard = false;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const m = parseYtMessage(e.data);
      if (!m) return;
      heard = true;
      if (m.videoId) {
        const i = queueVideos.findIndex((v) => v.videoId === m.videoId);
        if (i >= 0)
          setQueue((q) => (q && q.index !== i ? { ...q, index: i } : q));
      }
    };
    window.addEventListener('message', onMessage);
    // 要先丢一句 listening，播放器才会开始回报；它什么时候准备好不一定，每半秒丢一次
    let tries = 0;
    const timer: ReturnType<typeof setInterval> = setInterval(() => {
      if (heard || ++tries > 40) return clearInterval(timer);
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'music', channel: 'widget' }),
        '*'
      );
    }, 500);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    };
  }, [queueVideos, startAt, loop]);

  const current = queue ? queue.videos[queue.index] : null;
  const embed = queue
    ? musicEmbedUrl(
        queue.videos.map((v) => v.videoId),
        queue.startAt,
        loop
      )
    : '';

  const isFavorite =
    !!current && favorites.some((f) => f.videoId === current.videoId);

  const isPending = (id: string, op: string) =>
    pending.some((p) => p.id === id && p.op === op);

  return (
    <PageLayout activePath='/music'>
      <div className={`px-4 sm:px-10 py-4 sm:py-8 ${queue ? 'pb-72' : ''}`}>
        <div className='mb-6 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              音乐
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              追踪 YouTube 音乐频道，点一首就从那首开始一首接一首播
            </p>
          </div>
          <button
            onClick={() => setManageOpen(true)}
            className='rounded-full bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
            data-music-manage
          >
            管理追踪（{follows?.length ?? 0}）
          </button>
        </div>

        {error && <div className='text-red-500'>载入失败：{error}</div>}

        {follows && follows.length === 0 && (
          <div className='rounded-lg bg-gray-50 p-6 text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-300'>
            还没有追踪任何音乐频道。按右上角「管理追踪」，贴上 YouTube
            频道网址、@帐号或播放列表网址。
          </div>
        )}

        {opened ? (
          <ChannelView
            follow={opened}
            playingId={current?.videoId ?? null}
            onPlay={play}
            onBack={() => setOpened(null)}
          />
        ) : (
          <FavoritesRow
            favorites={favorites}
            playingId={current?.videoId ?? null}
            onPlay={play}
            onRemove={(id) =>
              updateFavorites((list) => list.filter((f) => f.videoId !== id))
            }
          />
        )}

        {!opened &&
          follows?.map((f) => (
            <ChannelRow
              key={f.id}
              follow={f}
              playingId={current?.videoId ?? null}
              onPlay={play}
              onOpen={() => {
                setOpened(f);
                window.scrollTo({ top: 0 });
              }}
            />
          ))}
      </div>

      {/* 播放器：贴在下方，可以边听边逛 */}
      {queue && current && (
        <div
          className='fixed bottom-16 left-2 right-2 z-40 rounded-xl bg-gray-900/95 p-2 text-white shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-[420px]'
          data-music-player
        >
          <div
            className={
              minimized
                ? 'hidden'
                : 'aspect-video overflow-hidden rounded-lg bg-black'
            }
          >
            <iframe
              ref={iframeRef}
              key={embed}
              src={embed}
              title={current.title}
              allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
              allowFullScreen
              className='h-full w-full'
            />
          </div>
          <div className='mt-2 flex items-center gap-2'>
            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-medium' data-music-now>
                {current.title}
              </div>
              <div className='truncate text-xs text-gray-400'>
                {queue.from} · 第 {queue.index + 1} / {queue.videos.length} 首
              </div>
            </div>
            <button
              onClick={() =>
                updateFavorites((list) => toggleFavorite(list, current))
              }
              className={`rounded-full px-3 py-1.5 text-sm ${
                isFavorite
                  ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              title={isFavorite ? '移出我的最爱' : '加入我的最爱'}
              data-music-fav
            >
              {isFavorite ? '★' : '☆'}
            </button>
            <button
              onClick={() => jump(queue.index - 1)}
              disabled={queue.index === 0}
              className='rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40'
              title='上一首'
            >
              ⏮
            </button>
            <button
              onClick={() => jump(queue.index + 1)}
              disabled={queue.index >= queue.videos.length - 1}
              className='rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40'
              title='下一首'
              data-music-next
            >
              ⏭
            </button>
            <button
              onClick={toggleLoop}
              className={`rounded-full px-3 py-1.5 text-sm ${
                loop
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              title={loop ? '整份清单循环播放中' : '播完就停'}
            >
              🔁
            </button>
            <button
              onClick={() => setMinimized((m) => !m)}
              className='rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20'
              title={minimized ? '显示画面' : '只留控制列'}
            >
              {minimized ? '▢' : '—'}
            </button>
            <button
              onClick={() => setQueue(null)}
              className='rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20'
              title='关闭'
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 管理追踪 */}
      {manageOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          onClick={() => setManageOpen(false)}
        >
          <div
            className='max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 dark:bg-gray-900'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-3 flex items-center justify-between'>
              <h2 className='text-lg font-bold text-gray-900 dark:text-gray-100'>
                管理追踪（{follows?.length ?? 0}）
              </h2>
              <button
                onClick={() => setManageOpen(false)}
                className='text-xl text-gray-400 hover:text-gray-700'
              >
                ×
              </button>
            </div>
            <form
              className='mb-2 flex gap-2'
              onSubmit={(e) => {
                e.preventDefault();
                addFollow();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='频道网址、@帐号、播放列表或影片网址'
                className='min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                data-music-input
              />
              <button
                type='submit'
                disabled={busy || !input.trim()}
                className='shrink-0 rounded-full bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-50'
              >
                追踪
              </button>
            </form>
            {msg && (
              <p
                className={`mb-2 text-sm ${
                  msg.error
                    ? 'text-red-500'
                    : 'text-green-600 dark:text-green-400'
                }`}
                data-music-msg
              >
                {msg.text}
              </p>
            )}
            <p className='mb-3 text-xs text-gray-500 dark:text-gray-400'>
              追踪名单全站共用，所有人、所有装置看到的都一样。贴影片网址会追踪发这支影片的频道。
            </p>
            <ul className='divide-y divide-gray-100 dark:divide-gray-800'>
              {follows?.map((f) => (
                <li
                  key={f.id}
                  className='flex items-center justify-between py-2'
                >
                  <span className='min-w-0 truncate text-sm text-gray-900 dark:text-gray-100'>
                    {f.name}
                    {f.type === 'playlist' && (
                      <span className='ml-1 text-xs text-gray-400'>
                        播放列表
                      </span>
                    )}
                    {isPending(f.id, 'add') && (
                      <span className='ml-1 text-xs text-amber-500'>
                        同步中
                      </span>
                    )}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`不再追踪「${f.name}」？全站都会看不到。`))
                        post({ op: 'rm', ...f });
                    }}
                    className='shrink-0 text-sm text-gray-400 hover:text-red-500'
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function MusicPage() {
  return <MusicClient />;
}
