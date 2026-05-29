'use client';

import Hls from 'hls.js';
import { Radio } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type NewsChannel = {
  name: string;
  url: string;
};

export default function NewsLivePlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [channels, setChannels] = useState<NewsChannel[]>([]);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeName, setActiveName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadChannels = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch('/api/live/news');
        if (!resp.ok) throw new Error('load failed');
        const list: NewsChannel[] = await resp.json();
        if (cancelled) return;
        setChannels(list);
        if (list.length > 0) {
          setActiveName(list[0].name);
          setActiveUrl(list[0].url);
        }
      } catch {
        if (!cancelled) {
          setError('新聞頻道清單載入失敗，請稍後重試。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(activeUrl);
      hls.attachMedia(video);
    } else {
      video.src = activeUrl;
    }

    video.play().catch(() => {
      setError('瀏覽器限制自動播放，請按播放器播放鍵。');
    });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeUrl]);

  const filteredChannels = useMemo(() => {
    if (!filter.trim()) return channels;
    const q = filter.trim().toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, filter]);

  return (
    <div className='rounded-2xl border border-gray-200/70 bg-white/70 p-4 sm:p-6 dark:border-gray-700/70 dark:bg-gray-900/50'>
      <div className='mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-100'>
        <Radio className='h-5 w-5 text-red-500' />
        <span>新聞直播</span>
      </div>

      <div className='mb-3 text-sm text-gray-600 dark:text-gray-300'>
        直接點頻道即可播放，先從新聞台開始。
      </div>

      <div className='mb-4 overflow-hidden rounded-xl bg-black'>
        <video
          ref={videoRef}
          controls
          playsInline
          className='h-[220px] w-full bg-black sm:h-[380px]'
        />
      </div>

      {activeName && (
        <div className='mb-3 text-sm text-gray-700 dark:text-gray-300'>
          目前播放：<span className='font-semibold'>{activeName}</span>
        </div>
      )}

      <div className='mb-3'>
        <input
          type='text'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder='搜尋新聞頻道'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
        />
      </div>

      {loading && (
        <div className='text-sm text-gray-500 dark:text-gray-400'>
          載入頻道中…
        </div>
      )}

      {error && <div className='text-sm text-red-500'>{error}</div>}

      {!loading && !error && (
        <div className='max-h-[300px] space-y-2 overflow-y-auto pr-1'>
          {filteredChannels.map((channel) => (
            <button
              key={`${channel.name}-${channel.url}`}
              onClick={() => {
                setActiveName(channel.name);
                setActiveUrl(channel.url);
              }}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                activeUrl === channel.url
                  ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {channel.name}
            </button>
          ))}
          {filteredChannels.length === 0 && (
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              沒找到符合條件的頻道
            </div>
          )}
        </div>
      )}
    </div>
  );
}
