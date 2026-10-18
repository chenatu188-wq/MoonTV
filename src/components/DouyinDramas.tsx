/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  type DouyinDrama,
  type DouyinEpisode,
  type DouyinFailed,
  douyinEmbedUrl,
  douyinPageUrl,
} from '@/lib/douyin-drama';
import { takeOverClick } from '@/lib/link-click';
import {
  clearVideoParams,
  douyinFromSearch,
  douyinHref,
} from '@/lib/video-links';

import HScroll from '@/components/HScroll';

interface State {
  updated: number;
  dramas: DouyinDrama[];
  failed: DouyinFailed[];
  pending: { op: 'add' | 'rm'; ref: string; name: string }[];
}

/** 每部剧看到第几集（只存在这台装置） */
const PROGRESS_KEY = 'moontv_douyin_progress';

function loadProgress(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveProgress(p: Record<string, number>) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // 无痕模式之类存不了就算了
  }
}

const formatDuration = (s: number) =>
  s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';

const button =
  'shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40';

/**
 * 抖音追剧：贴抖音短剧／合集（或其中任一集）的连结，整部剧的集数排成一列，
 * 用抖音官方嵌入播放器在站内播。名单全站共用，由站长的 Mac 抓集数（见 lib/douyin-drama.ts）。
 */
export default function DouyinDramas() {
  const [state, setState] = useState<State | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [playing, setPlaying] = useState<{
    drama: DouyinDrama;
    index: number;
  } | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tiktok-manju/douyin', { cache: 'no-store' });
      if (res.ok) setState(await res.json());
    } catch {
      // 下一轮再试
    }
  }, []);

  useEffect(() => {
    setProgress(loadProgress());
    refresh();
  }, [refresh]);

  // 有变更在等 Mac 处理时，每 30 秒看一次好了没
  const waiting = (state?.pending.length ?? 0) > 0;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/tiktok-manju/douyin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || '没有成功，请稍后再试', error: true });
        return false;
      }
      setState(data);
      return data;
    } catch {
      setMsg({ text: '连不上网站，请稍后再试', error: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const url = input.trim();
    if (!url) return;
    const data = (await send({ op: 'add', url })) as
      | (State & { ref: string })
      | false;
    if (!data) return;
    setInput('');
    const known = data.dramas.find(
      (d) => d.ref === data.ref || d.alias.includes(data.ref)
    );
    setMsg(
      known
        ? { text: `「${known.name}」已经在追了`, error: false }
        : {
            text: '已加入，约 5～10 分钟后出现在下面（要等站长的 Mac 抓完集数）',
            error: false,
          }
    );
  };

  const remove = (ref: string, name: string) => {
    if (confirm(`确定不再追「${name}」？全站都会看不到这部剧。`))
      send({ op: 'rm', ref, name });
  };

  const play = (drama: DouyinDrama, index: number) => {
    setPlaying({ drama, index });
    const next = { ...loadProgress(), [drama.id]: drama.episodes[index].ep };
    saveProgress(next);
    setProgress(next);
  };

  const epHref = (d: DouyinDrama, i: number) =>
    douyinHref(d.id, d.episodes[i].id);

  const close = useCallback(() => {
    setPlaying(null);
    clearVideoParams(['dy', 'ep']);
  }, []);

  // 在集数卡片上按右键「在新分页开启」开过来的：清单载入后直接播那一集（只做一次）
  const [deepLinked, setDeepLinked] = useState(false);
  useEffect(() => {
    if (!state || deepLinked) return;
    setDeepLinked(true);
    const want = douyinFromSearch(window.location.search);
    const drama = want && state.dramas.find((d) => d.id === want.dramaId);
    const index = drama
      ? drama.episodes.findIndex((e) => e.id === want.episodeId)
      : -1;
    if (drama && index >= 0) setPlaying({ drama, index });
  }, [state, deepLinked]);
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, close]);

  const adding = state?.pending.filter((p) => p.op === 'add') ?? [];
  const episode: DouyinEpisode | undefined =
    playing?.drama.episodes[playing.index];

  return (
    <section className='mb-8' data-douyin>
      <div className='mb-2 flex flex-wrap items-baseline gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          抖音追剧
        </h2>
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          贴抖音短剧／合集的分享连结，或其中任一集的连结，整部剧都会列出来
        </span>
      </div>

      <form
        className='mb-2 flex gap-2'
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='https://v.douyin.com/… 或整段分享文字'
          className='min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
          data-douyin-input
        />
        <button
          type='submit'
          disabled={busy || !input.trim()}
          className='shrink-0 rounded-full bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
        >
          追剧
        </button>
      </form>

      {msg && (
        <p
          className={`mb-2 text-sm ${
            msg.error ? 'text-red-500' : 'text-green-600 dark:text-green-400'
          }`}
          data-douyin-msg
        >
          {msg.text}
        </p>
      )}

      {adding.length > 0 && (
        <p className='mb-2 text-xs text-gray-500 dark:text-gray-400'>
          处理中 {adding.length} 部：站长的 Mac 抓完集数后会自动出现（Mac 关机时要等开机）
        </p>
      )}

      {state?.failed.map((f) => (
        <div
          key={f.ref}
          className='mb-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400'
        >
          <span className='min-w-0 truncate'>
            {f.ref} 抓不到：{f.error}
          </span>
          <button
            onClick={() => remove(f.ref, f.ref)}
            disabled={busy}
            className='shrink-0 underline hover:text-red-500'
          >
            移除
          </button>
        </div>
      ))}

      {state && state.dramas.length === 0 && adding.length === 0 && (
        <p className='text-sm text-gray-500 dark:text-gray-400'>
          还没有追任何抖音剧。在抖音 App 打开短剧 → 分享 → 复制链接，贴到上面。
        </p>
      )}

      {state?.dramas.map((d) => {
        const watched = progress[d.id];
        const resumeAt = watched
          ? d.episodes.findIndex((e) => e.ep === watched)
          : -1;
        return (
          <div key={d.id} className='mb-5' data-douyin-drama={d.id}>
            <div className='mb-2 flex flex-wrap items-center gap-x-2 gap-y-1'>
              <h3 className='text-sm font-bold text-gray-900 dark:text-gray-100'>
                {d.name}
              </h3>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                {d.author && `${d.author} · `}
                {d.episodes.length < d.total
                  ? `列出 ${d.episodes.length} / ${d.total} 集`
                  : `共 ${d.total} 集`}
                {d.stale && ' · 这次没更新到'}
              </span>
              {d.paid && (
                <span className='rounded bg-amber-500 px-1.5 text-[10px] text-white'>
                  付费剧，部分集数可能播不了
                </span>
              )}
              {resumeAt >= 0 && (
                <button
                  onClick={() => play(d, resumeAt)}
                  className='rounded-full bg-red-500 px-3 py-0.5 text-xs text-white hover:bg-red-400'
                >
                  ▶ 继续看第 {watched} 集
                </button>
              )}
              <a
                href={douyinPageUrl(d)}
                target='_blank'
                rel='noopener noreferrer'
                className='text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              >
                抖音 ↗
              </a>
              <button
                onClick={() => remove(d.ref, d.name)}
                disabled={busy}
                className='text-xs text-gray-400 hover:text-red-500'
              >
                不追了
              </button>
            </div>
            <HScroll resetKey={`douyin:${d.id}`} arrowTop='4rem'>
              {d.episodes.map((e, i) => (
                <a
                  key={e.id}
                  href={epHref(d, i)}
                  onClick={(e) => takeOverClick(e) && play(d, i)}
                  title={e.title}
                  className='group w-28 shrink-0 text-left'
                  data-douyin-ep
                >
                  <div
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 ${
                      watched === e.ep ? 'ring-2 ring-red-500' : ''
                    }`}
                  >
                    {e.cover && (
                      <img
                        src={e.cover}
                        alt={e.title}
                        loading='lazy'
                        referrerPolicy='no-referrer'
                        className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                      />
                    )}
                    <span className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                      第 {e.ep || i + 1} 集
                    </span>
                    {e.duration > 0 && (
                      <span className='absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white'>
                        {formatDuration(e.duration)}
                      </span>
                    )}
                  </div>
                  <div className='mt-1 line-clamp-2 text-xs text-gray-900 dark:text-gray-100'>
                    {e.title || d.name}
                  </div>
                </a>
              ))}
            </HScroll>
          </div>
        );
      })}

      {/* 播放器：抖音官方嵌入播放器 */}
      {playing && episode && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
          onClick={close}
        >
          <div
            className='flex max-h-full flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className='relative overflow-hidden rounded-lg bg-black'
              style={{
                height: 'min(78vh, calc((100vw - 2rem) * 16 / 9))',
                aspectRatio: '9 / 16',
              }}
            >
              <iframe
                key={episode.id}
                src={douyinEmbedUrl(episode.id)}
                title={episode.title || playing.drama.name}
                allow='autoplay; fullscreen; encrypted-media; picture-in-picture'
                allowFullScreen
                referrerPolicy='no-referrer'
                className='h-full w-full'
                data-douyin-player
              />
            </div>
            <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
              <span className='min-w-0 truncate text-sm text-gray-300'>
                {playing.drama.name} · 第 {episode.ep || playing.index + 1} 集
              </span>
              <div className='flex gap-2'>
                <button
                  disabled={playing.index === 0}
                  onClick={() => play(playing.drama, playing.index - 1)}
                  className={button}
                >
                  上一集
                </button>
                <button
                  disabled={playing.index >= playing.drama.episodes.length - 1}
                  onClick={() => play(playing.drama, playing.index + 1)}
                  className={button}
                  data-douyin-next
                >
                  下一集
                </button>
                <button onClick={close} className={button}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
