/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type PendingFbFollow,
  FB_PENDING_TTL_MS,
  MAX_FB_PAGES,
} from '@/lib/fb-follows';
import { nextFbVideo } from '@/lib/fb-next';

import PageLayout from '@/components/PageLayout';

import type { FbData, FbVideo } from '@/app/api/facebook/route';

/**
 * 网站重新部署会清掉伺服器记忆体里的待办，浏览器自己也留一份，下次开页补送
 * （跟 TikTok 漫剧同一招）
 */
const PENDING_KEY = 'moontv_fb_pending';
const AUTO_NEXT_KEY = 'moontv_fb_auto_next';
// 音量跟静音记在本机，换下一支影片时套回去，不会又变回最大声
const VOLUME_KEY = 'moontv_fb_volume';

function restoreVolume(el: HTMLVideoElement) {
  try {
    const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) || 'null');
    if (!saved) return;
    if (typeof saved.volume === 'number') {
      el.volume = Math.min(1, Math.max(0, saved.volume));
    }
    el.muted = !!saved.muted;
  } catch {
    // 读不到就用预设音量
  }
}

function saveVolume(el: HTMLVideoElement) {
  try {
    localStorage.setItem(
      VOLUME_KEY,
      JSON.stringify({ volume: el.volume, muted: el.muted })
    );
  } catch {
    // 存不了就算了
  }
}

function formatDuration(sec?: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function readLocalPending(): PendingFbFollow[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(list)
      ? list.filter(
          (p) =>
            p &&
            (p.op === 'add' || p.op === 'rm') &&
            typeof p.page === 'string' &&
            Date.now() - Number(p.at) < FB_PENDING_TTL_MS
        )
      : [];
  } catch {
    return [];
  }
}

function writeLocalPending(list: PendingFbFollow[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // 无痕模式就不留
  }
}

async function postFollow(op: 'add' | 'rm', page: string, total: number) {
  const r = await fetch('/api/facebook/follows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, page, total }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d as { page: string; pending: PendingFbFollow[] };
}

/** 播放器用 FB 官方的嵌入播放器 */
function embedSrc(v: FbVideo): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    v.href
  )}&show_text=false&autoplay=true&width=1280`;
}

function timeAgo(sec: number): string {
  const min = Math.floor((Date.now() / 1000 - sec) / 60);
  if (min < 60) return `${Math.max(min, 1)} 分钟前`;
  if (min < 1440) return `${Math.floor(min / 60)} 小时前`;
  return `${Math.floor(min / 1440)} 天前`;
}

function FacebookClient() {
  const [data, setData] = useState<FbData | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [playing, setPlaying] = useState<FbVideo | null>(null);
  /** 影片档播不了（网址过期之类）就退回 FB 嵌入播放器 */
  const [useEmbed, setUseEmbed] = useState(false);
  useEffect(() => setUseEmbed(false), [playing]);
  /** 播完自动接下一支（同一部剧优先接下一季） */
  const [autoNext, setAutoNext] = useState(true);
  useEffect(() => {
    try {
      setAutoNext(localStorage.getItem(AUTO_NEXT_KEY) !== '0');
    } catch {
      // 读不到就用预设
    }
  }, []);
  const toggleAutoNext = () =>
    setAutoNext((on) => {
      try {
        localStorage.setItem(AUTO_NEXT_KEY, on ? '0' : '1');
      } catch {
        // 无痕模式就只记这一次
      }
      return !on;
    });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/facebook', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setData(d);
      setError('');
      return d as FbData;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  // 开页：载入资料，顺便把浏览器留着、伺服器却不见了的待办补送
  useEffect(() => {
    load().then((d) => {
      if (!d) return;
      const known = new Set(d.pages.map((p) => p.page.toLowerCase()));
      const server = new Set(
        (d.pending ?? []).map((p) => `${p.op}:${p.page.toLowerCase()}`)
      );
      const local = readLocalPending().filter((p) => {
        const present = known.has(p.page.toLowerCase());
        return p.op === 'add' ? !present : present;
      });
      writeLocalPending(local);
      const missing = local.filter(
        (p) => !server.has(`${p.op}:${p.page.toLowerCase()}`)
      );
      if (missing.length)
        Promise.all(
          missing.map((p) =>
            postFollow(p.op, p.page, d.pages.length).catch(() => null)
          )
        ).then(load);
    });
  }, [load]);

  // 有待办时每 30 秒看一次新资料
  const pendingCount = data?.pending?.length ?? 0;
  useEffect(() => {
    if (!pendingCount) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [pendingCount, load]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPlaying(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  const follow = async (op: 'add' | 'rm', page: string) => {
    setBusy(true);
    setMsg('');
    try {
      const d = await postFollow(op, page, data?.pages.length ?? 0);
      writeLocalPending([
        ...readLocalPending().filter(
          (p) => p.page.toLowerCase() !== d.page.toLowerCase()
        ),
        { op, page: d.page, at: Date.now() },
      ]);
      setData((x) => (x ? { ...x, pending: d.pending } : x));
      if (op === 'add') setInput('');
      setMsg(
        op === 'add'
          ? `已送出「${d.page}」，站长的 Mac 约 5 分钟内会去抓，抓好自动出现`
          : `已送出移除「${d.page}」，约 5 分钟内生效`
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 「全部」：每个粉专最新的轮流排，免得一个粉专洗版
  const videos = useMemo(() => {
    const list = (data?.videos ?? []).filter(
      (v) => !filter || v.page === filter
    );
    // 有上传时间就新的在前；没有的照粉专页上的顺序
    return [...list].sort(
      (a, b) => (b.published ?? 0) - (a.published ?? 0) || a.order - b.order
    );
  }, [data, filter]);
  const upNext = playing ? nextFbVideo(playing, videos) : null;

  const pending = data?.pending ?? [];
  const nameOf = (page: string) =>
    data?.pages.find((p) => p.page === page)?.name || page;

  return (
    <PageLayout activePath='/facebook'>
      <div className='px-4 py-6 sm:px-10'>
        <div className='mb-4 flex flex-col gap-3'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              FB 影片
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              追踪的 Facebook 粉专最新影片，直接在这里播
              {data?.updated
                ? ` · ${timeAgo(data.updated)}更新（每 6 小时）`
                : ''}
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) follow('add', input.trim());
            }}
            className='flex w-full max-w-xl gap-2'
            data-fb-follow
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='贴粉专网址，例 facebook.com/NASA'
              className='min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
            />
            <button
              disabled={busy || !input.trim()}
              className='shrink-0 rounded-full bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50'
            >
              ＋ 追踪粉专
            </button>
          </form>
        </div>

        {msg && (
          <div className='mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300'>
            {msg}
          </div>
        )}
        {pending.length > 0 && (
          <div
            className='mb-3 text-xs text-amber-700 dark:text-amber-400'
            data-fb-pending
          >
            等站长的 Mac 处理中：
            {pending
              .map((p) => `${p.op === 'add' ? '加入' : '移除'} ${p.page}`)
              .join('、')}
            （Mac 关机时不会生效，24 小时后作废）
          </div>
        )}
        {error && (
          <div className='mb-3 text-sm text-red-600 dark:text-red-400'>
            {error}
          </div>
        )}

        {data && data.pages.length > 0 && (
          <div className='mb-4 flex flex-wrap gap-2' data-fb-pages>
            <button
              onClick={() => setFilter(null)}
              className={`rounded-full px-3 py-1 text-sm ${
                !filter
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              全部（{data.pages.length}/{MAX_FB_PAGES}）
            </button>
            {data.pages.map((p) => (
              <span
                key={p.page}
                className={`flex items-center rounded-full text-sm ${
                  filter === p.page
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                <button
                  onClick={() => setFilter(filter === p.page ? null : p.page)}
                  className='max-w-[14rem] truncate py-1 pl-3 pr-1'
                  title={p.name}
                >
                  {p.name}
                </button>
                <button
                  onClick={() =>
                    confirm(`不再追踪「${p.name}」？`) && follow('rm', p.page)
                  }
                  aria-label={`移除 ${p.name}`}
                  title='移除这个粉专'
                  className='px-2 py-1 opacity-60 hover:opacity-100'
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {data && data.failed.length > 0 && (
          <div className='mb-3 text-xs text-gray-500 dark:text-gray-400'>
            这次没抓到：
            {data.failed
              .map(
                (f) =>
                  `${nameOf(f.page)}（${f.error}${
                    f.stale ? '，先显示上次的' : ''
                  }）`
              )
              .join('、')}
          </div>
        )}

        {!data && !error && (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className='aspect-video animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800'
              />
            ))}
          </div>
        )}

        {data && data.pages.length === 0 && pending.length === 0 && (
          <div className='rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400'>
            还没追踪任何粉专。在上方贴上 Facebook 粉专的网址，按「＋
            追踪粉专」。
          </div>
        )}

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {videos.map((v) => (
            <a
              key={`${v.page}:${v.id}`}
              href={v.href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                  return;
                e.preventDefault();
                setPlaying(v);
              }}
              className='group text-left'
              data-fb-video
            >
              <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  loading='lazy'
                  referrerPolicy='no-referrer'
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
                {v.duration && (
                  <span className='absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white'>
                    {formatDuration(v.duration)}
                  </span>
                )}
                <div className='absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30'>
                  <div className='rounded-full bg-white/90 p-3 opacity-0 transition-opacity group-hover:opacity-100'>
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
                {v.title || '（无标题）'}
              </h3>
              <p className='mt-1 truncate text-xs text-gray-500 dark:text-gray-400'>
                {v.name}
                {v.published ? ` · ${timeAgo(v.published)}` : ''}
              </p>
            </a>
          ))}
        </div>
      </div>

      {playing && (
        <div
          className='fixed inset-0 z-[600] flex items-center justify-center bg-black/85 p-4'
          onClick={() => setPlaying(null)}
          data-fb-player
        >
          <div
            className='flex w-[min(100%,calc((100dvh-8rem)*16/9))] flex-col gap-2'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex flex-wrap items-center gap-2'>
              <div className='min-w-0 flex-1 basis-full truncate text-sm text-white sm:basis-0'>
                {playing.title}
              </div>
              {playing.mp4 && !useEmbed && (
                <button
                  onClick={toggleAutoNext}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm text-white ${
                    autoNext
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                  title='播完自动接下一支；同一部剧会先接下一季'
                  data-fb-auto-next
                >
                  {autoNext ? '✓ 自动连播' : '自动连播：关'}
                </button>
              )}
              {upNext && (
                <button
                  onClick={() => setPlaying(upNext)}
                  className='shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
                  title={upNext.title}
                  data-fb-next
                >
                  下一支 ⏭
                </button>
              )}
              <a
                href={playing.href}
                target='_blank'
                rel='noopener noreferrer'
                className='shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
              >
                在 Facebook 打开
              </a>
              <button
                onClick={() => setPlaying(null)}
                className='shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-500'
              >
                ✕ 关闭
              </button>
            </div>
            {playing.mp4 && !useEmbed ? (
              <video
                key={playing.id}
                src={playing.mp4}
                poster={playing.thumbnail}
                controls
                autoPlay
                playsInline
                onError={() => setUseEmbed(true)}
                onLoadedMetadata={(e) => restoreVolume(e.currentTarget)}
                onVolumeChange={(e) => saveVolume(e.currentTarget)}
                onEnded={() => autoNext && upNext && setPlaying(upNext)}
                className='max-h-[calc(100dvh-8rem)] w-full rounded-lg bg-black'
                data-fb-mp4
              />
            ) : (
              <div className='aspect-video w-full overflow-hidden rounded-lg bg-black'>
                <iframe
                  key={playing.id}
                  src={embedSrc(playing)}
                  className='h-full w-full'
                  allow='autoplay; encrypted-media; picture-in-picture; web-share'
                  allowFullScreen
                  title={playing.title}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function FacebookPage() {
  return <FacebookClient />;
}
