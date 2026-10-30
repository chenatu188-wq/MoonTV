/* eslint-disable no-console */
'use client';

import { useEffect, useState } from 'react';

/**
 * 一般片源的 key，用来把彩虹频道的播放记录、收藏跟外面分开：不在这里面的都算彩虹频道。
 * keys 还没拿到（或拿不到）是 null，这时两边都不列，免得彩虹频道的片露在首页。
 */
export function useGeneralSources() {
  const [keys, setKeys] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/playrecords/general-sources')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((list: string[]) => setKeys(new Set(list)))
      .catch((error) => console.error('获取片源分类失败:', error))
      .finally(() => setLoading(false));
  }, []);

  return { keys, loading };
}
