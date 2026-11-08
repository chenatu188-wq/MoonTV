'use client';

import { useEffect, useState } from 'react';

import {
  decodePayload,
  encodePayload,
  mergePayload,
  MIGRATE_DONE_KEY,
  MIGRATE_HASH,
  newSiteOrigin,
  readLocal,
  writeLocal,
} from '@/lib/site-migrate';

/**
 * 放在根 layout：新站打开带 #moontv-migrate= 的网址时，问一声再并进 localStorage，
 * 然后重新整理让各页面读到新资料。登入页也会跑（还没登入一样能先搬好）。
 */
export function SiteMigrateReceiver() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    try {
      const done = sessionStorage.getItem(MIGRATE_DONE_KEY);
      if (done) {
        sessionStorage.removeItem(MIGRATE_DONE_KEY);
        setMsg(done);
      }
    } catch {
      // ignore
    }

    if (!location.hash.includes(MIGRATE_HASH)) return;
    const hash = location.hash;
    // 不管成不成功，先把一大串资料从网址拿掉
    history.replaceState(null, '', location.pathname + location.search);
    decodePayload(hash).then((payload) => {
      if (!payload) {
        setMsg('搬家資料讀不出來（網址可能被截斷），請回舊站再按一次');
        return;
      }
      const n = {
        favorites: Object.keys(payload.favorites).length,
        aiMarks: payload.aiMarks.length,
        seriesFollows: payload.seriesFollows.length,
        aiPins: payload.aiPins.length,
      };
      if (!n.favorites && !n.aiMarks && !n.seriesFollows && !n.aiPins) {
        setMsg('舊站沒有資料可以搬');
        return;
      }
      if (
        !window.confirm(
          `要把舊站的資料搬進這裡嗎？\n收藏夾 ${n.favorites} 部\nAI 漫劇：我的收藏 ${n.aiMarks} 支、追劇 ${n.seriesFollows} 部、置頂頻道 ${n.aiPins} 個\n（這裡原本有的不會被蓋掉）`
        )
      )
        return;
      try {
        const r = mergePayload(readLocal(), payload);
        writeLocal(r);
        const a = r.added;
        const text = `搬家完成：收藏夾新增 ${a.favorites} 部；AI 漫劇我的收藏新增 ${a.aiMarks} 支、追劇新增 ${a.seriesFollows} 部、置頂新增 ${a.aiPins} 個`;
        try {
          sessionStorage.setItem(MIGRATE_DONE_KEY, text);
        } catch {
          // ignore
        }
        location.reload();
      } catch {
        setMsg('寫入失敗：瀏覽器儲存空間滿了或被封鎖（無痕模式？）');
      }
    });
  }, []);

  if (!msg) return null;
  return (
    <div
      data-migrate-msg
      className='fixed left-1/2 top-4 z-[800] w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg'
    >
      <div className='flex items-start gap-3'>
        <span className='flex-1'>{msg}</span>
        <button onClick={() => setMsg('')} className='shrink-0 opacity-80'>
          ✕
        </button>
      </div>
    </div>
  );
}

/** 旧站（*.zeabur.app）才显示：按了开新站并把资料带过去 */
export function SiteMigrateButton({ path = '/' }: { path?: string }) {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => setTarget(newSiteOrigin(location.host)), []);
  if (!target) return null;

  // 压缩是非同步的，之后再 window.open 会被当成弹窗挡掉，所以直接在这一页换过去
  const go = async () => {
    const data = await encodePayload(readLocal());
    location.href = `${target}${path}#${MIGRATE_HASH}${data}`;
  };

  return (
    <div
      data-migrate-banner
      className='mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
    >
      <span className='flex-1'>
        這個舊網址 12 月關站。新網址：
        <a href={target + path} className='underline' target='_blank'>
          {target.replace('https://', '')}
        </a>
      </span>
      <button
        onClick={go}
        data-migrate-go
        className='rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700'
      >
        把收藏夾和 AI 漫劇紀錄搬過去
      </button>
    </div>
  );
}
