/**
 * AI 漫剧聚合来源。
 *
 * 走 YouTube 官方 RSS（https://www.youtube.com/feeds/videos.xml），
 * 不需要 API key、没有配额限制，播放时用官方 iframe 播放器嵌入，
 * 播放数与广告收益仍归原作者。
 *
 * 这个数组是「内建来源」，所有装置都看得到。
 * 使用者在页面上「管理追踪」加的来源另外存在浏览器 localStorage
 *（线上是 localstorage 模式，没有伺服器端资料库），不会写回这里。
 *
 * 要增删内建来源，直接改这个数组：
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
  {
    // 使用者指定加入。注意两点：最后更新停在 2025-06（停更逾一年），
    // 且内容是真人短剧（男频爽剧/都市）而非 AI 漫剧，调性与其他来源不同
    key: 'kuangxiao_duanju',
    name: '狂梟短劇',
    type: 'channel',
    id: 'UCTIENIv9maj9KyvNNJTXvaA',
  },
];

export function feedUrl(source: AiManjuSource): string {
  const param = source.type === 'channel' ? 'channel_id' : 'playlist_id';
  return `https://www.youtube.com/feeds/videos.xml?${param}=${source.id}`;
}

/** 频道 id：UC + 22 个字符 */
export const CHANNEL_ID_RE = /^UC[\w-]{22}$/;
/** 播放列表 id：PL / UU / OL / FL 等前缀，长度不固定 */
export const PLAYLIST_ID_RE = /^(PL|UU|OL|FL|RD)[\w-]{10,60}$/;

/** 单次请求最多带多少个使用者自订来源，避免被拿来当抓取跳板 */
export const MAX_CUSTOM_SOURCES = 30;

export function isValidSourceId(
  type: AiManjuSource['type'],
  id: string
): boolean {
  return type === 'channel' ? CHANNEL_ID_RE.test(id) : PLAYLIST_ID_RE.test(id);
}
