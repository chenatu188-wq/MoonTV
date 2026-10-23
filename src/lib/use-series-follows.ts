'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type HongguoHit,
  type SearchHit,
  type SeriesFollow,
  applyCheck,
  applyHongguoCheck,
  followKey,
  markSeen,
  MAX_SERIES_FOLLOWS,
  pickHongguo,
  RECHECK_MS,
  sanitizeSeriesFollows,
  SERIES_FOLLOWS_KEY,
} from '@/lib/ai-manju-series-follow';

function load(): SeriesFollow[] {
  try {
    return sanitizeSeriesFollows(
      JSON.parse(localStorage.getItem(SERIES_FOLLOWS_KEY) || '[]')
    );
  } catch {
    return [];
  }
}

function save(list: SeriesFollow[]) {
  try {
    localStorage.setItem(SERIES_FOLLOWS_KEY, JSON.stringify(list));
  } catch {
    // 无痕模式之类存不了就算了
  }
}

/** 用「找全季／全集」同一支搜寻，抓这部剧现在有的集数 */
async function fetchHits(f: SeriesFollow): Promise<SearchHit[]> {
  const r = await fetch(
    `/api/ai-manju/search?q=${encodeURIComponent(f.name)}${
      f.channelId ? `&channel=${f.channelId}` : ''
    }`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return (Array.isArray(d.videos) ? d.videos : []) as SearchHit[];
}

/** 红果的剧：用红果搜寻找这部剧现在的总集数 */
async function fetchHongguo(f: SeriesFollow): Promise<HongguoHit | null> {
  const r = await fetch(
    `/api/ai-manju/hongguo/search?q=${encodeURIComponent(f.name.slice(0, 30))}`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const items = (Array.isArray(d.items) ? d.items : []) as HongguoHit[];
  return items.find((h) => h.seriesId === f.hg?.id) ?? null;
}

/** 用剧名在红果找这部剧（网友推荐的剧 YouTube 找不到时补查） */
async function findHongguo(name: string): Promise<HongguoHit | null> {
  const r = await fetch(
    `/api/ai-manju/hongguo/search?q=${encodeURIComponent(name.slice(0, 30))}`
  );
  if (!r.ok) return null;
  const d = await r.json();
  return pickHongguo(name, (Array.isArray(d.items) ? d.items : []) as HongguoHit[]);
}

/** 网友推荐要追的一部：在红果查到的带 hg，没查到的只有剧名（改在 YouTube 找） */
export interface RecommendEntry {
  name: string;
  hg?: HongguoHit;
}

/**
 * AI 漫剧的追剧名单。打开页面时，超过半小时没检查的剧逐部去查有没有新集
 * （一部一部来，不要一次打一堆搜寻）。
 */
export function useSeriesFollows() {
  const [follows, setFollows] = useState<SeriesFollow[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const ref = useRef<SeriesFollow[]>([]);

  const update = useCallback(
    (fn: (list: SeriesFollow[]) => SeriesFollow[]) => {
      const next = fn(ref.current);
      ref.current = next;
      setFollows(next);
      save(next);
    },
    []
  );

  const running = useRef(false);
  const checkDue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const due = ref.current.find(
          (f) => Date.now() - f.checkedAt > RECHECK_MS
        );
        if (!due) break;
        const key = followKey(due);
        setChecking(key);
        if (due.hg) {
          let hit: HongguoHit | null = null;
          try {
            hit = await fetchHongguo(due);
          } catch {
            hit = null;
          }
          update((list) =>
            list.map((f) =>
              followKey(f) === key ? applyHongguoCheck(f, hit) : f
            )
          );
          continue;
        }
        let hits: SearchHit[] | null = null;
        try {
          hits = await fetchHits(due);
        } catch {
          hits = null;
        }
        // 网友推荐的剧多半是红果独家：YouTube 一直找不到的，改去红果查，查到就转成红果的剧
        if (
          due.channel === '网友推荐' &&
          !due.latest &&
          !(hits ?? []).some((h) => h.match)
        ) {
          let hg: HongguoHit | null = null;
          try {
            hg = await findHongguo(due.name);
          } catch {
            hg = null;
          }
          if (hg) {
            const found = hg;
            update((list) => {
              // 同一部红果剧已经在追了，就把这笔拿掉
              if (list.some((f) => f.hg?.id === found.seriesId))
                return list.filter((f) => followKey(f) !== key);
              return list.map((f) =>
                followKey(f) !== key
                  ? f
                  : {
                      ...f,
                      name: found.title,
                      channel: '红果',
                      checkedAt: Date.now(),
                      hg: {
                        id: found.seriesId,
                        cover: found.cover,
                        total: found.episodes,
                        seen: found.episodes,
                      },
                    }
              );
            });
            continue;
          }
        }
        update((list) =>
          list.map((f) =>
            followKey(f) !== key
              ? f
              : hits
              ? applyCheck(f, hits)
              : // 这次查不到：先当查过了，半小时后再试，免得卡在同一部
                { ...f, checkedAt: Date.now() }
          )
        );
      }
    } finally {
      running.current = false;
      setChecking(null);
    }
  }, [update]);

  useEffect(() => {
    ref.current = load();
    setFollows(ref.current);
    checkDue();
  }, [checkDue]);

  const isFollowed = useCallback(
    (name: string, channelId: string | null) =>
      follows.some((f) => followKey(f) === followKey({ name, channelId })),
    [follows]
  );

  const follow = useCallback(
    (name: string, channelId: string | null, channel: string) => {
      if (ref.current.length >= MAX_SERIES_FOLLOWS) return false;
      const key = followKey({ name, channelId });
      if (ref.current.some((f) => followKey(f) === key)) return true;
      update((list) => [
        {
          name,
          channelId,
          channel,
          known: [],
          newIds: [],
          latest: null,
          checkedAt: 0,
          addedAt: Date.now(),
        },
        ...list,
      ]);
      checkDue();
      return true;
    },
    [update, checkDue]
  );

  /**
   * 一次追好几部（网友推荐）。在红果查到的照红果的集数追，没查到的改在 YouTube 找。
   * 回传实际加了几部。
   */
  const followMany = useCallback(
    (entries: RecommendEntry[], label: string) => {
      const have = new Set(ref.current.map(followKey));
      const room = MAX_SERIES_FOLLOWS - ref.current.length;
      const now = Date.now();
      const fresh: SeriesFollow[] = [];
      for (const e of entries) {
        if (fresh.length >= room) break;
        const f: SeriesFollow = e.hg
          ? {
              name: e.hg.title,
              channelId: null,
              channel: '红果',
              known: [],
              newIds: [],
              latest: null,
              // 刚在红果查过，不用马上再查
              checkedAt: now,
              addedAt: now - fresh.length,
              hg: {
                id: e.hg.seriesId,
                cover: e.hg.cover,
                total: e.hg.episodes,
                seen: e.hg.episodes,
              },
            }
          : {
              name: e.name,
              channelId: null,
              channel: label,
              known: [],
              newIds: [],
              latest: null,
              checkedAt: 0,
              // 照贴上的顺序排
              addedAt: now - fresh.length,
            };
        const key = followKey(f);
        if (have.has(key)) continue;
        have.add(key);
        fresh.push(f);
      }
      if (!fresh.length) return 0;
      update((list) => [...fresh, ...list]);
      checkDue();
      return fresh.length;
    },
    [update, checkDue]
  );

  const unfollow = useCallback(
    (key: string) => update((list) => list.filter((f) => followKey(f) !== key)),
    [update]
  );

  /** 这部剧的新集都看过了（点了「全集」） */
  const seenAll = useCallback(
    (key: string) =>
      update((list) =>
        list.map((f) => (followKey(f) === key ? markSeen(f) : f))
      ),
    [update]
  );

  /** 播了某一支：如果是哪部追的剧的新集，就不再算新 */
  const seenVideo = useCallback(
    (videoId: string) => {
      if (!ref.current.some((f) => f.newIds.includes(videoId))) return;
      update((list) =>
        list.map((f) =>
          f.newIds.includes(videoId) ? markSeen(f, [videoId]) : f
        )
      );
    },
    [update]
  );

  return {
    follows,
    checking,
    isFollowed,
    follow,
    followMany,
    unfollow,
    seenAll,
    seenVideo,
  };
}
