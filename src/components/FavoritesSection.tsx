'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  type Favorite,
  deleteFavorite,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { useGeneralSources } from '@/lib/use-general-sources';

import VideoCard from '@/components/VideoCard';

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

interface FavoritesSectionProps {
  /** true 只列彩虹频道的片，false 只列一般片：两边的收藏互不出现 */
  adult?: boolean;
}

export default function FavoritesSection({
  adult = false,
}: FavoritesSectionProps) {
  const { keys: generalKeys } = useGeneralSources();
  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    // 处理收藏数据更新的函数
    const update = async (allFavorites: Record<string, Favorite>) => {
      const allPlayRecords = await getAllPlayRecords();

      // 根据保存时间排序（从近到远）
      const sorted = Object.entries(allFavorites)
        .sort(([, a], [, b]) => b.save_time - a.save_time)
        .map(([key, fav]) => {
          const plusIndex = key.indexOf('+');
          return {
            id: key.slice(plusIndex + 1),
            source: key.slice(0, plusIndex),
            title: fav.title,
            year: fav.year,
            poster: fav.cover,
            episodes: fav.total_episodes,
            source_name: fav.source_name,
            // 查找对应的播放记录，获取当前集数
            currentEpisode: allPlayRecords[key]?.index,
            search_title: fav?.search_title,
          } as FavoriteItem;
        });
      setItems(sorted);
    };

    getAllFavorites().then(update);

    // 监听收藏更新事件
    return subscribeToDataUpdates('favoritesUpdated', update);
  }, []);

  const favoriteItems = useMemo(
    () =>
      generalKeys
        ? items.filter((item) => generalKeys.has(item.source) !== adult)
        : [],
    [items, generalKeys, adult]
  );

  return (
    <section className='mb-8'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          我的收藏
        </h2>
        {favoriteItems.length > 0 && (
          <button
            className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            onClick={async () => {
              // 只清这一区的；一笔一笔来，同时删会读到同一份旧资料互相盖掉
              for (const item of favoriteItems) {
                await deleteFavorite(item.source, item.id);
              }
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
              adultSearch={adult}
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
  );
}
