'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
};

const isIOS = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
};

export function InstallPWA() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!mounted) {
    return <div className='w-10 h-10' />;
  }

  if (installed) {
    return null;
  }

  const canNativeInstall = deferredPrompt !== null;
  const iOS = isIOS();

  // If no native prompt available and not iOS, hide the button entirely
  // (desktop browsers that don't support PWA install, or Android without prompt yet)
  if (!canNativeInstall && !iOS) {
    return null;
  }

  const handleClick = async () => {
    if (canNativeInstall && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    if (iOS) {
      setShowIOSHint(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
        aria-label='安装到主畫面'
        title='安装到主畫面'
      >
        <Download className='w-full h-full' />
      </button>

      {showIOSHint && (
        <div
          className='fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm'
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className='relative w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-xl'
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSHint(false)}
              className='absolute top-3 right-3 p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              aria-label='关闭'
            >
              <X className='w-5 h-5' />
            </button>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3'>
              加入主畫面
            </h2>
            <ol className='space-y-3 text-sm text-gray-700 dark:text-gray-300'>
              <li className='flex items-start gap-2'>
                <span className='flex-shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-semibold'>
                  1
                </span>
                <span>
                  请使用 <b>Safari</b> 浏览器打开本站
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='flex-shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-semibold'>
                  2
                </span>
                <span className='flex items-center gap-1 flex-wrap'>
                  点击底部
                  <Share className='inline w-4 h-4' />
                  「分享」按钮
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='flex-shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-semibold'>
                  3
                </span>
                <span>选择「加入主畫面」</span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='flex-shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-semibold'>
                  4
                </span>
                <span>点击右上角「新增」即可</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSHint(false)}
              className='mt-5 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors'
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
