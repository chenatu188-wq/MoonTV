/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';

import {
  type DramaCategoryGroup,
  type ShortDrama,
  shortDramaUrl,
} from '@/lib/tiktok-shortdrama';

import HScroll from '@/components/HScroll';

import type { ShortDramaList } from '@/app/api/tiktok-manju/shortdrama/route';

const DAYS: { value: 7 | 30 | null; name: string }[] = [
  { value: null, name: '不限' },
  { value: 7, name: '7 天内' },
  { value: 30, name: '30 天内' },
];

function formatWatched(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)} 亿次观看`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万次观看`;
  return n > 0 ? `${n} 次观看` : '';
}

const chip = (on: boolean) =>
  `px-3 py-1 rounded-full text-sm ${
    on
      ? 'bg-red-500 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
  }`;

/**
 * TikTok 短剧专区的片单。这些剧站内播不了（要登入 TikTok），
 * 所以每一格都是连结，另开 TikTok 的短剧页从第 1 集看起。
 */
export default function TiktokShortDrama() {
  const [lists, setLists] = useState<ShortDramaList[] | null>(null);
  const [groups, setGroups] = useState<DramaCategoryGroup[]>([]);
  const [tab, setTab] = useState('');
  const [open, setOpen] = useState(false);
  // 每组题材最多选一个：picked[组的位置] = 题材 id
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [days, setDays] = useState<7 | 30 | null>(null);
  const [result, setResult] = useState<{
    key: string;
    items: ShortDrama[] | null;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/tiktok-manju/shortdrama?v=2')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.lists?.length) return;
        setLists(d.lists);
        setGroups(d.categories ?? []);
      })
      .catch(() => undefined); // 抓不到就不显示这一块
  }, []);

  const tags = Object.values(picked);
  const filterKey =
    tags.length > 0 || days ? `${tags.slice().sort().join(',')}|${days}` : '';

  useEffect(() => {
    if (!filterKey) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setResult({ key: filterKey, items: null, error: false });
    const q = new URLSearchParams();
    if (tags.length > 0) q.set('tags', tags.join(','));
    if (days) q.set('days', String(days));
    fetch(`/api/tiktok-manju/shortdrama?${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(
        (d) =>
          !cancelled &&
          setResult({ key: filterKey, items: d.items ?? [], error: false })
      )
      .catch(
        () =>
          !cancelled && setResult({ key: filterKey, items: [], error: true })
      );
    return () => {
      cancelled = true;
    };
    // tags／days 的内容已经都在 filterKey 里
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  if (!lists) return null;
  const list = lists.find((l) => l.key === tab) ?? lists[0];
  const filtering = filterKey !== '';
  const items = filtering ? result?.items ?? null : list.items;
  const clear = () => {
    setPicked({});
    setDays(null);
  };
  const pickedNames = groups
    .map((g, gi) => g.items.find((i) => i.id === picked[gi])?.name)
    .filter(Boolean)
    .concat(days ? [`${days} 天内`] : []);

  return (
    <div className='mb-6'>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <h2 className='text-base font-bold text-gray-900 dark:text-gray-100'>
          TikTok 短剧
        </h2>
        {lists.map((l) => (
          <button
            key={l.key}
            onClick={() => {
              setTab(l.key);
              clear();
            }}
            className={chip(!filtering && list.key === l.key)}
          >
            {l.name}
          </button>
        ))}
        {groups.length > 0 && (
          <button
            onClick={() => setOpen((o) => !o)}
            className={chip(filtering)}
            data-shortdrama-filter
          >
            分类筛选
            {pickedNames.length > 0 && `：${pickedNames.join(' · ')}`}{' '}
            {open ? '▴' : '▾'}
          </button>
        )}
        <span className='text-xs text-gray-500 dark:text-gray-400'>
          点了另开 TikTok 短剧页，要登入 TikTok 才能看
        </span>
      </div>

      {open && (
        <div className='mb-3 space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900'>
          {groups.map((g, gi) => (
            <div key={g.title} className='flex flex-wrap items-center gap-1.5'>
              <span className='w-10 shrink-0 text-xs text-gray-500 dark:text-gray-400'>
                {g.title}
              </span>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() =>
                    setPicked((p) => {
                      const next = { ...p };
                      // 再点一次已选的就取消
                      if (next[gi] === it.id) delete next[gi];
                      else next[gi] = it.id;
                      return next;
                    })
                  }
                  className={chip(picked[gi] === it.id)}
                >
                  {it.name}
                </button>
              ))}
            </div>
          ))}
          <div className='flex flex-wrap items-center gap-1.5'>
            <span className='w-10 shrink-0 text-xs text-gray-500 dark:text-gray-400'>
              上线
            </span>
            {DAYS.map((d) => (
              <button
                key={d.name}
                onClick={() => setDays(d.value)}
                className={chip(days === d.value)}
              >
                {d.name}
              </button>
            ))}
            {filtering && (
              <button
                onClick={clear}
                className='ml-2 text-xs text-gray-500 underline dark:text-gray-400'
              >
                清除筛选
              </button>
            )}
          </div>
        </div>
      )}

      {items === null ? (
        <div className='h-52 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800' />
      ) : items.length === 0 ? (
        <div className='rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400'>
          {result?.error
            ? '读不到筛选结果，等一下再试'
            : '这个组合没有短剧，少选一个条件试试'}
        </div>
      ) : (
        <HScroll
          resetKey={`${filtering ? filterKey : list.key}:${items.length}`}
          arrowTop='4.5rem'
        >
          {items.map((d, i) => (
            <a
              key={d.id}
              href={shortDramaUrl(d.id)}
              target='_blank'
              rel='noopener noreferrer'
              title={d.description}
              className='group w-28 shrink-0 text-left'
              data-shortdrama
            >
              <div className='relative aspect-[5/7] overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                {d.cover && (
                  <img
                    src={d.cover}
                    alt={d.name}
                    loading='lazy'
                    referrerPolicy='no-referrer'
                    className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                  />
                )}
                <span className='absolute left-0 top-0 rounded-br-lg bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white'>
                  {i + 1}
                </span>
                {d.episodes > 0 && (
                  <span className='absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white'>
                    {d.episodes} 集
                  </span>
                )}
              </div>
              <div className='mt-1 line-clamp-2 text-xs font-medium text-gray-900 dark:text-gray-100'>
                {d.name}
              </div>
              <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                {formatWatched(d.watched)}
              </div>
            </a>
          ))}
        </HScroll>
      )}
    </div>
  );
}
