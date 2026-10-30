/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import FavoritesSection from '@/components/FavoritesSection';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

import type { WeekHotItem } from '@/app/api/ai-manju/week-hot/route';

/** 首页每一排热门榜，最多显示几部 */
const HOME_ROW_LIMIT = 20;

interface HomeCard {
  key: string;
  title: string;
  poster: string;
  rate?: string;
  year?: string;
  doubanId?: string;
  /** 卡片右下角的小字（红果的热度） */
  note?: string;
  /** 有值就直接连过去；没有就照豆瓣卡片用片名去播放页找来源 */
  href?: string;
}

interface HomeRowDef {
  key: string;
  title: string;
  more: string;
  /** 豆瓣卡片点进播放页时要找电影还是剧集 */
  stype?: 'movie';
  load: () => Promise<HomeCard[]>;
}

async function loadDouban(
  kind: 'movie' | 'tv',
  category: string,
  type: string
): Promise<HomeCard[]> {
  const d = await getDoubanCategories({
    kind,
    category,
    type,
    pageLimit: HOME_ROW_LIMIT,
  });
  if (d.code !== 200) return [];
  return d.list.slice(0, HOME_ROW_LIMIT).map((it: DoubanItem) => ({
    key: `douban-${it.id}`,
    title: it.title,
    poster: it.poster,
    rate: it.rate,
    year: it.year,
    doubanId: it.id,
  }));
}

/** 红果短剧的真人剧热播榜 */
async function loadHongguo(): Promise<HomeCard[]> {
  const r = await fetch('/api/ai-manju/hongguo?v=3');
  if (!r.ok) return [];
  const d: {
    lists?: {
      key: string;
      items: { seriesId: string; title: string; cover: string; heat: string }[];
    }[];
  } = await r.json();
  const list = d.lists?.find((l) => l.key === 'real');
  return (list?.items ?? []).slice(0, HOME_ROW_LIMIT).map((it) => ({
    key: `hongguo-${it.seriesId}`,
    title: it.title,
    poster: it.cover,
    note: it.heat ? `${it.heat}热度` : '',
  }));
}

/** AI 漫剧追踪频道的本周热门（伺服器算好前 20），点了直接在 AI 漫剧页播 */
async function loadAiManjuWeekHot(): Promise<HomeCard[]> {
  const r = await fetch('/api/ai-manju/week-hot');
  if (!r.ok) return [];
  const d: { items?: WeekHotItem[] } = await r.json();
  return (d.items ?? []).slice(0, HOME_ROW_LIMIT).map((it) => ({
    key: `ai-${it.key}`,
    title: it.title,
    poster: it.thumbnail,
    note: [formatViews(it.views), it.count > 1 ? `本周${it.count}集` : '']
      .filter(Boolean)
      .join(' · '),
    href: it.href,
  }));
}

function formatViews(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万次观看` : `${n}次观看`;
}

const HOME_ROWS: HomeRowDef[] = [
  {
    key: 'movie',
    title: '热门电影',
    more: '/douban?type=movie',
    stype: 'movie',
    load: () => loadDouban('movie', '热门', '全部'),
  },
  {
    key: 'tv',
    title: '热门剧集',
    more: '/douban?type=tv',
    load: () => loadDouban('tv', 'tv', 'tv'),
  },
  {
    key: 'korean',
    title: '热门韩剧',
    more: '/douban?type=tv',
    load: () => loadDouban('tv', 'tv', 'tv_korean'),
  },
  {
    key: 'variety',
    title: '热门综艺',
    more: '/browse?category=variety',
    load: () => loadDouban('tv', 'show', 'show'),
  },
  {
    key: 'duanju',
    title: '热门短剧',
    more: '/browse?category=duanju',
    load: loadHongguo,
  },
  {
    key: 'anime3d',
    title: '热门3D动漫',
    more: '/browse?category=anime3d',
    load: () => loadDouban('tv', 'tv', 'tv_animation'),
  },
  {
    key: 'ai-manju',
    title: '热门AI漫剧',
    more: '/ai-manju',
    load: loadAiManjuWeekHot,
  },
];

function HomeRow({
  row,
  cards,
}: {
  row: HomeRowDef;
  cards?: HomeCard[] | null;
}) {
  // 载完却没东西（抓不到）就整排不显示
  if (cards && cards.length === 0) return null;
  return (
    <section className='mb-8'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          {row.title}
        </h2>
        <Link
          href={row.more}
          className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        >
          查看更多
          <ChevronRight className='w-4 h-4 ml-1' />
        </Link>
      </div>
      <ScrollableRow>
        {!cards
          ? // 加载状态显示灰色占位数据
            Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
              >
                <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                  <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                </div>
                <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
              </div>
            ))
          : cards.map((card) => (
              <div
                key={card.key}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                data-home-row={row.key}
              >
                {card.href ? (
                  <Link href={card.href} className='group block'>
                    <div className='relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.poster}
                        alt={card.title}
                        loading='lazy'
                        referrerPolicy='no-referrer'
                        className='h-full w-full object-contain transition-transform duration-300 group-hover:scale-105'
                      />
                    </div>
                    <div className='mt-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-green-600 dark:group-hover:text-green-400'>
                      {card.title}
                    </div>
                    {card.note && (
                      <div className='text-center text-xs text-gray-500 dark:text-gray-400'>
                        {card.note}
                      </div>
                    )}
                  </Link>
                ) : (
                  <VideoCard
                    from='douban'
                    title={card.title}
                    poster={card.poster}
                    douban_id={card.doubanId}
                    rate={card.rate}
                    year={card.year}
                    type={row.stype}
                  />
                )}
              </div>
            ))}
      </ScrollableRow>
    </section>
  );
}

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [rows, setRows] = useState<Record<string, HomeCard[] | null>>({});
  const { announcement } = useSite();

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

  useEffect(() => {
    // 每一排各自载入，哪一排慢或抓不到都不影响其他排
    HOME_ROWS.forEach((row) => {
      row
        .load()
        .then((cards) => setRows((cur) => ({ ...cur, [row.key]: cards })))
        .catch((error) => {
          console.error(`获取${row.title}失败:`, error);
          setRows((cur) => ({ ...cur, [row.key]: [] }));
        });
    });
  }, []);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 顶部 Tab 切换 */}
        <div className='mb-8 flex justify-center'>
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
        </div>

        <div className='max-w-[95%] mx-auto'>
          {activeTab === 'favorites' ? (
            // 收藏夹视图：只有非彩虹频道的片，彩虹频道的收藏在彩虹频道里
            <FavoritesSection />
          ) : (
            // 首页视图
            <>
              {/* 继续观看 */}
              <ContinueWatching />

              {HOME_ROWS.map((row) => (
                <HomeRow key={row.key} row={row} cards={rows[row.key]} />
              ))}
            </>
          )}
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4 transition-opacity duration-300 ${
            showAnnouncement ? '' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl'>
            <div className='flex justify-between items-start mb-4'>
              <h3 className='text-2xl font-bold tracking-tight text-gray-800 dark:text-white border-b border-green-500 pb-1'>
                提示
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white transition-colors'
                aria-label='关闭'
              ></button>
            </div>
            <div className='mb-6'>
              <div className='relative overflow-hidden rounded-lg mb-4 bg-green-50 dark:bg-green-900/20'>
                <div className='absolute inset-y-0 left-0 w-1.5 bg-green-500 dark:bg-green-400'></div>
                <p className='ml-4 text-gray-600 dark:text-gray-300 leading-relaxed'>
                  {announcement}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 transition-all duration-300 transform hover:-translate-y-0.5'
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
