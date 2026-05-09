'use client';

import { Home, RotateCcw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 根層 Error Boundary：接住 play/error.tsx 抓不到的全站錯誤
 * （首頁、搜尋頁、路由切換中崩潰等）
 * 提供「返回上一頁 / 回首頁 / 重試」三條出路
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className='min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900'>
      <div className='max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8'>
        <div className='flex justify-center mb-4'>
          <div className='w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center'>
            <AlertTriangle className='w-8 h-8 text-amber-600 dark:text-amber-400' />
          </div>
        </div>

        <h2 className='text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2'>
          發生錯誤了
        </h2>

        <p className='text-sm text-center text-gray-600 dark:text-gray-400 mb-6 leading-relaxed'>
          頁面載入時出了點問題。
          <br />
          按下面任一按鈕都可以
          <span className='font-semibold text-green-600 dark:text-green-400'>
            繼續使用
          </span>
          ，不用重新開瀏覽器。
        </p>

        <div className='space-y-2'>
          <button
            onClick={() => router.back()}
            className='w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition'
          >
            <ArrowLeft className='w-4 h-4' />
            返回上一頁
          </button>

          <button
            onClick={() => router.push('/')}
            className='w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition'
          >
            <Home className='w-4 h-4' />
            回首頁
          </button>

          <button
            onClick={reset}
            className='w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition'
          >
            <RotateCcw className='w-4 h-4' />
            重試
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <details className='mt-6 text-xs text-gray-500 dark:text-gray-400'>
            <summary className='cursor-pointer'>技術細節</summary>
            <pre className='mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded overflow-auto whitespace-pre-wrap break-all'>
              {error.message}
              {error.digest ? `\n\nDigest: ${error.digest}` : ''}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
