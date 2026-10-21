'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type SearchHit,
  type SeriesFollow,
  applyCheck,
  followKey,
  markSeen,
  MAX_SERIES_FOLLOWS,
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
        let hits: SearchHit[] | null = null;
        try {
          hits = await fetchHits(due);
        } catch {
          hits = null;
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

  return { follows, checking, isFollowed, follow, unfollow, seenAll, seenVideo };
}
