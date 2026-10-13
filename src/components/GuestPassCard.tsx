'use client';

import { useEffect, useState } from 'react';

interface GuestPassInfo {
  enabled: boolean;
  /** 访客自己来看时为 true：只有到期时间，没有密码 */
  guest?: boolean;
  code?: string;
  expiresAt?: number;
  days?: number;
}

/** 同一个画面可能同时有设置面板和页首提示在问，共用一次请求 */
let pending: Promise<GuestPassInfo | null> | null = null;
function loadGuestPass(): Promise<GuestPassInfo | null> {
  pending ??= fetch('/api/guest-pass')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return pending;
}

function useGuestPass(): GuestPassInfo | null {
  const [info, setInfo] = useState<GuestPassInfo | null>(null);
  useEffect(() => {
    let alive = true;
    loadGuestPass().then((d) => alive && d && setInfo(d));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

function describe(expiresAt: number) {
  const d = new Date(expiresAt);
  return {
    date: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
      2,
      '0'
    )}:${String(d.getMinutes()).padStart(2, '0')}`,
    daysLeft: Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)),
  };
}

/**
 * 设置面板里的「访客密码」。
 * 用主密码登入：显示给朋友用的四位数密码和到期时间。
 * 用访客密码登入：只显示自己的密码什么时候到期。
 * 没启用或用别组密码登入就整块不显示。
 */
export default function GuestPassCard() {
  const info = useGuestPass();
  const [copied, setCopied] = useState(false);

  if (!info?.enabled || !info.expiresAt) return null;
  const { date, daysLeft } = describe(info.expiresAt);

  if (info.guest) {
    return (
      <div
        className='rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20'
        data-guest-pass='guest'
      >
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          访客登入
        </h4>
        <p className='mt-1 text-sm text-amber-700 dark:text-amber-400'>
          你的密码到 {date} 为止，还有 {daysLeft} 天
        </p>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
          到期后会被登出，要跟站长拿新密码才能再进来。
        </p>
      </div>
    );
  }

  if (!info.code) return null;
  const share = `${window.location.origin}\n密码：${info.code}（${date} 前有效）`;

  return (
    <div
      className='rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20'
      data-guest-pass='owner'
    >
      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
        访客密码
      </h4>
      <div className='mt-1 flex items-center gap-3'>
        <span className='font-mono text-2xl font-bold tracking-widest text-amber-600 dark:text-amber-400'>
          {info.code}
        </span>
        <button
          onClick={() => {
            navigator.clipboard
              ?.writeText(share)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => undefined);
          }}
          className='rounded-full bg-amber-500 px-3 py-1 text-xs text-white hover:bg-amber-400'
        >
          {copied ? '已复制' : '复制网址和密码'}
        </button>
      </div>
      <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
        {date} 到期（还有 {daysLeft} 天），之后自动换一组新的，每 {info.days}{' '}
        天换一次。到期后朋友会被登出，要给他新密码才能再进来。
        朋友登入后在页面上方和这里都看得到到期日，但看不到密码。
      </p>
    </div>
  );
}

/**
 * 页面最上面的一行提示，只有用访客密码登入的人会看到：
 * 平常是不显眼的一行小字，剩 3 天以内变成醒目的提醒。
 */
export function GuestExpiryNotice() {
  const info = useGuestPass();
  if (!info?.enabled || !info.guest || !info.expiresAt) return null;
  const { date, daysLeft } = describe(info.expiresAt);
  const soon = daysLeft <= 3;

  return (
    <div
      className={`px-4 py-1.5 text-center text-xs ${
        soon
          ? 'bg-amber-500 font-medium text-white'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
      data-guest-notice
    >
      {soon
        ? `访客密码还有 ${daysLeft} 天到期（${date}），到期后要跟站长拿新密码`
        : `访客登入 · 密码到 ${date} 为止，还有 ${daysLeft} 天`}
    </div>
  );
}
