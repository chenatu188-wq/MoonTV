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

import { hotRank, latestPerSource } from '@/lib/ai-manju-hot';
import {
  AUTO_NEXT_KEY,
  nextEpisodeOf,
  nextQuery,
  spanLabel,
  spanOf,
} from '@/lib/ai-manju-next-episode';
import { dailyChannelKeys, taipeiDay } from '@/lib/ai-manju-rotation';
import { episodeOf, seasonOf, seriesNameOf } from '@/lib/ai-manju-series';
import { type SearchHit, followKey } from '@/lib/ai-manju-series-follow';
import { AI_MANJU_SOURCES, MAX_CUSTOM_SOURCES } from '@/lib/ai-manju-sources';
import type { HongguoSearchItem } from '@/lib/hongguo-search';
import { takeOverClick } from '@/lib/link-click';
import { parseYtMessage } from '@/lib/music-player';
import { useSeriesFollows } from '@/lib/use-series-follows';
import { usePlayerSeconds, useWatchMarks } from '@/lib/use-watch-marks';
import {
  aiManjuFromSearch,
  aiManjuHref,
  clearVideoParams,
} from '@/lib/video-links';
import { resumeFrom } from '@/lib/watch-marks';

import AiManjuChannelTop from '@/components/AiManjuChannelTop';
import AiManjuRecommendPaste from '@/components/AiManjuRecommendPaste';
import AiManjuSeriesStrip from '@/components/AiManjuSeriesStrip';
import CardFavStar, { CardFavContext } from '@/components/CardFavStar';
import HScroll from '@/components/HScroll';
import PageLayout from '@/components/PageLayout';
import WatchLaterStrip from '@/components/WatchLaterStrip';

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

/** 使用者在页面上追踪的来源。全站共用（lib/ai-manju-shared.ts），所有装置看到同一份 */
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

/** 旧版：追踪清单存在这台装置。现在清单全站共用，这把 key 只用来把旧清单搬过去 */
const FOLLOWS_KEY = 'moontv_ai_manju_follows';
/** 这台装置按了追踪、但共用清单还没确认收到的：下次开页会补送（伺服器重新部署会忘记待办） */
const PENDING_FOLLOWS_KEY = 'moontv_ai_manju_follow_pending';
const MAX_FOLLOWS = MAX_CUSTOM_SOURCES;
const CHIPS_KEY = 'moontv_ai_manju_chips_open';
const MARKS_KEY = 'moontv_ai_manju_marks';
/** 置顶的频道（来源 key）。个人喜好，存在这台装置 */
const PINS_KEY = 'moontv_ai_manju_pins';

function loadFollows(key: string): Follow[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
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

function saveFollows(key: string, list: Follow[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 无痕模式或容量满了就只保留在这次画面里
  }
}

/** 两份清单合起来，同一个来源只留前面那份的 */
function mergeFollows(a: Follow[], b: Follow[]): Follow[] {
  const seen = new Set<string>();
  return [...a, ...b].filter((f) => !seen.has(f.id) && seen.add(f.id));
}

/** 把追踪／移除送到全站共用的清单。失败不挡画面：新增的会留在这台装置，下次开页补送 */
function postFollow(op: 'add' | 'rm', f: Follow) {
  fetch('/api/ai-manju/follows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, type: f.type, id: f.id, name: f.name }),
  }).catch(() => undefined);
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
  // 追剧：追的剧出了新集就标「新」
  const series = useSeriesFollows();

  const seenVideo = series.seenVideo;
  useEffect(() => {
    if (playing) seenVideo(playing.videoId);
  }, [playing, seenVideo]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  // 红果热播榜：只当「找哪部剧」的依据，点片名就去 YouTube 搜那部剧
  const [ranks, setRanks] = useState<HongguoRankList[] | null>(null);
  const [rankTab, setRankTab] = useState('ai');
  // 红果口令／关键字搜寻：TikTok 上常只给口令不给剧名，用红果官网的搜寻换回剧名
  const [hgInput, setHgInput] = useState('');
  const [hgResult, setHgResult] = useState<{
    q: string;
    items: HongguoSearchItem[] | null;
    error: string | null;
  } | null>(null);
  const searchHongguo = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setHgInput(q);
    setHgResult({ q, items: null, error: null });
    fetch(`/api/ai-manju/hongguo/search?q=${encodeURIComponent(q)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((d) => setHgResult({ q, items: d.items ?? [], error: null }))
      .catch((e) => setHgResult({ q, items: [], error: (e as Error).message }));
  }, []);
  // 从 TikTok 漫剧的播放器按「用口令找剧」过来时，网址会带 ?hg=口令
  useEffect(() => {
    const hg = new URLSearchParams(window.location.search).get('hg');
    if (hg) searchHongguo(hg);
  }, [searchHongguo]);
  // 在卡片上按右键「在新分页开启」开过来的：网址带着影片，直接打开播放器
  useEffect(() => {
    const v = aiManjuFromSearch(window.location.search);
    if (v) setPlaying(v);
  }, []);
  const [playerSize, setPlayerSize] = useState(100);
  // 视窗比宽还高（手机直拿、浏览器只占半个萤幕）：播放器撑满剩下的高度，
  // 直式影片才不会缩在 16:9 的框里变很小（横式影片照样置中，上下补黑边）
  const [tallWindow, setTallWindow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-aspect-ratio: 1/1)');
    const update = () => setTallWindow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
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
    // 结果显示在红果榜下面，卷过去
    requestAnimationFrame(() =>
      document
        .getElementById('ai-manju-list')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
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
  // 从首页「热门 AI 漫剧」点过来时，网址带 ?q=剧名，直接找这部剧
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) searchTitle(q);
  }, [searchTitle]);

  // 频道筛选列是否展开。预设展开，让所有追踪的频道都看得到
  const [chipsOpen, setChipsOpen] = useState(true);
  // 置顶的频道：排在频道列、各频道热门、最新上架的最前面。新置顶的排最前
  const [rotationDay, setRotationDay] = useState(() => taipeiDay());
  useEffect(() => {
    const timer = window.setInterval(() => setRotationDay(taipeiDay()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PINS_KEY) || '[]');
      if (Array.isArray(raw))
        setPins(raw.filter((k) => typeof k === 'string').slice(0, 100));
    } catch {
      // 读不到就当没有
    }
  }, []);
  const togglePin = useCallback((key: string) => {
    setPins((cur) => {
      const next = cur.includes(key)
        ? cur.filter((k) => k !== key)
        : [key, ...cur].slice(0, 100);
      try {
        localStorage.setItem(PINS_KEY, JSON.stringify(next));
      } catch {
        // 存不了就只在这次画面生效
      }
      return next;
    });
  }, []);

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

  // 全站共用的追踪清单。null = 还没读到，读完才发第一次请求，避免抓两次
  const [follows, setFollows] = useState<Follow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    // 旧版存在这台装置的清单，当成「还没送出去的新增」搬到共用清单
    const legacy = loadFollows(FOLLOWS_KEY);
    let waiting = mergeFollows(loadFollows(PENDING_FOLLOWS_KEY), legacy);
    if (legacy.length > 0) {
      saveFollows(PENDING_FOLLOWS_KEY, waiting);
      try {
        localStorage.removeItem(FOLLOWS_KEY);
      } catch {
        // 删不掉就下次再搬一次，重复新增不会出事
      }
    }
    fetch('/api/ai-manju/follows')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { follows?: Follow[]; confirmed?: string[] }) => {
        const confirmed = new Set(d.confirmed ?? []);
        waiting = waiting.filter((f) => !confirmed.has(f.id));
        saveFollows(PENDING_FOLLOWS_KEY, waiting);
        waiting.forEach((f) => postFollow('add', f));
        setFollows(mergeFollows(d.follows ?? [], waiting));
      })
      // 共用清单读不到时，至少这台装置自己加的还看得到
      .catch(() => setFollows(waiting));
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
    // 留在这台装置的只有「等共用清单确认」的那几笔；清单里已经没有的就不用等了
    const ids = new Set(next.map((f) => f.id));
    saveFollows(
      PENDING_FOLLOWS_KEY,
      loadFollows(PENDING_FOLLOWS_KEY).filter((f) => ids.has(f.id))
    );
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
      saveFollows(
        PENDING_FOLLOWS_KEY,
        mergeFollows(loadFollows(PENDING_FOLLOWS_KEY), [f])
      );
      updateFollows([...list, f]);
      postFollow('add', f);
      return null;
    },
    [follows, isTracked, updateFollows]
  );

  const removeFollow = useCallback(
    (id: string) => {
      const gone = (follows ?? []).find((f) => f.id === id);
      updateFollows((follows ?? []).filter((f) => f.id !== id));
      if (gone) postFollow('rm', gone);
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

  // 标记，下次继续看：存在浏览器，每台装置各自一份
  const { marks, mark, unmark } = useWatchMarks<AiManjuVideo>(MARKS_KEY);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playingId = playing?.videoId ?? null;
  // 只在换影片时决定从哪里开始播：播到一半按标记不能让播放器重新载入
  const startAt = useMemo(
    () =>
      resumeFrom(
        marksRef.current.find((m) => m.id === playingId)?.seconds ?? 0
      ),
    [playingId]
  );
  const position = usePlayerSeconds('youtube', playerRef, playingId, startAt);
  const playingMarked = marks.some((m) => m.id === playingId);
  // 卡片上的 ☆ 跟播放器的「标记」是同一份清单：先收藏，看过的会记住看到哪
  const favCtx = useMemo(() => {
    const ids = new Set(marks.map((m) => m.id));
    return {
      isFav: (id: string) => ids.has(id),
      toggle: (v: AiManjuVideo) =>
        ids.has(v.videoId) ? unmark(v.videoId) : mark(v.videoId, v, 0),
    };
  }, [marks, mark, unmark]);
  const saveMark = useCallback(
    (v: AiManjuVideo) =>
      mark(v.videoId, { ...v, description: '' }, position.current),
    [mark, position]
  );

  // 网页全屏：影片撑满整个浏览器视窗（不是系统全屏，可以切去别的视窗）
  const [webFull, setWebFull] = useState(false);

  const close = useCallback(() => {
    // 已经标记的影片，关掉时把进度更新到最新
    if (playing && marksRef.current.some((m) => m.id === playing.videoId)) {
      saveMark(playing);
    }
    setPlaying(null);
    setWebFull(false);
    setManageOpen(false);
    clearVideoParams(['v', 't', 'c', 'ch']);
  }, [playing, saveMark]);

  useEffect(() => {
    // 网页全屏时按 Esc 先退出全屏，再按一次才关播放器
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (webFull) setWebFull(false);
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, webFull]);

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
  const allChipItems: { key: string; name: string }[] = [
    ...builtinSources,
    ...followList.map((f) => ({ key: f.id, name: f.name })),
  ];
  const pinSet = new Set(pins);
  const dailyKeys = dailyChannelKeys(allChipItems, pins, rotationDay);
  const dailySet = useMemo(() => new Set(dailyKeys), [dailyKeys]);
  const priorityKeys = useMemo(
    () => [...pins, ...dailyKeys],
    [pins, dailyKeys]
  );
  const chipGroups = [
    {
      title: '📌 置顶',
      // 照置顶的先后排（新置顶的在前）；频道已经不在清单里的就略过
      items: pins
        .map((k) => allChipItems.find((s) => s.key === k))
        .filter((s): s is { key: string; name: string } => !!s),
    },
    {
      title: `🌅 今日轮播 · ${dailyKeys.length} 个 · 每周全部轮一遍`,
      items: dailyKeys.flatMap((key) =>
        allChipItems.filter((s) => s.key === key)
      ),
    },
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
  ]
    // 置顶的只出现在置顶那一组，不在原本的组里重复
    .map((g, i) =>
      i < 2
        ? g
        : {
            ...g,
            items: g.items.filter(
              (s) => !pinSet.has(s.key) && !dailySet.has(s.key)
            ),
          }
    )
    .filter((g) => g.items.length > 0);
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
  // 推荐榜的伺服器只滤掉内建清单；页面上追踪的这里再滤一次，追踪后也会马上消失
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
      // 内建频道直接用程式里的清单，不用等整份影片资料（要抓近 200 个频道）载完；
      // 不然在那之前只有自己追踪的几个，「显示更多频道」的数字会错
      ...AI_MANJU_SOURCES.filter((s) => s.type === 'channel').map((s) => ({
        id: s.id,
        name: s.name,
        key: s.key,
      })),
      ...(follows ?? [])
        .filter((f) => f.type === 'channel')
        .map((f) => ({ id: f.id, name: f.name, key: f.id })),
    ]
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .map((c) => ({ ...c, pinned: pins.includes(c.key) }))
      .sort(
        (a, b) =>
          // 置顶的排最前面（照置顶先后），其余照最近更新
          Number(b.pinned) - Number(a.pinned) ||
          Number(dailySet.has(b.key)) - Number(dailySet.has(a.key)) ||
          (dailySet.has(a.key) && dailySet.has(b.key)
            ? dailyKeys.indexOf(a.key) - dailyKeys.indexOf(b.key)
            : 0) ||
          (a.pinned
            ? pins.indexOf(a.key) - pins.indexOf(b.key)
            : (newest.get(b.key) ?? 0) - (newest.get(a.key) ?? 0))
      );
  }, [allVideos, follows, pins, dailyKeys, dailySet]);
  const trackItems = useMemo(() => {
    if (!allVideos) return [];
    if (trackTab === 'latest') {
      const latest = latestPerSource(allVideos);
      // 置顶频道的最新一支排最前面，其余维持新到旧
      return [
        ...priorityKeys.flatMap((key) =>
          latest.filter((v) => v.sourceKey === key)
        ),
        ...latest.filter((v) => !priorityKeys.includes(v.sourceKey)),
      ].map((video) => ({
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
  }, [allVideos, trackTab, priorityKeys]);
  const playingChannelId = playing ? channelIdOf(playing.channelUrl) : null;
  const playingSeries = playing ? seriesNameOf(playing.title) : null;

  // ── 播完自动接下一集：同频道、同片名、集数下一个 ──
  const [autoNext, setAutoNext] = useState(true);
  useEffect(() => {
    try {
      setAutoNext(localStorage.getItem(AUTO_NEXT_KEY) !== '0');
    } catch {
      // 读不到就用预设（开）
    }
  }, []);
  const toggleAutoNext = () =>
    setAutoNext((v) => {
      try {
        localStorage.setItem(AUTO_NEXT_KEY, v ? '0' : '1');
      } catch {
        // 存不了就算了
      }
      return !v;
    });
  const [nextEp, setNextEp] = useState<{
    of: string;
    ep: (SearchHit & AiManjuVideo) | null;
  } | null>(null);
  useEffect(() => {
    setNextEp(null);
    if (!playing || !playingSeries) return;
    const cur = playing;
    let cancelled = false;
    const find = async (q: string) => {
      const r = await fetch(
        `/api/ai-manju/search?q=${encodeURIComponent(q.slice(0, 80))}${
          playingChannelId ? `&channel=${playingChannelId}` : ''
        }`
      );
      if (!r.ok) return null;
      const d = await r.json();
      return nextEpisodeOf(
        cur,
        (Array.isArray(d.videos) ? d.videos : []) as SearchHit[]
      ) as (SearchHit & AiManjuVideo) | null;
    };
    (async () => {
      // 先直接搜「剧名 第19集」「剧名 第3季」，集数多的剧整部搜寻常常搜不到后面的
      const ep =
        (await find(nextQuery(playingSeries, cur.title)).catch(() => null)) ??
        (await find(playingSeries).catch(() => null));
      if (!cancelled) setNextEp({ of: cur.videoId, ep });
    })();
    return () => {
      cancelled = true;
    };
    // 只在换影片时找
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing?.videoId]);
  const upNext = nextEp && nextEp.of === playing?.videoId ? nextEp.ep : null;
  const playNext = useCallback(() => {
    if (!upNext) return;
    if (playing && marksRef.current.some((m) => m.id === playing.videoId)) {
      saveMark(playing);
    }
    setPlaying({
      ...upNext,
      published: upNext.published ?? '',
      description: '',
      views: upNext.views ?? null,
      sourceKey: upNext.sourceKey ?? '',
      sourceName: upNext.sourceName ?? upNext.channel,
    });
  }, [upNext, playing, saveMark]);
  // YouTube 播放器回报「播完了」（状态 0）就换下一集
  useEffect(() => {
    if (!autoNext || !upNext) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== playerRef.current?.contentWindow) return;
      if (parseYtMessage(e.data)?.state === 0) playNext();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [autoNext, upNext, playNext]);

  // 影片清单（含搜寻某部剧的标题列）：搜寻时放在红果榜下面，平常放在最底
  const listBlock = (
    <div id='ai-manju-list' className='scroll-mt-4'>
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
        <div className='text-red-600 dark:text-red-400'>载入失败：{error}</div>
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
          <a
            key={v.videoId}
            href={aiManjuHref(v)}
            onClick={(e) => takeOverClick(e) && setPlaying(v)}
            className='group text-left'
          >
            <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
              <img
                src={v.thumbnail}
                alt={v.title}
                loading='lazy'
                className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
              />
              <CardFavStar video={v} />
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
          </a>
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
  );

  const page = (
    <PageLayout activePath='/ai-manju'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              AI 漫剧
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              聚合 YouTube 上的 AI 漫剧频道，用官方播放器播放
            </p>
          </div>
          {/* 放在最上面，不用卷到频道列表才找得到 */}
          <button
            onClick={() => {
              setAddMsg(null);
              setManageOpen(true);
            }}
            className='rounded-full bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-500'
            data-manage-follows
          >
            ＋ 管理追踪
          </button>
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
                  onClick={() => {
                    setRankTab(l.key);
                    setHgResult(null);
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${
                    !hgResult && rankList.key === l.key
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
            {/* 口令搜寻：TikTok 片段只给口令（例：石海尋徒）时，在这里换回剧名 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                searchHongguo(hgInput);
              }}
              className='mb-2 flex flex-wrap items-center gap-2'
              data-hg-search
            >
              <input
                value={hgInput}
                onChange={(e) => setHgInput(e.target.value)}
                placeholder='红果口令／关键字（例：石海尋徒），查出是哪部剧'
                className='w-full max-w-sm rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-900 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
              />
              <button
                type='submit'
                disabled={!hgInput.trim()}
                className='shrink-0 rounded-full bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-400 disabled:opacity-50'
              >
                查剧名
              </button>
              {hgResult && (
                <button
                  type='button'
                  onClick={() => {
                    setHgResult(null);
                    setHgInput('');
                  }}
                  className='text-xs text-gray-500 underline dark:text-gray-400'
                >
                  清除，回到榜单
                </button>
              )}
            </form>
            {hgResult && (
              <div className='mb-2 text-xs text-gray-500 dark:text-gray-400'>
                {hgResult.items === null
                  ? `正在红果找「${hgResult.q}」…`
                  : hgResult.error
                  ? hgResult.error
                  : hgResult.items.length === 0
                  ? `红果找不到「${hgResult.q}」，口令可能打错字或已失效`
                  : `「${hgResult.q}」在红果的搜寻结果，越前面越接近（不一定第一个就是）· 点片名在 YouTube 找这部剧`}
              </div>
            )}
            {hgResult?.items === null ? (
              <div className='h-52 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800' />
            ) : (
              (!hgResult || hgResult.items.length > 0) && (
                <HScroll
                  resetKey={
                    hgResult
                      ? `hg:${hgResult.q}`
                      : `${rankList.key}:${rankList.items.length}`
                  }
                  arrowTop='4.5rem'
                >
                  {(hgResult?.items
                    ? hgResult.items.map((it, i) => ({
                        seriesId: it.seriesId,
                        title: it.title,
                        cover: it.cover,
                        badge: String(i + 1),
                        note: [
                          it.episodes > 0 ? `全${it.episodes}集` : '',
                          it.heat,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        tip: it.intro,
                      }))
                    : rankList.items.map((it) => ({
                        seriesId: it.seriesId,
                        title: it.title,
                        cover: it.cover,
                        badge: String(it.rank),
                        note: it.note ?? (it.heat ? `${it.heat}热度` : ''),
                        tip: '',
                      }))
                  ).map((it) => (
                    <button
                      key={it.seriesId}
                      onClick={() => searchTitle(it.title)}
                      title={it.tip || undefined}
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
                          {it.badge}
                        </span>
                      </div>
                      <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                        {it.title}
                      </div>
                      {it.note && (
                        <div className='text-xs text-gray-500 dark:text-gray-400'>
                          {it.note}
                        </div>
                      )}
                    </button>
                  ))}
                </HScroll>
              )
            )}
          </div>
        )}

        {/* 搜寻结果（YouTube 搜寻列、红果榜点片名）：紧接在红果榜下面，不用卷到最底 */}
        {search && listBlock}

        {/* 网友推荐：整段贴上剧名，加进追剧 */}
        <AiManjuRecommendPaste
          followed={series.follows.length}
          onAdd={(entries) => series.followMany(entries, '网友推荐')}
        />

        {/* 追剧：出了新集标「新」 */}
        <AiManjuSeriesStrip
          follows={series.follows}
          checking={series.checking}
          onPlay={(ep) =>
            setPlaying({
              ...ep,
              published: '',
              description: '',
              views: null,
              sourceKey: '',
              sourceName: ep.channel,
            })
          }
          onAll={(f) => {
            if (!f.hg) series.seenAll(followKey(f));
            searchTitle(f.name, f.channelId);
          }}
          onHongguo={(f) => {
            if (!f.hg) return;
            series.seenAll(followKey(f));
            // 另开红果官网：很多剧要登入红果才能看，嵌在站内没办法登入。
            // 电脑开播放页；手机网页不能播，开剧集页（上面有「打开 App」）
            const mobile = /Mobi|Android|iPhone|iPod/i.test(
              navigator.userAgent
            );
            window.open(
              mobile
                ? `https://hongguoduanju.com/detail?series_id=${f.hg.id}`
                : `https://hongguoduanju.com/player/${f.hg.id}`,
              '_blank',
              'noopener'
            );
          }}
          onRemove={series.unfollow}
        />

        {/* 我的收藏：卡片按 ☆ 或播放器按标记的影片 */}
        <WatchLaterStrip
          title='我的收藏'
          hint='影片右上角按 ☆ 收藏，有空再看 · 看过的会记住看到哪 · 只存在这台装置'
          zeroBadge='还没看'
          items={marks.map((m) => ({
            id: m.id,
            title: m.video.title,
            thumbnail: m.video.thumbnail,
            note: m.video.channel || m.video.sourceName,
            href: aiManjuHref(m.video),
            seconds: m.seconds,
          }))}
          onPlay={(id) => {
            const m = marks.find((x) => x.id === id);
            if (m) setPlaying(m.video);
          }}
          onRemove={unmark}
        />

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
                <a
                  key={it.video.videoId}
                  href={aiManjuHref(it.video)}
                  onClick={(e) => takeOverClick(e) && setPlaying(it.video)}
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
                    <CardFavStar video={it.video} />
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
                </a>
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
                <a
                  key={v.videoId}
                  href={aiManjuHref(v)}
                  onClick={(e) => takeOverClick(e) && setPlaying(v)}
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
                    <CardFavStar video={v} />
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
                </a>
              ))}
            </HScroll>
          </div>
        )}

        {/* 各频道热门 20：一个频道一排，卷到才载入 */}
        <AiManjuChannelTop
          channels={topChannels}
          onTogglePin={togglePin}
          onPlay={setPlaying}
        />

        {/* 来源筛选：预设全部展开；嫌占版面可以收起，选择会记住 */}
        {data && (
          <div className='mb-6'>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <button
                onClick={toggleChips}
                className='px-3 py-1.5 rounded-full text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              >
                {chipsOpen
                  ? '收起频道 ▴'
                  : `展开全部 ${chips.length - 1} 个频道 ▾`}
              </button>
              {/* 选了某个频道时可以把它置顶；置顶的频道排在各区的最前面 */}
              {!search && active !== 'all' ? (
                <button
                  onClick={() => togglePin(active)}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    pinSet.has(active)
                      ? 'bg-amber-500 text-white hover:bg-amber-400'
                      : 'border border-amber-500 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20'
                  }`}
                  data-pin-active
                >
                  {pinSet.has(active) ? '📌 已置顶 · 取消' : '📌 置顶这个频道'}
                </button>
              ) : (
                <span className='text-xs text-gray-500 dark:text-gray-400'>
                  点一个频道后可以按「置顶」，常看的排最前面
                </span>
              )}
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

        {!search && listBlock}
      </div>

      {/* 播放器：YouTube 官方 iframe，播放数与收益仍归原作者 */}
      {playing && (
        <div
          // 手机底下有导览列（约 4rem），播放器要让开，按钮才不会被盖住
          className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 pb-[calc(1rem+var(--nav))] [--nav:4rem] md:[--nav:0rem]'
          onClick={close}
        >
          {/* 播放器大小放在影片上方一行（放左边直立在手机上会挡掉一整条） */}
          <div
            className='flex max-h-[calc(100dvh-2rem-var(--nav))] max-w-full flex-col'
            style={{
              width: tallWindow
                ? `calc((100vw - 2rem) * ${playerSize / 100})`
                : `min(calc((100vw - 2rem) * ${
                    playerSize / 100
                  }), calc((100dvh - 9.5rem - var(--nav)) * ${16 / 9} * ${
                    playerSize / 100
                  }))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-2 flex shrink-0 items-center gap-2 text-sm text-white'>
              <label htmlFor='ai-manju-player-size' className='shrink-0'>
                播放器大小
              </label>
              <input
                id='ai-manju-player-size'
                type='range'
                min={50}
                max={100}
                step={5}
                value={playerSize}
                onChange={(e) => setPlayerSize(Number(e.target.value))}
                aria-valuetext={`${playerSize}%`}
                className='min-w-16 flex-1 accent-green-500'
              />
              <button
                onClick={() => setPlayerSize(100)}
                className='shrink-0 rounded-full bg-white/10 px-3 py-1 hover:bg-white/20'
                title='恢复自动适应视窗'
              >
                {playerSize === 100 ? '自动适应' : `${playerSize}% · 恢复`}
              </button>
            </div>
            <div className='flex min-h-0 w-full flex-col'>
              <div
                className={
                  webFull
                    ? 'fixed inset-0 z-[700] flex flex-col bg-black'
                    : `relative w-full shrink-0 overflow-hidden rounded-lg bg-black ${
                        tallWindow ? '' : 'aspect-video'
                      }`
                }
                style={
                  !webFull && tallWindow
                    ? {
                        height: `calc((100dvh - 9.5rem - var(--nav)) * ${
                          playerSize / 100
                        })`,
                      }
                    : undefined
                }
              >
                <iframe
                  ref={playerRef}
                  src={`https://www.youtube-nocookie.com/embed/${
                    playing.videoId
                  }?autoplay=1&rel=0&enablejsapi=1${
                    startAt > 0 ? `&start=${startAt}` : ''
                  }`}
                  title={playing.title}
                  allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                  allowFullScreen
                  className={
                    webFull ? 'min-h-0 w-full flex-1' : 'h-full w-full'
                  }
                />
                {/* 网页全屏的上方工具列：不盖在影片上。写在 iframe 后面再用 order 排到上面，
                  iframe 才不会被搬动而重新载入 */}
                {webFull && (
                  <div className='order-first flex shrink-0 items-center gap-2 bg-gray-900 px-3 py-1.5 text-sm text-white'>
                    <span className='min-w-0 flex-1 truncate text-gray-300'>
                      {playing.title}
                    </span>
                    {upNext && (
                      <button
                        onClick={playNext}
                        className='shrink-0 rounded-full bg-white/10 px-3 py-1 hover:bg-white/20'
                      >
                        下一集 ⏭
                      </button>
                    )}
                    <button
                      onClick={() => setWebFull(false)}
                      className='shrink-0 rounded-full bg-green-600 px-4 py-1 font-medium hover:bg-green-500'
                      data-web-full-exit
                    >
                      ✕ 退出网页全屏
                    </button>
                  </div>
                )}
              </div>
              {/* 标题一行、按钮一行（太多就左右滑），高度固定，不会把影片挤小 */}
              <div className='mt-2 shrink-0'>
                <div className='flex min-w-0 items-baseline gap-2'>
                  <h2 className='min-w-0 truncate text-base font-medium text-white'>
                    {playing.title}
                  </h2>
                  <a
                    href={playing.channelUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='shrink-0 text-sm text-gray-300 hover:text-white'
                  >
                    {playing.channel} ↗
                  </a>
                </div>
                <div className='mt-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [&>*]:shrink-0'>
                  <button
                    onClick={() => setWebFull(true)}
                    className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
                    title='影片撑满整个浏览器视窗'
                    data-web-full
                  >
                    ⛶ 网页全屏
                  </button>
                  {playingSeries && (
                    <>
                      <button
                        onClick={playNext}
                        disabled={!upNext}
                        className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50'
                        title={upNext?.title}
                        data-next-episode
                      >
                        {nextEp?.of !== playing.videoId
                          ? '找下一集…'
                          : upNext
                          ? `下一集：${spanLabel(spanOf(upNext.title))} ⏭`
                          : '没找到下一集'}
                      </button>
                      <button
                        onClick={toggleAutoNext}
                        className={`rounded-full px-3 py-1.5 text-sm text-white ${
                          autoNext
                            ? 'bg-green-600 hover:bg-green-500'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                        title='这集播完自动播下一集'
                        data-auto-next
                      >
                        {autoNext ? '自动下一集：开' : '自动下一集：关'}
                      </button>
                    </>
                  )}
                  {playingSeries && (
                    <button
                      onClick={() => {
                        setPlaying(null);
                        searchTitle(playingSeries, playingChannelId);
                      }}
                      className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
                    >
                      找全季／全集
                    </button>
                  )}
                  {playingSeries &&
                    (series.isFollowed(playingSeries, playingChannelId) ? (
                      <button
                        onClick={() =>
                          series.unfollow(
                            followKey({
                              name: playingSeries,
                              channelId: playingChannelId,
                            })
                          )
                        }
                        className='rounded-full bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-400'
                        data-series-toggle
                      >
                        🔔 已追剧 · 取消
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (
                            !series.follow(
                              playingSeries,
                              playingChannelId,
                              playing.channel
                            )
                          )
                            alert('追剧最多 50 部，请先取消不看的');
                        }}
                        className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
                        title={`出新集时在「追剧」区标「新」：${playingSeries}`}
                        data-series-toggle
                      >
                        🔔 追这部剧
                      </button>
                    ))}
                  {playingMarked ? (
                    <button
                      onClick={() => unmark(playing.videoId)}
                      className='rounded-full bg-amber-500 px-3 py-1.5 text-sm text-white hover:bg-amber-400'
                      data-mark
                    >
                      ★ 已标记 · 取消
                    </button>
                  ) : (
                    <button
                      onClick={() => saveMark(playing)}
                      className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
                      data-mark
                    >
                      ☆ 标记，下次继续看
                    </button>
                  )}
                  {playingChannelId &&
                    (isTracked(playingChannelId) ? (
                      <span className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-gray-300'>
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
                        className='rounded-full bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-500'
                      >
                        ＋ 追踪此频道
                      </button>
                    ))}
                  <button
                    onClick={close}
                    className='rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20'
                  >
                    关闭
                  </button>
                </div>
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
              贴影片网址会追踪发布那支影片的频道。清单全站共用，所有装置都看得到；新增或移除约
              5 分钟内同步到其他装置。
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
                    内建来源（写在程式里，不能在这里移除）
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
  return (
    <CardFavContext.Provider value={favCtx}>{page}</CardFavContext.Provider>
  );
}

export default function AiManjuPage() {
  return (
    <Suspense>
      <AiManjuClient />
    </Suspense>
  );
}
