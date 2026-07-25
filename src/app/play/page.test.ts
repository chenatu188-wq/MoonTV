import { ensureVideoSource } from '@/lib/video-source';

describe('HLS player source setup', () => {
  it('does not attach a native m3u8 source after Hls.js takes ownership', () => {
    const video = document.createElement('video') as HTMLVideoElement & {
      hls?: unknown;
    };
    video.hls = {};

    ensureVideoSource(video, 'https://example.com/video.m3u8');

    expect(video.querySelector('source')).toBeNull();
    expect(video.hasAttribute('disableRemotePlayback')).toBe(false);
  });

  it('keeps a native source for browsers that are not managed by Hls.js', () => {
    const video = document.createElement('video');

    ensureVideoSource(video, 'https://example.com/video.m3u8');

    expect(video.querySelector('source')?.src).toBe(
      'https://example.com/video.m3u8'
    );
  });
});
