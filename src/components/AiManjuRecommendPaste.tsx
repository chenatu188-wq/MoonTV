'use client';

import { useState } from 'react';

import {
  type HongguoHit,
  extractTitles,
  MAX_SERIES_FOLLOWS,
  pickHongguo,
} from '@/lib/ai-manju-series-follow';
import type { RecommendEntry } from '@/lib/use-series-follows';

/**
 * 网友推荐：把别人推荐的一串剧名整段贴上来，挑出剧名后一次加进「追剧」。
 * 推荐的多半是红果的剧（不在 YouTube 上），所以先去红果查；
 * 红果查不到的才改在 YouTube 找。出了新集标「新」。
 */
async function lookup(name: string): Promise<RecommendEntry> {
  try {
    const r = await fetch(
      `/api/ai-manju/hongguo/search?q=${encodeURIComponent(name.slice(0, 30))}`
    );
    if (!r.ok) return { name };
    const d = await r.json();
    const hit = pickHongguo(name, (d.items ?? []) as HongguoHit[]);
    return hit ? { name, hg: hit } : { name };
  } catch {
    return { name };
  }
}
export default function AiManjuRecommendPaste({
  followed,
  onAdd,
}: {
  /** 目前追剧的部数 */
  followed: number;
  /** 回传实际加了几部 */
  onAdd: (entries: RecommendEntry[]) => number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const titles = extractTitles(text);

  const [busy, setBusy] = useState('');

  const add = async () => {
    const entries: RecommendEntry[] = [];
    for (let i = 0; i < titles.length; i++) {
      setBusy(`到红果查剧名 ${i + 1} / ${titles.length}…`);
      entries.push(await lookup(titles[i]));
    }
    setBusy('');
    const added = onAdd(entries);
    const hg = entries.filter((e) => e.hg).length;
    const yt = entries.length - hg;
    const skipped = entries.length - added;
    setMsg(
      added > 0
        ? `加入追剧 ${added} 部：红果找到 ${hg} 部${
            yt ? `，${yt} 部红果没有、改在 YouTube 找` : ''
          }${
            skipped > 0
              ? `（${skipped} 部已经在追或超过 ${MAX_SERIES_FOLLOWS} 部上限）`
              : ''
          }`
        : `这些剧都已经在追了${
            followed >= MAX_SERIES_FOLLOWS ? `（或已达 ${MAX_SERIES_FOLLOWS} 部上限）` : ''
          }`
    );
    if (added > 0) setText('');
  };

  return (
    <div className='mb-6' data-recommend-paste>
      <div className='flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          网友推荐
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className='rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          data-recommend-toggle
        >
          {open ? '收起' : '＋ 贴上推荐的剧名'}
        </button>
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          整段贴上，自动挑出剧名加进「追剧」
        </span>
      </div>
      {open && (
        <div className='mt-2'>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMsg('');
            }}
            rows={5}
            placeholder={'例如：\n1. 仙尊归来（全80集）\n《重生之都市修仙》第二季\n逆天邪神、武动乾坤'}
            className='w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
            data-recommend-input
          />
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <button
              onClick={add}
              disabled={titles.length === 0 || busy !== ''}
              className='rounded-full bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-40'
              data-recommend-add
            >
              {busy ||
                (titles.length > 0
                  ? `加入追剧（${titles.length} 部）`
                  : '还没认出剧名')}
            </button>
            {msg && (
              <span className='text-sm text-green-600 dark:text-green-400' data-recommend-msg>
                {msg}
              </span>
            )}
          </div>
          {titles.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1.5 text-xs'>
              {titles.map((t) => (
                <span
                  key={t}
                  className='rounded bg-green-50 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
