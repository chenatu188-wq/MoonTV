'use client';

import { Copy, ExternalLink, PlayCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

type LiveSource = {
  id: string;
  name: string;
  description?: string;
  url: string;
};

const DEFAULT_SOURCES: LiveSource[] = [
  {
    id: 'tw',
    name: '台灣直播總表',
    description: '公共可用來源，適合家庭區快速切台',
    url: 'https://iptv-org.github.io/iptv/countries/tw.m3u',
  },
  {
    id: 'news',
    name: '新聞直播總表',
    description: '國際新聞頻道集合',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
  },
  {
    id: 'sports',
    name: '體育直播總表',
    description: '球類與綜合體育頻道集合',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
  },
  {
    id: 'global',
    name: '全球直播總表',
    description: '完整清單，台數較多',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
  },
];

export default function LiveSourcesPanel() {
  const [copiedId, setCopiedId] = useState<string>('');

  const sources = useMemo(() => DEFAULT_SOURCES, []);

  const copyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      setCopiedId(`failed-${id}`);
      setTimeout(() => setCopiedId(''), 1500);
    }
  };

  return (
    <div className='rounded-2xl border border-gray-200/70 bg-white/70 p-4 sm:p-6 dark:border-gray-700/70 dark:bg-gray-900/50'>
      <div className='mb-4 text-sm text-gray-600 dark:text-gray-300'>
        這裡集中管理家庭區直播來源。後續新增來源，維護這裡即可。
      </div>

      <div className='space-y-3'>
        {sources.map((source) => (
          <div
            key={source.id}
            className='rounded-xl border border-gray-200/70 bg-white p-4 dark:border-gray-700/70 dark:bg-gray-900'
          >
            <div className='mb-1 flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100'>
              <PlayCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
              <span>{source.name}</span>
            </div>
            {source.description && (
              <div className='mb-2 text-sm text-gray-500 dark:text-gray-400'>
                {source.description}
              </div>
            )}
            <div className='mb-3 break-all rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300'>
              {source.url}
            </div>
            <div className='flex flex-wrap gap-2'>
              <button
                type='button'
                onClick={() => copyUrl(source.id, source.url)}
                className='inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
              >
                <Copy className='h-3.5 w-3.5' />
                {copiedId === source.id
                  ? '已複製'
                  : copiedId === `failed-${source.id}`
                  ? '複製失敗'
                  : '複製連結'}
              </button>
              <a
                href={source.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700'
              >
                <ExternalLink className='h-3.5 w-3.5' />
                開啟來源
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
