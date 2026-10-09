/* eslint-disable @next/next/no-img-element */
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { hotRank, latestPerSource } from '@/lib/ai-manju-hot';
import { episodeOf, seasonOf, seriesNameOf } from '@/lib/ai-manju-series';

import AiManjuChannelTop from '@/components/AiManjuChannelTop';
import HScroll from '@/components/HScroll';
import PageLayout from '@/components/PageLayout';

import type { HongguoRankList } from '@/app/api/ai-manju/hongguo/route';
import type { AiManjuVideo } from '@/app/api/ai-manju/route';

interface ApiResponse {
  videos: AiManjuVideo[];
  sources: {
    key: string;
    name: string;
    id: string;
    group?: 'base' | 'mine' | 'hongguo';
    type?: 'channel' | 'playlist';
  }[];
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

type TrackTab = 'latest' | 'week' | 'month';
const TRACK_TABS: { key: TrackTab; name: string }[] = [
  { key: 'latest', name: '最新上架' },
  { key: 'week', name: '本周热门' },
  { key: 'month', name: '本月热门' },
];

const FOLLOWS_KEY = 'moontv_ai_manju_follows';
const MAX_FOLLOWS = 30;
const CHIPS_KEY = 'moontv_ai_manju_chips_open';

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

/** 缩图左上角的「第 2 季」「第 8 集」标签；标题没写就不显示 */
function badgeOf(title: string): string {
  const season = seasonOf(title);
  const episode = episodeOf(title);
  return [
    season !== null ? `第 ${season} 季` : '',
    episode !== null ? `第 ${episode} 集` : '',
  ]
    .filter(Boolean)
    .join(' ');
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
  // 红果热播榜：只当「找哪部剧」的依据，点片名就去 YouTube 搜那部剧
  const [ranks, setRanks] = useState<HongguoRankList[] | null>(null);
  const [rankTab, setRankTab] = useState('ai');
  // 追踪频道榜：各频道最新一支／近期最多人看
  const [trackTab, setTrackTab] = useState<TrackTab>('latest');
  // 推荐榜：还没追踪的频道本周发的漫剧，用来发现新频道
  const [recommend, setRecommend] = useState<
    (AiManjuVideo & { channelId: string })[] | null
  >(null);

  useEffect(() => {
    fetch('/api/ai-manju/recommend')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.videos && setRecommend(d.videos))
      .catch(() => undefined); // 推荐抓不到就不显示这一块
  }, []);
  // 手动输入片名搜 YouTube（在抖音看到片段、想找完整版时用）
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<{
    q: string;
    loading: boolean;
    videos: AiManjuVideo[];
    matched: number;
    seasons: number[];
    episodes: number[];
    error: string | null;
  } | null>(null);

  // 点进单一频道时的完整影片清单（RSS 只有最新 15 支，这里可以一直往下翻）
  const [chan, setChan] = useState<{
    key: string;
    videos: AiManjuVideo[];
    next: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const load = () =>
      fetch('/api/ai-manju/hongguo?v=3')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.lists) setRanks(d.lists);
          // 「新上线」要翻完整个片库，伺服器第一次整理要十几秒，晚点再问
          if (d?.pending && tries++ < 6) timer = setTimeout(load, 15000);
        })
        .catch(() => undefined); // 榜单抓不到就不显示这一块，不影响其他功能
    load();
    return () => clearTimeout(timer);
  }, []);

  // channel：同时在这个频道内搜，才能把同一个频道发的各季找齐
  const searchTitle = useCallback((q: string, channel?: string | null) => {
    setSearch({
      q,
      loading: true,
      videos: [],
      matched: 0,
      seasons: [],
      episodes: [],
      error: null,
    });
    setLimit(PAGE_SIZE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetch(
      `/api/ai-manju/search?q=${encodeURIComponent(q)}${
        channel ? `&channel=${channel}` : ''
      }`
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((d) =>
        setSearch((cur) =>
          cur?.q === q
            ? {
                q,
                loading: false,
                videos: d.videos,
                matched: d.matched,
                seasons: d.seasons ?? [],
                episodes: d.episodes ?? [],
                error: null,
              }
            : cur
        )
      )
      .catch((e) =>
        setSearch((cur) =>
          cur?.q === q
            ? {
                q,
                loading: false,
                videos: [],
                matched: 0,
                seasons: [],
                episodes: [],
                error: (e as Error).message,
              }
            : cur
        )
      );
  }, []);

  // 频道筛选列是否展开。预设展开，让所有追踪的频道都看得到
  const [chipsOpen, setChipsOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHIPS_KEY) === '0') setChipsOpen(false);
    } catch {
      // 读不到就维持预设
    }
  }, []);

  const toggleChips = useCallback(() => {
    setChipsOpen((open) => {
      try {
        localStorage.setItem(CHIPS_KEY, open ? '0' : '1');
      } catch {
        // 存不了就只在这次画面生效
      }
      return !open;
    });
  }, []);

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
    // v=3：换网址（回应格式有变就加一号），避开浏览器里旧版 API 留下的两小时缓存
    fetch(
      `/api/ai-manju?v=3${extra ? `&extra=${encodeURIComponent(extra)}` : ''}`
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

  const loadChannel = useCallback(
    (key: string, cont?: string) => {
      const builtin = data?.sources.find((x) => x.key === key);
      const mine = (follows ?? []).find((f) => f.id === key);
      const src = builtin
        ? {
            type: builtin.type ?? 'channel',
            id: builtin.id,
            name: builtin.name,
          }
        : mine;
      if (!src) return;
      setChan((cur) =>
        cont && cur?.key === key
          ? { ...cur, loading: true, error: null }
          : { key, videos: [], next: null, loading: true, error: null }
      );
      fetch(
        `/api/ai-manju/channel?type=${src.type}&id=${
          src.id
        }&name=${encodeURIComponent(src.name)}${
          cont ? `&cont=${encodeURIComponent(cont)}` : ''
        }`
      )
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
          return body;
        })
        .then((d) =>
          setChan((cur) => {
            if (cur?.key !== key) return cur;
            const seen = new Set(cur.videos.map((v) => v.videoId));
            return {
              key,
              videos: [
                ...cur.videos,
                ...(d.videos as AiManjuVideo[]).filter(
                  (v) => !seen.has(v.videoId)
                ),
              ],
              next: d.next,
              loading: false,
              error: null,
            };
          })
        )
        .catch((e) =>
          setChan((cur) =>
            cur?.key === key
              ? { ...cur, loading: false, error: (e as Error).message }
              : cur
          )
        );
    },
    [data, follows]
  );

  // 选了单一频道就去载它的完整清单
  const hasData = data !== null;
  useEffect(() => {
    if (!hasData || active === 'all') {
      setChan(null);
      return;
    }
    loadChannel(active);
    // 只在切换频道时触发；loadChannel 会跟着 data 变，不能放进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasData]);

  const rssVideos =
    data?.videos.filter((v) => active === 'all' || v.sourceKey === active) ??
    [];
  // 单一频道：完整清单载到了就用它，还没载到（或载失败）先用 RSS 那 15 支顶着
  const chanReady = chan && chan.key === active && chan.videos.length > 0;
  const videos = search ? search.videos : chanReady ? chan.videos : rssVideos;

  // 来源多了以后一次有上千支影片，分批显示，免得页面卡
  const shown = videos.slice(0, limit);

  const followList = follows ?? [];
  const followName = (key: string) =>
    followList.find((f) => f.id === key)?.name;
  const builtinSources = data?.sources ?? [];
  const chipGroups = [
    {
      title: '原有来源',
      items: builtinSources.filter((s) => (s.group ?? 'base') === 'base'),
    },
    {
      title: '你追踪的',
      items: [
        ...builtinSources.filter((s) => s.group === 'mine'),
        ...followList.map((f) => ({ key: f.id, name: f.name })),
      ],
    },
    {
      title: '红果片单',
      items: builtinSources.filter((s) => s.group === 'hongguo'),
    },
  ].filter((g) => g.items.length > 0);
  const chips = [
    { key: 'all', name: '全部' },
    ...chipGroups.flatMap((g) => g.items),
  ];
  const pickChip = (key: string) => {
    setActive(key);
    setLimit(PAGE_SIZE);
    setSearch(null);
  };
  const chipClass = (key: string) =>
    `px-3 py-1.5 rounded-full text-sm transition-colors ${
      !search && active === key
        ? 'bg-green-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;
  const rankList = ranks?.find((l) => l.key === rankTab) ?? ranks?.[0];
  // 伺服器只知道内建清单；使用者自己追踪的存在浏览器，这里再滤一次，追踪后也会马上消失
  const recommendItems = (recommend ?? []).filter(
    (v) => !isTracked(v.channelId)
  );
  const allVideos = data?.videos;
  // 各频道热门 20：只有频道有「热门」排序，播放清单不算。最近有更新的频道排前面
  const topChannels = useMemo(() => {
    const newest = new Map<string, number>();
    for (const v of allVideos ?? []) {
      const t = new Date(v.published).getTime() || 0;
      if (t > (newest.get(v.sourceKey) ?? 0)) newest.set(v.sourceKey, t);
    }
    const seen = new Set<string>();
    return [
      ...(data?.sources ?? [])
        .filter((s) => s.type === 'channel')
        .map((s) => ({ id: s.id, name: s.name, key: s.key })),
      ...(follows ?? [])
        .filter((f) => f.type === 'channel')
        .map((f) => ({ id: f.id, name: f.name, key: f.id })),
    ]
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .sort((a, b) => (newest.get(b.key) ?? 0) - (newest.get(a.key) ?? 0));
  }, [allVideos, data, follows]);
  const trackItems = useMemo(() => {
    if (!allVideos) return [];
    if (trackTab === 'latest') {
      return latestPerSource(allVideos).map((video) => ({
        video,
        title: video.title,
        views: video.views ?? 0,
        count: 1,
      }));
    }
    return hotRank(allVideos, trackTab === 'week' ? 7 : 30).map((h) => ({
      video: h.video,
      title: h.series ?? h.video.title,
      views: h.views,
      count: h.count,
    }));
  }, [allVideos, trackTab]);
  const playingChannelId = playing ? channelIdOf(playing.channelUrl) : null;
  const playingSeries = playing ? seriesNameOf(playing.title) : null;

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

        {/* 搜寻：直接搜整个 YouTube，不限于已追踪的频道 */}
        <form
          className='mb-6 flex max-w-xl gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            const q = query.trim();
            if (q) searchTitle(q.slice(0, 80));
          }}
        >
          <div className='relative min-w-0 flex-1'>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='输入剧名，在 YouTube 找完整版（繁简皆可）'
              className='w-full rounded-full border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm text-gray-900 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
            />
            {query && (
              <button
                type='button'
                aria-label='清除搜寻'
                onClick={() => {
                  setQuery('');
                  setSearch(null);
                }}
                className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 text-lg leading-none text-gray-500 hover:text-gray-900 dark:hover:text-white'
              >
                ×
              </button>
            )}
          </div>
          <button
            type='submit'
            disabled={!query.trim()}
            className='shrink-0 rounded-full bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50'
          >
            搜寻
          </button>
        </form>

        {/* 红果热播榜：横向卷动，点片名去 YouTube 找那部剧 */}
        {rankList && ranks && (
          <div className='mb-6'>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
                红果热播榜
              </h2>
              {ranks.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setRankTab(l.key)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    rankList.key === l.key
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {l.name}
                </button>
              ))}
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                点片名在 YouTube 找这部剧
              </span>
            </div>
            <HScroll
              resetKey={`${rankList.key}:${rankList.items.length}`}
              arrowTop='4.5rem'
            >
              {rankList.items.map((it) => (
                <button
                  key={it.seriesId}
                  onClick={() => searchTitle(it.title)}
                  className='group w-28 shrink-0 text-left'
                  data-rank
                >
                  <div
                    className={`relative aspect-[5/7] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 ${
                      search?.q === it.title ? 'ring-2 ring-red-500' : ''
                    }`}
                  >
                    {it.cover && (
                      <img
                        src={it.cover}
                        alt={it.title}
                        loading='lazy'
                        referrerPolicy='no-referrer'
                        className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                      />
                    )}
                    <span className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                      {it.rank}
                    </span>
                  </div>
                  <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                    {it.title}
                  </div>
                  {(it.note || it.heat) && (
                    <div className='text-xs text-gray-500 dark:text-gray-400'>
                      {it.note ?? `${it.heat}热度`}
                    </div>
                  )}
                </button>
              ))}
            </HScroll>
          </div>
        )}

        {/* 追踪频道榜：跟红果榜同一种排法，内容换成我们追踪的频道 */}
        {trackItems.length > 0 && (
          <div className='mb-6'>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
                追踪频道
              </h2>
              {TRACK_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTrackTab(t.key)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    trackTab === t.key
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {t.name}
                </button>
              ))}
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                {trackTab === 'latest'
                  ? '每个频道最新的一支，点了直接播'
                  : '依观看数排名，点了直接播'}
              </span>
            </div>
            <HScroll
              resetKey={`${trackTab}:${trackItems.length}`}
              arrowTop='2.75rem'
            >
              {trackItems.map((it, i) => (
                <button
                  key={it.video.videoId}
                  onClick={() => setPlaying(it.video)}
                  className='group w-44 shrink-0 text-left'
                  data-track
                >
                  <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                    <img
                      src={it.video.thumbnail}
                      alt={it.title}
                      loading='lazy'
                      className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                    <span className='absolute left-0 top-0 rounded-br-lg bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white'>
                      {trackTab === 'latest'
                        ? timeAgo(it.video.published)
                        : i + 1}
                    </span>
                    {it.count > 1 && (
                      <span className='absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white'>
                        {it.count} 支
                      </span>
                    )}
                  </div>
                  <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                    {it.title}
                  </div>
                  <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                    {trackTab === 'latest'
                      ? it.video.sourceName
                      : `${formatViews(it.views)} · ${it.video.sourceName}`}
                  </div>
                </button>
              ))}
            </HScroll>
          </div>
        )}

        {/* 推荐榜：没追踪的频道。看到喜欢的，在播放器按「＋ 追踪此频道」 */}
        {recommendItems.length > 0 && (
          <div className='mb-6'>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
                推荐榜
              </h2>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                还没追踪的频道本周发的漫剧 · 喜欢就在播放器按「＋ 追踪此频道」
              </span>
            </div>
            <HScroll
              resetKey={`rec:${recommendItems.length}`}
              arrowTop='2.75rem'
            >
              {recommendItems.map((v) => (
                <button
                  key={v.videoId}
                  onClick={() => setPlaying(v)}
                  className='group w-44 shrink-0 text-left'
                  data-recommend
                >
                  <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      loading='lazy'
                      className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                    <span className='absolute left-0 top-0 rounded-br-lg bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                      新频道
                    </span>
                  </div>
                  <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                    {v.title}
                  </div>
                  <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                    {v.channel}
                  </div>
                  {v.meta && (
                    <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                      {v.meta}
                    </div>
                  )}
                </button>
              ))}
            </HScroll>
          </div>
        )}

        {/* 各频道热门 20：一个频道一排，卷到才载入 */}
        <AiManjuChannelTop channels={topChannels} onPlay={setPlaying} />

        {/* 来源筛选：预设全部展开；嫌占版面可以收起，选择会记住 */}
        {data && (
          <div className='mb-6'>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <button
                onClick={() => {
                  setAddMsg(null);
                  setManageOpen(true);
                }}
                className='px-3 py-1.5 rounded-full text-sm border border-dashed border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
              >
                ＋ 管理追踪
              </button>
              <button
                onClick={toggleChips}
                className='px-3 py-1.5 rounded-full text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              >
                {chipsOpen
                  ? '收起频道 ▴'
                  : `展开全部 ${chips.length - 1} 个频道 ▾`}
              </button>
              {refreshing && (
                <span className='text-xs text-gray-500 dark:text-gray-400'>
                  更新中…
                </span>
              )}
            </div>
            {chipsOpen ? (
              <div className='space-y-3'>
                <button
                  onClick={() => pickChip('all')}
                  className={chipClass('all')}
                >
                  全部
                </button>
                {chipGroups.map((g) => (
                  <div key={g.title}>
                    <div className='mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400'>
                      {g.title}（{g.items.length}）
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      {g.items.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => pickChip(s.key)}
                          className={chipClass(s.key)}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex max-h-[5.25rem] flex-wrap items-center gap-2 overflow-hidden'>
                {/* 收起时把选中的频道排到最前面，才不会被藏起来 */}
                {[...chips]
                  .sort(
                    (x, y) =>
                      Number(y.key === 'all' || y.key === active) -
                      Number(x.key === 'all' || x.key === active)
                  )
                  .map((s) => (
                    <button
                      key={s.key}
                      onClick={() => pickChip(s.key)}
                      className={chipClass(s.key)}
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 搜寻某部剧时的标题列 */}
        {search && (
          <div className='mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-green-50 p-3 text-sm dark:bg-green-900/20'>
            <span className='text-gray-900 dark:text-gray-100'>
              《{search.q}》在 YouTube 的结果
              {search.loading
                ? '：搜寻中…'
                : search.error
                ? ''
                : search.matched > 0
                ? `：${search.matched} 支片名吻合${
                    search.episodes.length > 1
                      ? `，找到第 ${search.episodes[0]}～${
                          search.episodes[search.episodes.length - 1]
                        } 集中的 ${search.episodes.length} 集，已照集数排好`
                      : search.seasons.length > 1
                      ? `，找到第 ${search.seasons.join('、')} 季，已照季数排好`
                      : '，排在最前面'
                  }`
                : '：没有片名完全吻合的，可能 YouTube 上还没有人上传；以下是相近结果'}
            </span>
            <button
              onClick={() => {
                setSearch(null);
                setQuery('');
              }}
              className='rounded-full bg-white px-3 py-1 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            >
              ← 回到追踪列表
            </button>
            {search.error && (
              <span className='text-red-600 dark:text-red-400'>
                {search.error}
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

        {data && videos.length === 0 && !search?.loading && (
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
                {badgeOf(v.title) && (
                  <span className='absolute left-1.5 top-1.5 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white'>
                    {badgeOf(v.title)}
                  </span>
                )}
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
                {v.meta
                  ? ` · ${v.meta}`
                  : `${v.views != null ? ` · ${formatViews(v.views)}` : ''}${
                      v.published ? ` · ${timeAgo(v.published)}` : ''
                    }`}
              </p>
            </button>
          ))}
        </div>

        {videos.length > shown.length ? (
          <div className='mt-6 flex justify-center'>
            <button
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className='rounded-full bg-gray-100 px-6 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            >
              显示更多（还有 {videos.length - shown.length} 支）
            </button>
          </div>
        ) : (
          // 单一频道：已载入的都显示完了，再跟 YouTube 要下一页
          !search &&
          chan &&
          chan.key === active &&
          (chan.next || chan.loading || chan.error) && (
            <div className='mt-6 flex flex-col items-center gap-2'>
              {chan.error && (
                <span className='text-sm text-amber-600 dark:text-amber-400'>
                  完整清单载入失败（{chan.error}），目前只显示最新的几支
                </span>
              )}
              {(chan.next || chan.loading) && (
                <button
                  disabled={chan.loading}
                  onClick={() => {
                    setLimit((n) => n + PAGE_SIZE);
                    if (chan.next) loadChannel(active, chan.next);
                  }}
                  className='rounded-full bg-gray-100 px-6 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                >
                  {chan.loading
                    ? '载入中…'
                    : `载入更早的影片（已显示 ${videos.length} 支）`}
                </button>
              )}
            </div>
          )
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
              <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
                {playingSeries && (
                  <button
                    onClick={() => {
                      setPlaying(null);
                      searchTitle(playingSeries, playingChannelId);
                    }}
                    className='rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20'
                  >
                    找全季／全集
                  </button>
                )}
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
