'use client';

import { Suspense } from 'react';

import ActressesPanel from '@/components/ActressesPanel';
import PageLayout from '@/components/PageLayout';

function ActressesPageInner() {
  return (
    <PageLayout activePath='/actresses'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            演員資料庫
          </h1>
        </div>
        <ActressesPanel />
      </div>
    </PageLayout>
  );
}

export default function ActressesPage() {
  return (
    <Suspense>
      <ActressesPageInner />
    </Suspense>
  );
}
