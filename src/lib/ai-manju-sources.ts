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

  // ---- 2026-10-03 批次加入 ----
  // 用「AI短剧 / AI漫剧」等 26 组关键字搜 YouTube 近一个月的影片，统计发布频道，
  // 再逐一抓 RSS 验证：近 30 天至少 8 支新片，且标题或频道名明确标示 AI / 漫剧 / 动漫。
  // 标题完全没有 AI 标示的（多半是真人短剧）没有收。key 直接用频道 id。
  {
    key: 'UCbM7SQSOEpla-sDOkpdNouQ',
    name: 'KK爱看',
    type: 'channel',
    id: 'UCbM7SQSOEpla-sDOkpdNouQ',
  },
  {
    key: 'UC_GcrznCXn6b-i1Y7DOn54A',
    name: '盛世短剧',
    type: 'channel',
    id: 'UC_GcrznCXn6b-i1Y7DOn54A',
  },
  {
    key: 'UCVkssQQGvuQRo-KBEelyahA',
    name: '星星AI剧',
    type: 'channel',
    id: 'UCVkssQQGvuQRo-KBEelyahA',
  },
  {
    key: 'UC_wFVsA9do4LfmKudQKvGYA',
    name: '瑤瑤AI短劇',
    type: 'channel',
    id: 'UC_wFVsA9do4LfmKudQKvGYA',
  },
  {
    key: 'UCxG84YR9x284WGcbL0nX40A',
    name: '月栖漫剧',
    type: 'channel',
    id: 'UCxG84YR9x284WGcbL0nX40A',
  },
  {
    key: 'UCfcT0S0M3dMgThjdiLheSpA',
    name: '超燃劇場',
    type: 'channel',
    id: 'UCfcT0S0M3dMgThjdiLheSpA',
  },
  {
    key: 'UCPk97AuvU6eORLrNIB07C8g',
    name: '日笙短劇社',
    type: 'channel',
    id: 'UCPk97AuvU6eORLrNIB07C8g',
  },
  {
    key: 'UCYCTqlpYxz8aNCPqIkLl4DA',
    name: 'Lunaria 月光剧场',
    type: 'channel',
    id: 'UCYCTqlpYxz8aNCPqIkLl4DA',
  },
  {
    key: 'UCXvvujKL8v75OXClJizT0xA',
    name: '木木ai剧社',
    type: 'channel',
    id: 'UCXvvujKL8v75OXClJizT0xA',
  },
  {
    key: 'UCzY_QBd7u2Bpylm4haL1jig',
    name: '小璃 Anime Xiaoli Anime',
    type: 'channel',
    id: 'UCzY_QBd7u2Bpylm4haL1jig',
  },
  {
    key: 'UCUbOy6hRMrC-N7NZnE_OJtw',
    name: '墨影次元放映局',
    type: 'channel',
    id: 'UCUbOy6hRMrC-N7NZnE_OJtw',
  },
  {
    key: 'UCJSAZ5pbDi8StbSbJI1riEg',
    name: 'Qixiang-Animation',
    type: 'channel',
    id: 'UCJSAZ5pbDi8StbSbJI1riEg',
  },
  {
    key: 'UC6FFUpWll3C5cWpL9qqekxg',
    name: '云霄短劇',
    type: 'channel',
    id: 'UC6FFUpWll3C5cWpL9qqekxg',
  },
  {
    key: 'UC97omzXOE5mqdtqYlMC2bTQ',
    name: '果果漫剧',
    type: 'channel',
    id: 'UC97omzXOE5mqdtqYlMC2bTQ',
  },
  {
    key: 'UCEs_tHO5w9MiXOXdvOFWUlg',
    name: '香香漫剧',
    type: 'channel',
    id: 'UCEs_tHO5w9MiXOXdvOFWUlg',
  },
  {
    key: 'UCXF84j3cGh2ASWG8yosKXTw',
    name: '动漫剧社—Anime Drama Club',
    type: 'channel',
    id: 'UCXF84j3cGh2ASWG8yosKXTw',
  },
  {
    key: 'UCdUQKJevMxUPJSpEXKPtj0g',
    name: '雾漫放映厅',
    type: 'channel',
    id: 'UCdUQKJevMxUPJSpEXKPtj0g',
  },
  {
    key: 'UCW3mgYRnDsMobvTOH3bHP3A',
    name: '红发漫剧',
    type: 'channel',
    id: 'UCW3mgYRnDsMobvTOH3bHP3A',
  },
  {
    key: 'UCn_t2_Dgr5Y6V5WD4UER4zg',
    name: 'AI心動劇場 | AI HeartBeat Drama',
    type: 'channel',
    id: 'UCn_t2_Dgr5Y6V5WD4UER4zg',
  },
  {
    key: 'UC0QTWE_tO_9QxxVrIT1s1Uw',
    name: '糖分短剧',
    type: 'channel',
    id: 'UC0QTWE_tO_9QxxVrIT1s1Uw',
  },
  {
    key: 'UCEe4F35j1Ovc9w3S6lufYbA',
    name: '霓裳智造',
    type: 'channel',
    id: 'UCEe4F35j1Ovc9w3S6lufYbA',
  },
  {
    key: 'UCR7McjI1lbdvFzkew4qyqKw',
    name: '观漫小筑',
    type: 'channel',
    id: 'UCR7McjI1lbdvFzkew4qyqKw',
  },
  {
    key: 'UC465Gxs13TbSFpdfcDCcwGw',
    name: '夢劇場D-Drama',
    type: 'channel',
    id: 'UC465Gxs13TbSFpdfcDCcwGw',
  },
  {
    key: 'UCBp86M0Lnb6tHK9Y-FJ6lbw',
    name: 'Meow動漫劇場',
    type: 'channel',
    id: 'UCBp86M0Lnb6tHK9Y-FJ6lbw',
  },
  {
    key: 'UCwF5xZ0FXuT_QK63alGmVJQ',
    name: '春夏剧场 ChunxiaTV',
    type: 'channel',
    id: 'UCwF5xZ0FXuT_QK63alGmVJQ',
  },
  {
    key: 'UCeTykVarVftzf2P2dKGyaWA',
    name: 'DramaVibe',
    type: 'channel',
    id: 'UCeTykVarVftzf2P2dKGyaWA',
  },
  {
    key: 'UCLtP82_CqCDg4btLh8fjW8Q',
    name: '小花漫剧社',
    type: 'channel',
    id: 'UCLtP82_CqCDg4btLh8fjW8Q',
  },
  {
    key: 'UCpQRDKRv1WoylE51b54u9Sw',
    name: '月光劇場',
    type: 'channel',
    id: 'UCpQRDKRv1WoylE51b54u9Sw',
  },
  {
    key: 'UCe7m4IES5eRpLS873sCPuBw',
    name: 'AI漫剧家',
    type: 'channel',
    id: 'UCe7m4IES5eRpLS873sCPuBw',
  },
  {
    key: 'UCsfp26rHGXnFEkWbk-oNV2g',
    name: '墨野短剧社',
    type: 'channel',
    id: 'UCsfp26rHGXnFEkWbk-oNV2g',
  },
  {
    key: 'UC0ssEy2rlVnpVIORFioPb0w',
    name: '吾里短剧馆',
    type: 'channel',
    id: 'UC0ssEy2rlVnpVIORFioPb0w',
  },
  {
    key: 'UCErk2vi3Zp8mqnetuhhT71Q',
    name: '次元剧场',
    type: 'channel',
    id: 'UCErk2vi3Zp8mqnetuhhT71Q',
  },
  {
    key: 'UCRnE8hPrYQVenrzVWMA4pew',
    name: '疯狂漫剧城',
    type: 'channel',
    id: 'UCRnE8hPrYQVenrzVWMA4pew',
  },
  {
    key: 'UCZkAakWcDk8B-ZYGgdn8kkA',
    name: '玉儿漫剧',
    type: 'channel',
    id: 'UCZkAakWcDk8B-ZYGgdn8kkA',
  },
  {
    key: 'UCxy1MVIEZE1Io4BKnSa91IA',
    name: '漫阅万事屋',
    type: 'channel',
    id: 'UCxy1MVIEZE1Io4BKnSa91IA',
  },
  {
    key: 'UC5FQ3sxZsjxD9Bej9PsPt9Q',
    name: '爱看动漫Animation',
    type: 'channel',
    id: 'UC5FQ3sxZsjxD9Bej9PsPt9Q',
  },
  {
    key: 'UCIYGYkbgYMOU6n5pd6aQVNA',
    name: '每天新漫劇(AI橫屏)',
    type: 'channel',
    id: 'UCIYGYkbgYMOU6n5pd6aQVNA',
  },
  {
    key: 'UCeudxIz9DgQ5vhoxQ4OSmSg',
    name: 'Minisaga',
    type: 'channel',
    id: 'UCeudxIz9DgQ5vhoxQ4OSmSg',
  },
  {
    key: 'UCvgmSLnWdwfAhRrW7csDgNA',
    name: '小野漫劇社',
    type: 'channel',
    id: 'UCvgmSLnWdwfAhRrW7csDgNA',
  },
  {
    key: 'UCg8XcB-9le4fS3eVxX2nSmQ',
    name: '清禾剧场',
    type: 'channel',
    id: 'UCg8XcB-9le4fS3eVxX2nSmQ',
  },
  {
    key: 'UCctjgGDG4CTUz-x3RRMRvzA',
    name: 'AI 劇迷 Pro',
    type: 'channel',
    id: 'UCctjgGDG4CTUz-x3RRMRvzA',
  },
  {
    key: 'UC6mpCil92txdqq7iAoZlqXw',
    name: '青遥动漫',
    type: 'channel',
    id: 'UC6mpCil92txdqq7iAoZlqXw',
  },
  {
    key: 'UC9XWDhiyyUDaP2xW96YJMZQ',
    name: 'ONE动态漫',
    type: 'channel',
    id: 'UC9XWDhiyyUDaP2xW96YJMZQ',
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
