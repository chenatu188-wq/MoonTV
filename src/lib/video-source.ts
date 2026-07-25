type HlsManagedVideo = HTMLVideoElement & {
  hls?: unknown;
};

export function ensureVideoSource(video: HTMLVideoElement | null, url: string) {
  if (!video || !url) return;

  // Hls.js 透過 MediaSource 管理 video.src；再插入原生 m3u8 <source>
  // 會讓不支援原生 HLS 的瀏覽器先拋出格式錯誤。
  if (!(video as HlsManagedVideo).hls) {
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((source) => source.src === url);
    if (!existed) {
      sources.forEach((source) => source.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }
  }

  video.disableRemotePlayback = false;
  if (video.hasAttribute('disableRemotePlayback')) {
    video.removeAttribute('disableRemotePlayback');
  }
}
