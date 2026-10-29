/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

// 客户端收藏 API
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

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

/** 红果短剧的热播榜：real＝真人短剧，ai＝AI 剧 */
async function loadHongguo(
  listKey: 'real' | 'ai',
  toHref?: (title: string) => string
): Promise<HomeCard[]> {
  const r = await fetch('/api/ai-manju/hongguo?v=3');
  if (!r.ok) return [];
  const d: {
    lists?: {
      key: string;
      items: { seriesId: string; title: string; cover: string; heat: string }[];
    }[];
  } = await r.json();
  const list = d.lists?.find((l) => l.key === listKey);
  return (list?.items ?? []).slice(0, HOME_ROW_LIMIT).map((it) => ({
    key: `hongguo-${it.seriesId}`,
    title: it.title,
    poster: it.cover,
    note: it.heat ? `${it.heat}热度` : '',
    href: toHref?.(it.title),
  }));
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
    load: () => loadHongguo('real'),
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
    // AI 漫剧在 YouTube 上，带剧名去 AI 漫剧页找
    load: () =>
      loadHongguo('ai', (title) => `/ai-manju?q=${encodeURIComponent(title)}`),
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

  // 收藏夹数据
  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
    currentEpisode?: number;
    search_title?: string;
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

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

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();

    // 根据保存时间排序（从近到远）
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        // 查找对应的播放记录，获取当前集数
        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;

        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    // 监听收藏更新事件
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab]);

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
            // 收藏夹视图
            <section className='mb-8'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    onClick={async () => {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
                {favoriteItems.map((item) => (
                  <div key={item.id + item.source} className='w-full'>
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from='favorite'
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    暂无收藏内容
                  </div>
                )}
              </div>
            </section>
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
