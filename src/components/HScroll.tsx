'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 横向卷动的一排卡片，两端还有内容时显示左右箭头。
 * 桌机没有触控滑动，卷轴又不明显，要靠箭头翻到后面。
 * resetKey 变了（换分页）就卷回最前面。
 */
export default function HScroll({
  resetKey,
  arrowTop,
  children,
}: {
  resetKey: string;
  arrowTop: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el)
      el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  useEffect(() => {
    ref.current?.scrollTo({ left: 0 });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [resetKey, update]);

  const arrow =
    'absolute z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-gray-800 shadow-lg hover:bg-gray-100 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600';

  return (
    <div className='relative'>
      {edge.left && (
        <button
          aria-label='往前'
          onClick={() => scroll(-1)}
          className={`${arrow} left-0 -translate-x-1/3`}
          style={{ top: arrowTop }}
        >
          ‹
        </button>
      )}
      {edge.right && (
        <button
          aria-label='往后'
          onClick={() => scroll(1)}
          className={`${arrow} right-0 translate-x-1/3`}
          style={{ top: arrowTop }}
        >
          ›
        </button>
      )}
      <div
        ref={ref}
        onScroll={update}
        className='flex gap-3 overflow-x-auto pb-2'
      >
        {children}
      </div>
    </div>
  );
}
