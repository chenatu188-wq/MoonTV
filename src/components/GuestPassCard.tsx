'use client';

import { useEffect, useState } from 'react';

interface GuestPassInfo {
  enabled: boolean;
  code?: string;
  expiresAt?: number;
  days?: number;
}

/**
 * 设置面板里的「访客密码」：给朋友用的四位数密码和到期时间。
 * 只有用主密码登入的人会看到这一块；没启用或用别组密码登入就整块不显示。
 */
export default function GuestPassCard() {
  const [info, setInfo] = useState<GuestPassInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/guest-pass')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInfo(d))
      .catch(() => undefined);
  }, []);

  if (!info?.enabled || !info.code || !info.expiresAt) return null;

  const expires = new Date(info.expiresAt);
  const daysLeft = Math.max(
    0,
    Math.ceil((info.expiresAt - Date.now()) / 86400000)
  );
  const date = `${expires.getMonth() + 1}/${expires.getDate()} ${String(
    expires.getHours()
  ).padStart(2, '0')}:${String(expires.getMinutes()).padStart(2, '0')}`;
  const share = `${window.location.origin}\n密码：${info.code}（${date} 前有效）`;

  return (
    <div
      className='rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20'
      data-guest-pass
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
      </p>
    </div>
  );
}
