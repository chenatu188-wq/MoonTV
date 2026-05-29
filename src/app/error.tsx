'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className='bg-black text-white min-h-screen flex items-center justify-center p-6'>
        <div className='max-w-md text-center space-y-4'>
          <h2 className='text-xl font-semibold'>頁面載入失敗</h2>
          <p className='text-sm text-gray-300'>
            已發生前端錯誤，請點「重新載入」再試一次。
          </p>
          <button
            onClick={() => reset()}
            className='px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white text-sm'
          >
            重新載入
          </button>
        </div>
      </body>
    </html>
  );
}
