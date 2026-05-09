'use client';

import { useEffect, useRef } from 'react';

const IDLE_MS = 30 * 60 * 1000; // 30 分鐘
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
] as const;

/**
 * 閒置自動登出：30 分鐘沒互動就呼叫 /api/logout 清 cookie 並 reload 回密碼頁
 *
 * 使用情境：阿公專區是有密碼保護的，避免裝置沒鎖閒置在登入狀態被別人看到 18+ 內容。
 * 任一互動事件（滑鼠 / 鍵盤 / 觸控 / 捲動）會重置計時。
 */
export function IdleLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logout = async () => {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        // 即使 API 失敗也強制 reload 讓 middleware 把人擋出去
      }
      window.location.href = '/login?reason=idle';
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, IDLE_MS);
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, reset, { passive: true })
    );
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, []);

  return null;
}
