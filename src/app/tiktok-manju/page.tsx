/* eslint-disable @next/next/no-img-element */
'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { promoKeywordOf } from '@/lib/hongguo-search';
import { toSimplifiedFull } from '@/lib/t2s-table';
import {
  type PendingFollow,
  MAX_ACCOUNTS,
  PENDING_TTL_MS,
} from '@/lib/tiktok-follows';
import { classifyTiktokUrl } from '@/lib/tiktok-link';
import { usePlayerSeconds, useWatchMarks } from '@/lib/use-watch-marks';
import { resumeFrom } from '@/lib/watch-marks';

import DouyinDramas from '@/components/DouyinDramas';
import HScroll from '@/components/HScroll';
import PageLayout from '@/components/PageLayout';
import TiktokShortDrama from '@/components/TiktokShortDrama';
import WatchLaterStrip from '@/components/WatchLaterStrip';

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

/** 每个订阅频道最多显示最新几支；抓取端也同步保留这个数量。 */
const VIDEOS_PER_CHANNEL = 60;

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

/** 贴上来的 TikTok 连结换算出来的结果（见 api/tiktok-manju/link） */
type LinkResult =
  | {
      kind: 'video';
      handle: string;
      videoId: string;
      title: string;
      name: string;
      thumbnail: string;
    }
  | { kind: 'profile'; handle: string }
  | { kind: 'drama'; dramaId: string };

function resolveLink(text: string): Promise<LinkResult> {
  return fetch(`/api/tiktok-manju/link?url=${encodeURIComponent(text)}`).then(
    async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      return body as LinkResult;
    }
  );
}

function postFollow(
  op: 'add' | 'rm',
  handle: string,
  total: number,
  videoId?: string
) {
  return fetch('/api/tiktok-manju/follows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, handle, total, videoId }),
  }).then(async (r) => {
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
    return body as { handle: string; pending: PendingFollow[] };
  });
}

/**
 * 帐号存在，只是没有一般影片（短剧专区的上传帐号）。
 * 看 yt-dlp 回报的「没有发布任何影片」；TikTok 限流时会改回别种错误，
 * 所以 Mac 查过、附了 secUid 的也算。
 */
const hasNoPosts = (f: { error: string; secUid?: string }) =>
  !!f.secUid || f.error.includes('does not have any videos posted');

function TiktokManjuClient() {
  const [data, setData] = useState<TiktokManjuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<TiktokManjuVideo | null>(null);
  const [query, setQuery] = useState('');
  // 搜寻框贴上 TikTok 连结时，查出是哪支影片／哪个帐号
  const [linkResult, setLinkResult] = useState<{
    text: string;
    result: LinkResult | null;
    error: string | null;
  } | null>(null);
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
    async (op: 'add' | 'rm', raw: string, knownVideoId?: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const total = data?.accounts.length ?? 0;
        // 贴的是影片连结或分享短网址：先查出是哪个帐号
        let input = raw;
        let videoId = knownVideoId;
        if (classifyTiktokUrl(raw)) {
          const link = await resolveLink(raw);
          if (link.kind === 'drama')
            throw new Error(
              '这是短剧专区的连结，请改贴上传者的 @帐号（短剧页上点上传者名称）'
            );
          input = link.handle;
          if (link.kind === 'video') videoId = link.videoId;
        }
        const res = await postFollow(op, input, total, videoId);
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

  useEffect(() => {
    if (!classifyTiktokUrl(query)) {
      setLinkResult(null);
      return;
    }
    let cancelled = false;
    setLinkResult({ text: query, result: null, error: null });
    resolveLink(query)
      .then(
        (result) =>
          !cancelled && setLinkResult({ text: query, result, error: null })
      )
      .catch(
        (e) =>
          !cancelled &&
          setLinkResult({
            text: query,
            result: null,
            error: (e as Error).message,
          })
      );
    return () => {
      cancelled = true;
    };
  }, [query]);

  // 打开播放器时锁背景滚动
  useEffect(() => {
    document.body.style.overflow = playing || manageOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [playing, manageOpen]);

  // 标记，下次继续看：存在浏览器，每台装置各自一份
  const { marks, mark, unmark } = useWatchMarks<TiktokManjuVideo>(
    'moontv_tiktok_manju_marks'
  );
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playingId = playing?.id ?? null;
  // 只在换影片时决定从哪里开始播：播到一半按标记不能让播放器重新载入
  const startAt = useMemo(
    () =>
      resumeFrom(
        marksRef.current.find((m) => m.id === playingId)?.seconds ?? 0
      ),
    [playingId]
  );
  const position = usePlayerSeconds('tiktok', playerRef, playingId, startAt);
  const playingMarked = marks.some((m) => m.id === playingId);
  const saveMark = useCallback(
    (v: TiktokManjuVideo) => mark(v.id, v, position.current),
    [mark, position]
  );

  const close = useCallback(() => {
    // 已经标记的影片，关掉时把进度更新到最新
    if (playing && marksRef.current.some((m) => m.id === playing.id)) {
      saveMark(playing);
    }
    setPlaying(null);
    setManageOpen(false);
  }, [playing, saveMark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // 搜寻只搜已经抓下来的影片（每个帐号最新 60 支），可用空白隔开多个关键字
  // 搜寻框贴的是 TikTok 连结时不当关键字，改成「找这支影片／这个帐号」
  const queryIsLink = classifyTiktokUrl(query) !== null;
  const words =
    !queryIsLink && norm(query)
      ? query.split(/\s+/).map(norm).filter(Boolean)
      : [];
  /** 频道顺序跟订阅名单一致；每一列从新到旧，最多 60 支。 */
  const channelRows = useMemo(() => {
    if (!data) return [];
    return data.accounts.map((account) => {
      const videos = data.videos
        .filter((v) => v.handle === account.handle)
        .filter((v) => {
          if (words.length === 0) return true;
          const hay = norm(`${v.title} ${v.name} ${v.handle}`);
          return words.every((w) => hay.includes(w));
        })
        .sort((a, b) => b.published - a.published)
        .slice(0, VIDEOS_PER_CHANNEL);
      return { account, videos };
    });
  }, [data, words]);
  const visibleVideoCount = channelRows.reduce(
    (sum, row) => sum + row.videos.length,
    0
  );
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

        {/* 继续观看：在播放器按了标记的影片 */}
        <WatchLaterStrip
          portrait
          items={marks.map((m) => ({
            id: m.id,
            title: m.video.title,
            // 缩图网址约两天半过期，资料里还有这支就用新的
            thumbnail:
              data?.videos.find((v) => v.id === m.id)?.thumbnail ??
              m.video.thumbnail,
            note: m.video.name,
            seconds: m.seconds,
          }))}
          onPlay={(id) => {
            const m = marks.find((x) => x.id === id);
            if (m) setPlaying(m.video);
          }}
          onRemove={unmark}
        />

        {/* 抖音追剧：贴抖音短剧连结，整部剧的集数站内播 */}
        <DouyinDramas />

        {/* TikTok 短剧专区的片单：站内播不了，点了另开 TikTok */}
        <TiktokShortDrama
          creators={missing.filter((f) => hasNoPosts(f)).map((f) => f.handle)}
        />

        {/* 推荐：TikTok 不开放搜寻，没办法在站内列出没追踪的帐号，改连到 TikTok 自己的推荐页 */}
        <div className='mb-6 flex flex-wrap items-center gap-2'>
          <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
            推荐榜
          </h2>
          <a
            href='https://www.tiktok.com/foryou'
            target='_blank'
            rel='noopener noreferrer'
            className='rounded-full bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
          >
            TikTok 为您推荐 ↗
          </a>
          <a
            href={`https://www.tiktok.com/search?q=${encodeURIComponent(
              'AI漫剧'
            )}`}
            target='_blank'
            rel='noopener noreferrer'
            className='rounded-full bg-gray-100 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          >
            在 TikTok 搜「AI漫剧」 ↗
          </a>
          <span className='text-xs text-gray-500 dark:text-gray-400'>
            看到喜欢的帐号，把 @帐号 贴到下面的「＋ 管理追踪」
          </span>
        </div>

        {/* 搜寻 */}
        {data && (
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <div className='relative w-full max-w-md'>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='搜寻片名、标签或帐号，或贴上 TikTok 影片连结'
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
                找到 {visibleVideoCount} 支
              </span>
            )}
          </div>
        )}

        {/* 贴上 TikTok 连结：直接播这支，或追踪发这支影片的帐号 */}
        {linkResult && (
          <div
            className='mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900'
            data-link-result
          >
            {linkResult.error ? (
              <span className='text-sm text-red-600 dark:text-red-400'>
                {linkResult.error}
              </span>
            ) : !linkResult.result ? (
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                正在查这个连结…
              </span>
            ) : linkResult.result.kind === 'drama' ? (
              <>
                <span className='text-sm text-gray-700 dark:text-gray-300'>
                  这是 TikTok 短剧专区的剧，站内播不了
                </span>
                <a
                  href={`https://www.tiktok.com/shortdrama/episode/${linkResult.result.dramaId}/1`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='rounded-full bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-400'
                >
                  到 TikTok 看 ↗
                </a>
              </>
            ) : (
              (() => {
                const r = linkResult.result;
                const handle = r.handle;
                const followed = [
                  ...(data?.accounts ?? []),
                  ...(data?.failed ?? []),
                ].some((a) => a.handle.toLowerCase() === handle);
                const adding = pending.some(
                  (p) => p.op === 'add' && p.handle === handle
                );
                return (
                  <>
                    {r.kind === 'video' && r.thumbnail && (
                      <img
                        src={r.thumbnail}
                        alt={r.title}
                        referrerPolicy='no-referrer'
                        className='h-24 w-[4.25rem] shrink-0 rounded object-cover'
                      />
                    )}
                    <div className='min-w-0 flex-1'>
                      {r.kind === 'video' && (
                        <div className='line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
                          {r.title || '（没有说明文字）'}
                        </div>
                      )}
                      <div className='text-sm text-gray-500 dark:text-gray-400'>
                        {r.kind === 'video' && r.name ? `${r.name} · ` : ''}@
                        {handle}
                        {followed && ' · 已追踪'}
                      </div>
                    </div>
                    {r.kind === 'video' && (
                      <button
                        onClick={() =>
                          setPlaying({
                            id: r.videoId,
                            handle,
                            name: r.name || handle,
                            title: r.title,
                            published: 0,
                            thumbnail: r.thumbnail,
                            views: null,
                            duration: null,
                          })
                        }
                        className='rounded-full bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-400'
                        data-link-play
                      >
                        ▶ 播放这支
                      </button>
                    )}
                    {followed ? null : adding ? (
                      <span className='rounded-full bg-gray-200 px-4 py-1.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300'>
                        加入中
                      </span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() =>
                          submitFollow(
                            'add',
                            handle,
                            r.kind === 'video' ? r.videoId : undefined
                          )
                        }
                        className='rounded-full bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-50'
                        data-link-follow
                      >
                        ＋ 追踪 @{handle}
                      </button>
                    )}
                  </>
                );
              })()
            )}
            {msg && (
              <span
                className={`w-full text-xs ${
                  msg.ok
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {msg.text}
              </span>
            )}
          </div>
        )}

        {/* 订阅管理 */}
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
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              所有订阅频道依名单顺序排列，每个频道最新 60 部
            </span>
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
          <div className='mb-4 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'>
            {missing.some((f) => !hasNoPosts(f)) && (
              <div>
                这些帐号暂时抓不到：
                {missing
                  .filter((f) => !hasNoPosts(f))
                  .map((f) => `@${f.handle}`)
                  .join('、')}
              </div>
            )}
            {missing.some((f) => hasNoPosts(f)) && (
              <div>
                这些帐号已追踪，但帐号下没有一般影片（多半是 TikTok
                短剧专区的帐号，他上传的短剧列在上面「TikTok
                短剧」那一区的下方）：
                {missing
                  .filter((f) => hasNoPosts(f))
                  .map((f) => `@${f.handle}`)
                  .join('、')}
              </div>
            )}
          </div>
        )}

        {data && visibleVideoCount === 0 && (
          <div className='text-gray-500 dark:text-gray-400'>
            {words.length > 0
              ? `找不到「${query.trim()}」。这里只搜得到已追踪帐号最近的影片，搜不到整个 TikTok`
              : '暂无内容'}
          </div>
        )}

        {/* 频道目录：频道很多，点名字直接跳到那一列 */}
        {visibleVideoCount > 0 && (
          <div className='mb-6' data-channel-index>
            <h2 className='mb-2 text-base font-bold text-gray-900 dark:text-gray-100'>
              已追踪频道（
              {channelRows.filter((r) => r.videos.length > 0).length}）
            </h2>
            <div className='flex flex-wrap gap-2'>
              {channelRows.map(({ account, videos }) =>
                videos.length > 0 ? (
                  <button
                    key={account.handle}
                    onClick={() =>
                      document
                        .getElementById(`ch-${account.handle}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className='rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  >
                    {account.name}
                    <span className='ml-1 text-xs text-gray-400'>
                      {videos.length}
                    </span>
                  </button>
                ) : null
              )}
            </div>
          </div>
        )}

        <div className='space-y-8'>
          {channelRows.map(({ account, videos }) =>
            videos.length > 0 ? (
              <section
                key={account.handle}
                id={`ch-${account.handle}`}
                className='scroll-mt-20'
                data-channel-row
              >
                <div className='mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1'>
                  <h2 className='text-lg font-bold text-gray-900 dark:text-gray-100'>
                    {account.name}
                  </h2>
                  <span className='text-sm text-gray-500 dark:text-gray-400'>
                    @{account.handle} · 最新 {videos.length} 部
                  </span>
                </div>
                {/* 一个频道一列横向卷动，60 支排成直的会让整页长到滑不完 */}
                <HScroll resetKey={`tt:${account.handle}`} arrowTop='5.5rem'>
                  {videos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setPlaying(v)}
                      className='group w-32 shrink-0 text-left sm:w-36'
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
                        {v.views != null && `${formatViews(v.views)} · `}
                        {v.published ? timeAgo(v.published) : ''}
                      </p>
                    </button>
                  ))}
                </HScroll>
              </section>
            ) : null
          )}
        </div>
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
                      name: hasNoPosts(f)
                        ? '已追踪，但帐号下没有一般影片'
                        : '抓不到影片',
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
                ref={playerRef}
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
              {/* 说明只给红果口令、没写剧名的片段：带口令去 AI 漫剧页查是哪部剧 */}
              {promoKeywordOf(playing.title) && (
                <a
                  href={`/ai-manju?hg=${encodeURIComponent(
                    promoKeywordOf(playing.title) ?? ''
                  )}`}
                  className='shrink-0 rounded-full bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-400'
                  data-promo
                >
                  用口令找剧：{promoKeywordOf(playing.title)}
                </a>
              )}
              {playingMarked ? (
                <button
                  onClick={() => unmark(playing.id)}
                  className='shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-400'
                  data-mark
                >
                  ★ 已标记 · 取消
                </button>
              ) : (
                <button
                  onClick={() => saveMark(playing)}
                  className='shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20'
                  data-mark
                >
                  ☆ 标记，下次继续看
                </button>
              )}
              {/* 这里的影片都来自已追踪的帐号，所以按钮是「取消追踪」 */}
              {pending.some(
                (p) =>
                  p.op === 'rm' && p.handle === playing.handle.toLowerCase()
              ) ? (
                <span className='shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm text-gray-300'>
                  移除中
                </span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `确定不再追踪「${playing.name}」？全站都会看不到这个帐号。`
                      )
                    )
                      submitFollow('rm', playing.handle);
                  }}
                  className='shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50'
                >
                  已追踪 · 取消
                </button>
              )}
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
