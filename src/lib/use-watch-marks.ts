'use client';

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  type PlayerKind,
  type WatchMark,
  parsePlayerTime,
  removeMark,
  sanitizeMarks,
  upsertMark,
} from '@/lib/watch-marks';

/** 存在 localStorage 的「下次继续看」清单 */
export function useWatchMarks<T>(storageKey: string) {
  const [marks, setMarks] = useState<WatchMark<T>[]>([]);

  useEffect(() => {
    try {
      setMarks(
        sanitizeMarks<T>(JSON.parse(localStorage.getItem(storageKey) || '[]'))
      );
    } catch {
      // 读不到就当没有
    }
  }, [storageKey]);

  const update = useCallback(
    (fn: (list: WatchMark<T>[]) => WatchMark<T>[]) =>
      setMarks((list) => {
        const next = fn(list);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // 无痕模式或容量满了就只保留在这次画面里
        }
        return next;
      }),
    [storageKey]
  );

  const mark = useCallback(
    (id: string, video: T, seconds: number) =>
      update((list) =>
        upsertMark(list, { id, video, seconds, at: Date.now() })
      ),
    [update]
  );
  const unmark = useCallback(
    (id: string) => update((list) => removeMark(list, id)),
    [update]
  );

  return { marks, mark, unmark };
}

/**
 * 追踪嵌入播放器目前播到第几秒（给「标记」用）。回传的 ref 随时是最新的秒数。
 * - YouTube：网址要带 enablejsapi=1，而且要先丢一句 listening 给它，它才会开始回报进度。
 *   播放器什么时候准备好不一定，所以每半秒丢一次，收到第一笔进度就停。续播位置用网址的 start 参数。
 * - TikTok：自己会回报进度。续播位置没有网址参数可用，等它准备好再叫它跳过去。
 */
export function usePlayerSeconds(
  kind: PlayerKind,
  iframeRef: RefObject<HTMLIFrameElement>,
  /** 正在播的影片 id；没在播是 null */
  activeId: string | null,
  /** 从第几秒开始播 */
  start: number
) {
  const seconds = useRef(0);

  useEffect(() => {
    seconds.current = start;
    if (!activeId) return;
    let heard = false;
    let sought = false;
    const post = (msg: unknown) =>
      iframeRef.current?.contentWindow?.postMessage(
        kind === 'youtube' ? JSON.stringify(msg) : msg,
        '*'
      );

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (
        kind === 'tiktok' &&
        !sought &&
        start > 0 &&
        e.data?.['x-tiktok-player'] &&
        (e.data.type === 'onPlayerReady' || e.data.type === 'onCurrentTime')
      ) {
        sought = true;
        post({ type: 'seekTo', value: start, 'x-tiktok-player': true });
        return;
      }
      const t = parsePlayerTime(kind, e.data);
      if (t === null) return;
      heard = true;
      // 刚开始播的那一下会回报 0，别把续播位置盖掉
      if (t > 0) seconds.current = t;
    };
    window.addEventListener('message', onMessage);

    let tries = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    if (kind === 'youtube') {
      timer = setInterval(() => {
        if (heard || ++tries > 40) return clearInterval(timer);
        post({ event: 'listening', id: activeId, channel: 'widget' });
      }, 500);
    }

    return () => {
      window.removeEventListener('message', onMessage);
      if (timer) clearInterval(timer);
    };
  }, [kind, iframeRef, activeId, start]);

  return seconds;
}
