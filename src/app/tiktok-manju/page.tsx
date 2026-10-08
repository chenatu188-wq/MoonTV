/* eslint-disable @next/next/no-img-element */
'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { toSimplifiedFull } from '@/lib/t2s-table';
import {
  type PendingFollow,
  MAX_ACCOUNTS,
  PENDING_TTL_MS,
} from '@/lib/tiktok-follows';

import PageLayout from '@/components/PageLayout';

import type {
  TiktokManjuData,
  TiktokManjuVideo,
} from '@/app/api/tiktok-manju/route';

function timeAgo(sec: number): string {
  if (!sec) return '';
  const diff = Date.now() - sec * 1000;
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

function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 一次显示几支影片 */
const PAGE_SIZE = 120;

/** 搜寻比对用：转简体、去空白、转小写，繁简混打都找得到 */
const norm = (s: string) =>
  toSimplifiedFull(s).replace(/\s+/g, '').toLowerCase();

/** 浏览器自己也留一份待办：伺服器重新部署会忘记，下次开页由这里补送 */
const PENDING_KEY = 'moontv_tiktok_pending';

function readLocalPending(): PendingFollow[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(list)
      ? list.filter(
          (p) =>
            p &&
            typeof p.handle === 'string' &&
            (p.op === 'add' || p.op === 'rm') &&
            Date.now() - Number(p.at) < PENDING_TTL_MS
        )
      : [];
  } catch {
    return [];
  }
}

function writeLocalPending(list: PendingFollow[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // 无痕模式等写不进去就算了，只是少了重新部署后的补送
  }
}

function postFollow(op: 'add' | 'rm', handle: string, total: number) {
  return fetch('/api/tiktok-manju/follows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, handle, total }),
  }).then(async (r) => {
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
    return body as { handle: string; pending: PendingFollow[] };
  });
}

function TiktokManjuClient() {
  const [data, setData] = useState<TiktokManjuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>('all');
  const [playing, setPlaying] = useState<TiktokManjuVideo | null>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  // 追踪管理
  const [manageOpen, setManageOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<PendingFollow[]>([]);
  const resent = useRef(false);

  const load = useCallback(() => {
    return fetch('/api/tiktok-manju?v=2')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body as TiktokManjuData;
      })
      .then((d) => {
        setData(d);
        setError(null);

        // 资料里已经看得到结果的待办划掉；其余的跟伺服器的合并
        const known = new Set(
          [...d.accounts, ...d.failed].map((x) => x.handle.toLowerCase())
        );
        const alive = (p: PendingFollow) =>
          p.op === 'add' ? !known.has(p.handle) : known.has(p.handle);
        const server = (d.pending ?? []).filter(alive);
        const local = readLocalPending().filter(alive);
        const merged = [...server];
        const lost: PendingFollow[] = [];
        for (const p of local) {
          if (!server.some((s) => s.handle === p.handle)) {
            merged.push(p);
            lost.push(p);
          }
        }
        writeLocalPending(merged);
        setPending(merged);

        // 伺服器不记得的（重新部署过）补送一次
        if (lost.length && !resent.current) {
          resent.current = true;
          lost.forEach((p) =>
            postFollow(p.op, p.handle, 0).catch(() => undefined)
          );
        }
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 有变更在等的时候，每 30 秒看一次处理好了没
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [pending.length, load]);

  const submitFollow = useCallback(
    async (op: 'add' | 'rm', raw: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const total = data?.accounts.length ?? 0;
        const res = await postFollow(op, raw, total);
        const known = new Set(
          [...(data?.accounts ?? []), ...(data?.failed ?? [])].map((x) =>
            x.handle.toLowerCase()
          )
        );
        if (op === 'add' && known.has(res.handle)) {
          setMsg({ ok: true, text: `@${res.handle} 已经在追踪了` });
          return;
        }
        const next = [
          ...pending.filter((p) => p.handle !== res.handle),
          { op, handle: res.handle, at: Date.now() },
        ];
        writeLocalPending(next);
        setPending(next);
        setAddInput('');
        setMsg({
          ok: true,
          text:
            op === 'add'
              ? `已送出 @${res.handle}，大约 5 到 10 分钟后会出现影片`
              : `已送出，@${res.handle} 大约 5 到 10 分钟后移除`,
        });
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      } finally {
        setBusy(false);
      }
    },
    [data, pending]
  );

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

  // 搜寻只搜已经抓下来的影片（每个帐号最新 30 支），可用空白隔开多个关键字
  const words = norm(query) ? query.split(/\s+/).map(norm).filter(Boolean) : [];
  const videos =
    data?.videos.filter((v) => {
      if (active !== 'all' && v.handle !== active) return false;
      if (words.length === 0) return true;
      const hay = norm(`${v.title} ${v.name} ${v.handle}`);
      return words.every((w) => hay.includes(w));
    }) ?? [];
  const shown = videos.slice(0, limit);
  // 完全没有旧资料可顶的帐号才提示；有旧资料的照常显示，不打扰
  const missing = data?.failed.filter((f) => !f.stale) ?? [];

  return (
    <PageLayout activePath='/tiktok-manju'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            TikTok 漫剧
          </h1>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            追踪 TikTok 上的 AI 漫剧帐号，用官方播放器播放
            {data && ` · 资料更新于 ${timeAgo(data.updated)}`}
          </p>
        </div>

        {/* 搜寻 */}
        {data && (
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <div className='relative w-full max-w-md'>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
                placeholder='搜寻片名、标签或帐号（繁简皆可）'
                className='w-full rounded-full border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm text-gray-900 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
              />
              {query && (
                <button
                  aria-label='清除搜寻'
                  onClick={() => setQuery('')}
                  className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 text-lg leading-none text-gray-500 hover:text-gray-900 dark:hover:text-white'
                >
                  ×
                </button>
              )}
            </div>
            {words.length > 0 && (
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                找到 {videos.length} 支
                {active !== 'all' && '（只搜目前选的帐号）'}
              </span>
            )}
          </div>
        )}

        {/* 帐号筛选 */}
        {data && (
          <div className='mb-6 flex flex-wrap items-center gap-2'>
            <button
              onClick={() => {
                setMsg(null);
                setManageOpen(true);
              }}
              className='px-3 py-1.5 rounded-full text-sm border border-dashed border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
            >
              ＋ 管理追踪
              {pending.length > 0 && `（${pending.length} 笔处理中）`}
            </button>
            {[{ handle: 'all', name: '全部' }, ...data.accounts].map((a) => (
              <button
                key={a.handle}
                onClick={() => {
                  setActive(a.handle);
                  setLimit(PAGE_SIZE);
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  active === a.handle
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className='text-red-600 dark:text-red-400'>
            载入失败：{error}
          </div>
        )}

        {!data && !error && (
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className='animate-pulse'>
                <div className='aspect-[9/16] rounded-lg bg-gray-200 dark:bg-gray-800' />
                <div className='mt-2 h-4 rounded bg-gray-200 dark:bg-gray-800' />
              </div>
            ))}
          </div>
        )}

        {missing.length > 0 && (
          <div className='mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'>
            这些帐号暂时抓不到：{missing.map((f) => `@${f.handle}`).join('、')}
          </div>
        )}

        {data && videos.length === 0 && (
          <div className='text-gray-500 dark:text-gray-400'>
            {words.length > 0
              ? `找不到「${query.trim()}」。这里只搜得到已追踪帐号最近的影片，搜不到整个 TikTok`
              : '暂无内容'}
          </div>
        )}

        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
          {shown.map((v) => (
            <button
              key={v.id}
              onClick={() => setPlaying(v)}
              className='group text-left'
            >
              <div className='relative aspect-[9/16] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                {v.thumbnail && (
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    loading='lazy'
                    referrerPolicy='no-referrer'
                    className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                  />
                )}
                {v.duration ? (
                  <span className='absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white'>
                    {formatDuration(v.duration)}
                  </span>
                ) : null}
              </div>
              <h3 className='mt-2 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
                {v.title || '（无标题）'}
              </h3>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                {v.name}
                {v.views != null && ` · ${formatViews(v.views)}`}
                {v.published ? ` · ${timeAgo(v.published)}` : ''}
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

      {/* 管理追踪 */}
      {manageOpen && data && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
          onClick={close}
        >
          <div
            className='flex max-h-full w-full max-w-lg flex-col rounded-xl bg-white p-5 dark:bg-gray-900'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-3 flex items-center justify-between'>
              <h2 className='text-lg font-bold text-gray-900 dark:text-gray-100'>
                管理追踪（{data.accounts.length}／{MAX_ACCOUNTS}）
              </h2>
              <button
                onClick={close}
                aria-label='关闭'
                className='rounded-full px-2 text-2xl leading-none text-gray-500 hover:text-gray-900 dark:hover:text-white'
              >
                ×
              </button>
            </div>

            <form
              className='flex gap-2'
              onSubmit={(e) => {
                e.preventDefault();
                if (addInput.trim()) submitFollow('add', addInput);
              }}
            >
              <input
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                placeholder='@帐号 或 https://www.tiktok.com/@帐号'
                className='min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
              />
              <button
                type='submit'
                disabled={busy || !addInput.trim()}
                className='shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50'
              >
                追踪
              </button>
            </form>
            <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              追踪名单是全站共用的，所有人、所有装置看到的都一样。送出后要等 5
              到 10
              分钟才会生效。帐号若关闭了「允许嵌入」或限定地区，会抓不到影片。
            </p>
            {msg && (
              <p
                className={`mt-2 text-sm ${
                  msg.ok
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {msg.text}
              </p>
            )}

            <div className='mt-4 min-h-0 flex-1 overflow-y-auto'>
              {pending.length > 0 && (
                <ul className='mb-3 divide-y divide-gray-200 rounded-lg bg-amber-50 px-3 dark:divide-gray-700 dark:bg-amber-900/20'>
                  {pending.map((p) => (
                    <li
                      key={p.handle}
                      className='flex items-center justify-between gap-3 py-2 text-sm'
                    >
                      <span className='min-w-0 truncate text-amber-800 dark:text-amber-300'>
                        {p.op === 'add' ? '加入中' : '移除中'} @{p.handle}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ul className='divide-y divide-gray-200 dark:divide-gray-800'>
                {[
                  ...data.accounts.map((a) => ({ ...a, bad: false })),
                  ...data.failed
                    .filter(
                      (f) => !data.accounts.some((a) => a.handle === f.handle)
                    )
                    .map((f) => ({
                      handle: f.handle,
                      name: '抓不到影片',
                      bad: true,
                    })),
                ].map((a) => {
                  const removing = pending.some(
                    (p) => p.op === 'rm' && p.handle === a.handle.toLowerCase()
                  );
                  return (
                    <li
                      key={a.handle}
                      className='flex items-center justify-between gap-3 py-2'
                    >
                      <a
                        href={`https://www.tiktok.com/@${a.handle}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='min-w-0'
                      >
                        <div
                          className={`truncate text-sm ${
                            a.bad
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {a.name}
                        </div>
                        <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                          @{a.handle}
                        </div>
                      </a>
                      <button
                        disabled={busy || removing}
                        onClick={() => {
                          if (
                            confirm(
                              `确定不再追踪「${a.name}」@${a.handle}？全站都会看不到这个帐号。`
                            )
                          )
                            submitFollow('rm', a.handle);
                        }}
                        className='shrink-0 rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:border-red-500 hover:text-red-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400'
                      >
                        {removing ? '移除中' : '移除'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 播放器：TikTok 官方嵌入播放器，直式影片 */}
      {playing && (
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
                src={`https://www.tiktok.com/player/v1/${playing.id}?autoplay=1&rel=0&description=0&music_info=0`}
                title={playing.title}
                allow='autoplay; fullscreen; encrypted-media; picture-in-picture'
                allowFullScreen
                className='h-full w-full'
              />
            </div>
            <div className='mt-3 flex items-center justify-between gap-3'>
              <a
                href={`https://www.tiktok.com/@${playing.handle}/video/${playing.id}`}
                target='_blank'
                rel='noopener noreferrer'
                className='min-w-0 truncate text-sm text-gray-300 hover:text-white'
              >
                {playing.name} ↗
              </a>
              <button
                onClick={close}
                className='shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20'
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function TiktokManjuPage() {
  return (
    <Suspense>
      <TiktokManjuClient />
    </Suspense>
  );
}
