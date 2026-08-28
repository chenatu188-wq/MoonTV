/**
 * AI 漫剧聚合来源。
 *
 * 走 YouTube 官方 RSS（https://www.youtube.com/feeds/videos.xml），
 * 不需要 API key、没有配额限制，播放时用官方 iframe 播放器嵌入，
 * 播放数与广告收益仍归原作者。
 *
 * 要增删来源，直接改这个数组：
 * - 频道：打开频道页，网址 youtube.com/channel/UCxxxx 里的 UCxxxx 就是 id
 * - 播放列表：网址 ?list=PLxxxx 里的 PLxxxx 就是 id
 * 每个来源 RSS 只回最新 15 条，这是 YouTube 的限制。
 */

export interface AiManjuSource {
  /** 内部唯一键 */
  key: string;
  /** 显示名称 */
  name: string;
  type: 'channel' | 'playlist';
  /** UC 开头（频道）或 PL 开头（播放列表） */
  id: string;
}

export const AI_MANJU_SOURCES: AiManjuSource[] = [
  {
    key: 'ai_dongman_duanju',
    name: 'AI动漫短剧',
    type: 'channel',
    id: 'UCrn_1U0FXZICc1np1gzBuYg',
  },
  {
    key: 'ai_manju_list',
    name: 'AI漫剧精选',
    type: 'playlist',
    id: 'PLl-DwTXu3qegv4fekXdtEFwUlljyRO-L0',
  },
  {
    key: 'hot_ai_duanju',
    name: '热门AI短剧',
    type: 'playlist',
    id: 'PLrIcwAmL3er5OW2xaktg1XFGeyyYjXhbF',
  },
  {
    key: 'ai_duanju_manju',
    name: 'AI 短剧-漫剧',
    type: 'playlist',
    id: 'PLWwFFXPVMu4B9LcNj0pQhqDSgLXtl_C0m',
  },
  {
    // 2026-08 验证：能抓到 15 部，但频道最后更新停在 2026-04，属于存量片源
    key: 'zhizun_manju',
    name: '至尊漫剧',
    type: 'channel',
    id: 'UCQ_f1iGR3FE49rnBc9W-JiA',
  },
];

export function feedUrl(source: AiManjuSource): string {
  const param = source.type === 'channel' ? 'channel_id' : 'playlist_id';
  return `https://www.youtube.com/feeds/videos.xml?${param}=${source.id}`;
}
