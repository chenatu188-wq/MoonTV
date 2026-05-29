'use client';

import { Suspense } from 'react';

import LiveSourcesPanel from '@/components/LiveSourcesPanel';
import NewsLivePlayer from '@/components/NewsLivePlayer';
import PageLayout from '@/components/PageLayout';

function LivePageInner() {
  return (
    <PageLayout activePath='/live'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            電視直播區
          </h1>
        </div>
        <div className='space-y-6'>
          <NewsLivePlayer />
          <LiveSourcesPanel />
        </div>
      </div>
    </PageLayout>
  );
}

export default function LivePage() {
  return (
    <Suspense>
      <LivePageInner />
    </Suspense>
  );
}
