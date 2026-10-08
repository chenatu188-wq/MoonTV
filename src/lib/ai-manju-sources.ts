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
  /**
   * 页面上的分组。不写就是「原有来源」。
   * mine：使用者自己追踪后收进内建的；hongguo：用红果片单反推出来的
   */
  group?: 'mine' | 'hongguo';
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

  // ---- 2026-10-03 使用者原本自己追踪的频道 ----
  // 原本只存在使用者浏览器的 localStorage，清站台资料或换装置就没了，
  // 所以收进内建清单。只拿到频道名称，ID 是用名称上 YouTube 反查的；
  // 同名频道有多个的（極光劇場、霓虹劇場、動漫醬）取 RSS 标题吻合且仍在更新的那个。
  {
    key: 'UCqQmTciheKggwyEiU1ghMbg',
    name: '呦呦声漫',
    type: 'channel',
    group: 'mine',
    id: 'UCqQmTciheKggwyEiU1ghMbg',
  },
  {
    key: 'UCKmBUCoUHofkq_njiTacDKg',
    name: 'John 咩咩劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCKmBUCoUHofkq_njiTacDKg',
  },
  {
    key: 'UCIXjvnAhFma9fn8dJk6dMKg',
    name: '劇翻天 Drama Go',
    type: 'channel',
    group: 'mine',
    id: 'UCIXjvnAhFma9fn8dJk6dMKg',
  },
  {
    key: 'UCmnPFtxclbD8Iq7V7jxRTvg',
    name: '书旗男频',
    type: 'channel',
    group: 'mine',
    id: 'UCmnPFtxclbD8Iq7V7jxRTvg',
  },
  {
    key: 'UCgFXqimhiymRQoE5ahWmOTA',
    name: '洪宇漫剧社',
    type: 'channel',
    group: 'mine',
    id: 'UCgFXqimhiymRQoE5ahWmOTA',
  },
  {
    key: 'UCThwesS-uRQGp4JWBII_X5g',
    name: '毛豆劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCThwesS-uRQGp4JWBII_X5g',
  },
  {
    key: 'UCjoqlK59VsCKFlD8gTyOMxQ',
    name: '麻梨酥',
    type: 'channel',
    group: 'mine',
    id: 'UCjoqlK59VsCKFlD8gTyOMxQ',
  },
  {
    key: 'UCzdd87Kpcv99k1BMEHRerTg',
    name: 'AI諸天漫域',
    type: 'channel',
    group: 'mine',
    id: 'UCzdd87Kpcv99k1BMEHRerTg',
  },
  {
    key: 'UCeQep0WVfyYeOh9k97D03ag',
    name: '極光劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCeQep0WVfyYeOh9k97D03ag',
  },
  {
    key: 'UCG-yIm61pfdXhREgNItZeGw',
    name: '神域劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCG-yIm61pfdXhREgNItZeGw',
  },
  {
    key: 'UC-NROqvtnns-ZCghOnpEx7Q',
    name: '小天说漫',
    type: 'channel',
    group: 'mine',
    id: 'UC-NROqvtnns-ZCghOnpEx7Q',
  },
  {
    key: 'UCNIKva6iDURgVxf44pMZlKA',
    name: '動漫醬',
    type: 'channel',
    group: 'mine',
    id: 'UCNIKva6iDURgVxf44pMZlKA',
  },
  {
    key: 'UCEB4wtsZYmScjDlMPU5rK7Q',
    name: '零号玩家',
    type: 'channel',
    group: 'mine',
    id: 'UCEB4wtsZYmScjDlMPU5rK7Q',
  },
  {
    key: 'UC6z8_JzVkOxaHvHTpEKqhWA',
    name: 'DramaTakdir',
    type: 'channel',
    group: 'mine',
    id: 'UC6z8_JzVkOxaHvHTpEKqhWA',
  },
  {
    key: 'UCThqrNqzKngrnnfJaqhHGnQ',
    name: 'Shortflix Indonesia',
    type: 'channel',
    group: 'mine',
    id: 'UCThqrNqzKngrnnfJaqhHGnQ',
  },
  {
    key: 'UC6ahY73L_9DKxe97N7LjIeg',
    name: 'K迪剧场',
    type: 'channel',
    group: 'mine',
    id: 'UC6ahY73L_9DKxe97N7LjIeg',
  },
  {
    key: 'UC4_o9k05i3siOFqFpKMXgOA',
    name: '反轉研究所',
    type: 'channel',
    group: 'mine',
    id: 'UC4_o9k05i3siOFqFpKMXgOA',
  },
  {
    key: 'UC4nze-u8IFyKP_IoySr7eyA',
    name: '天龍短劇',
    type: 'channel',
    group: 'mine',
    id: 'UC4nze-u8IFyKP_IoySr7eyA',
  },
  {
    key: 'UC80ztI40QAXzWL94eoRzWow',
    name: '破晓动漫社 Dawn Anime Club',
    type: 'channel',
    group: 'mine',
    id: 'UC80ztI40QAXzWL94eoRzWow',
  },
  {
    key: 'UCR4pgG2iWLVjG3_COblHuxw',
    name: '劇好看短剧社',
    type: 'channel',
    group: 'mine',
    id: 'UCR4pgG2iWLVjG3_COblHuxw',
  },
  {
    key: 'UCUpppsP5x1KHIAwfIujFMIg',
    name: '世界短劇',
    type: 'channel',
    group: 'mine',
    id: 'UCUpppsP5x1KHIAwfIujFMIg',
  },
  {
    key: 'UCvDPu4fdYcjhNPPZwx6HP_A',
    name: 'スカッとコミックTV',
    type: 'channel',
    group: 'mine',
    id: 'UCvDPu4fdYcjhNPPZwx6HP_A',
  },
  {
    key: 'UC0SQ3_05y-M5u9D7__01UCA',
    name: '霓虹劇場',
    type: 'channel',
    group: 'mine',
    id: 'UC0SQ3_05y-M5u9D7__01UCA',
  },
  {
    key: 'UCNlnDUN5cnbrD89CDMjdpKg',
    name: '奧巴牛劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCNlnDUN5cnbrD89CDMjdpKg',
  },
  {
    key: 'UCE9_C2Abv6Btu2OTS4kHzJg',
    name: '平庸群俠傳',
    type: 'channel',
    group: 'mine',
    id: 'UCE9_C2Abv6Btu2OTS4kHzJg',
  },
  {
    key: 'UCLozNYtPze8KdchwQ0Pseew',
    name: 'AAAAAIGC',
    type: 'channel',
    group: 'mine',
    id: 'UCLozNYtPze8KdchwQ0Pseew',
  },
  {
    key: 'UCD83uFljm89w9AvlRYlcSWQ',
    name: '油油爆劇 Drama Hub',
    type: 'channel',
    group: 'mine',
    id: 'UCD83uFljm89w9AvlRYlcSWQ',
  },
  {
    key: 'UCKRjxZ12mnnd6o3IuYvxSZA',
    name: '月笙短劇社Drama',
    type: 'channel',
    group: 'mine',
    id: 'UCKRjxZ12mnnd6o3IuYvxSZA',
  },
  // 2026-10-09 使用者第二批追踪清单（原本只存在他自己的浏览器，换装置就看不到）。
  // 同名频道取订阅数高且仍在更新的；「光影集_JIA」YouTube 上的全名是「微光影集_JIA」。
  {
    key: 'UC-cC29chn32Cla68hJ-U9Tw',
    name: 'Jlee Caruso',
    type: 'channel',
    group: 'mine',
    id: 'UC-cC29chn32Cla68hJ-U9Tw',
  },
  {
    key: 'UCPh5xxqu-Ffo945eX6M2ynA',
    name: '漫談小說',
    type: 'channel',
    group: 'mine',
    id: 'UCPh5xxqu-Ffo945eX6M2ynA',
  },
  {
    key: 'UC0ObQc5Z563zVVWzZaLCBmg',
    name: '柠柠动漫社 NingNing Anime Club',
    type: 'channel',
    group: 'mine',
    id: 'UC0ObQc5Z563zVVWzZaLCBmg',
  },
  {
    key: 'UC6_mT2DJq70rvyOxp2oUdUA',
    name: '清风仙客',
    type: 'channel',
    group: 'mine',
    id: 'UC6_mT2DJq70rvyOxp2oUdUA',
  },
  {
    key: 'UCwEueD0MZvIXGqAA73xRslg',
    name: '墨鸢漫社',
    type: 'channel',
    group: 'mine',
    id: 'UCwEueD0MZvIXGqAA73xRslg',
  },
  {
    key: 'UC9dvBnuCL8hrKEoOIjWumFg',
    name: '糖糖微笑社',
    type: 'channel',
    group: 'mine',
    id: 'UC9dvBnuCL8hrKEoOIjWumFg',
  },
  {
    key: 'UCE-nPj1gsDyv455wtrcmg9A',
    name: '狂枭漫影',
    type: 'channel',
    group: 'mine',
    id: 'UCE-nPj1gsDyv455wtrcmg9A',
  },
  {
    key: 'UCljnquluyAzySf5TTi8t3aA',
    name: 'LiangDou Studio',
    type: 'channel',
    group: 'mine',
    id: 'UCljnquluyAzySf5TTi8t3aA',
  },
  {
    key: 'UCY0rMrpCLa6Ms7I_jb4ImvA',
    name: '喵喵推文',
    type: 'channel',
    group: 'mine',
    id: 'UCY0rMrpCLa6Ms7I_jb4ImvA',
  },
  {
    key: 'UCPJyBkY8jP3wMrAlL7gmcfw',
    name: '香吉士劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCPJyBkY8jP3wMrAlL7gmcfw',
  },
  {
    key: 'UCZhwzL210yIq1Xrg-UIbF3Q',
    name: 'AI狂龍影視',
    type: 'channel',
    group: 'mine',
    id: 'UCZhwzL210yIq1Xrg-UIbF3Q',
  },
  {
    key: 'UC_CksANHRXP31NkRrIK0ipg',
    name: '微光影集_JIA',
    type: 'channel',
    group: 'mine',
    id: 'UC_CksANHRXP31NkRrIK0ipg',
  },
  {
    key: 'UCwRC4dJsEWP5Itavo4cxuoQ',
    name: '潛龍劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCwRC4dJsEWP5Itavo4cxuoQ',
  },
  {
    key: 'UCN8dDs4an9PXkH3uv06bJYA',
    name: '爆裂劇場',
    type: 'channel',
    group: 'mine',
    id: 'UCN8dDs4an9PXkH3uv06bJYA',
  },
  {
    key: 'UChRUa6IaswAdaQ8DVpF6Tpw',
    name: '云曜剧场',
    type: 'channel',
    group: 'mine',
    id: 'UChRUa6IaswAdaQ8DVpF6Tpw',
  },
  {
    key: 'UCHjO8vnMW7_WjTJE1jxycLg',
    name: '覺醒看爽劇',
    type: 'channel',
    group: 'mine',
    id: 'UCHjO8vnMW7_WjTJE1jxycLg',
  },
  {
    key: 'UCs28Bv3msNkvdCJWu3rBTSQ',
    name: 'CoarseThread',
    type: 'channel',
    group: 'mine',
    id: 'UCs28Bv3msNkvdCJWu3rBTSQ',
  },
  {
    key: 'UC_zxATHsOa-KCE5EJVLe3ng',
    name: '短剧实验室MiniDrama Lab',
    type: 'channel',
    group: 'mine',
    id: 'UC_zxATHsOa-KCE5EJVLe3ng',
  },

  // ---- 2026-10-04 用红果短剧片单反推的频道 ----
  // 红果官网（hongguoduanju.com）只有片单不能播放，所以拿它「AI剧 / 漫剧」分类下的
  // 376 部片名逐一搜 YouTube，统计是哪些频道在发这些剧。
  // 收录条件：至少发过其中 4 部，且近 30 天仍在更新。依命中部数由多到少排列。
  {
    key: 'UCczN8r_MV0TvxhwthCsrYNQ',
    name: '漫野推文',
    type: 'channel',
    group: 'hongguo',
    id: 'UCczN8r_MV0TvxhwthCsrYNQ',
  },
  {
    key: 'UCjCpwP4k61ctKTtrrgkg6kA',
    name: '追光动漫社 Light Anime Club',
    type: 'channel',
    group: 'hongguo',
    id: 'UCjCpwP4k61ctKTtrrgkg6kA',
  },
  {
    key: 'UCJU1GNtZuoqgUvEwi1rf1_w',
    name: 'DramaBox',
    type: 'channel',
    group: 'hongguo',
    id: 'UCJU1GNtZuoqgUvEwi1rf1_w',
  },
  {
    key: 'UCJMfjoI8sohMbI-kn9oXNxA',
    name: '不知名的小作者',
    type: 'channel',
    group: 'hongguo',
    id: 'UCJMfjoI8sohMbI-kn9oXNxA',
  },
  {
    key: 'UCbLEN8F4S-Di3jO0Hs3ti2A',
    name: 'AI漫劇社',
    type: 'channel',
    group: 'hongguo',
    id: 'UCbLEN8F4S-Di3jO0Hs3ti2A',
  },
  {
    key: 'UCqfz8iwtLJlPfEFy3TQn83g',
    name: 'パラレルワールド',
    type: 'channel',
    group: 'hongguo',
    id: 'UCqfz8iwtLJlPfEFy3TQn83g',
  },
  {
    key: 'UCUXrl1P2S4wKjIARCS8oeuw',
    name: 'Laikan IN',
    type: 'channel',
    group: 'hongguo',
    id: 'UCUXrl1P2S4wKjIARCS8oeuw',
  },
  {
    key: 'UCUZmvPmq9ll2Fl_X7n9e3AQ',
    name: '动漫人生',
    type: 'channel',
    group: 'hongguo',
    id: 'UCUZmvPmq9ll2Fl_X7n9e3AQ',
  },
  {
    key: 'UChI63zf1_5SofTX1TQcRRow',
    name: '九州快看',
    type: 'channel',
    group: 'hongguo',
    id: 'UChI63zf1_5SofTX1TQcRRow',
  },
  {
    key: 'UCHgoTHtYblynGuKiQF2EBZw',
    name: '呆瓜小姐',
    type: 'channel',
    group: 'hongguo',
    id: 'UCHgoTHtYblynGuKiQF2EBZw',
  },
  {
    key: 'UCpBFz0nUikI7ZKbRIlCJoGg',
    name: '天美短剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCpBFz0nUikI7ZKbRIlCJoGg',
  },
  {
    key: 'UC84ip2SCnmwJVaHDgq3ZNYA',
    name: '青天大老爷 Anime',
    type: 'channel',
    group: 'hongguo',
    id: 'UC84ip2SCnmwJVaHDgq3ZNYA',
  },
  {
    key: 'UC-8q07STIvEJKPUgeKYayhQ',
    name: '爆笑漫舍ShortPlay',
    type: 'channel',
    group: 'hongguo',
    id: 'UC-8q07STIvEJKPUgeKYayhQ',
  },
  {
    key: 'UCnDpkwcFpwCqJeSiYXDHyeQ',
    name: '深夜漫剧社 🌙',
    type: 'channel',
    group: 'hongguo',
    id: 'UCnDpkwcFpwCqJeSiYXDHyeQ',
  },
  {
    key: 'UCicmgAxKOHbG8oW3Dk_R_gA',
    name: '888AI漫剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCicmgAxKOHbG8oW3Dk_R_gA',
  },
  {
    key: 'UC-TWHPRXtuxYqjDkPU1y30w',
    name: '漫剧天堂',
    type: 'channel',
    group: 'hongguo',
    id: 'UC-TWHPRXtuxYqjDkPU1y30w',
  },
  {
    key: 'UCAcqNGBAwJbKDHHaRLkKVDg',
    name: 'GuoManDT',
    type: 'channel',
    group: 'hongguo',
    id: 'UCAcqNGBAwJbKDHHaRLkKVDg',
  },
  {
    key: 'UClLFAdpuxe1mHQgRkU6A2jQ',
    name: '娇娇 Mini drama',
    type: 'channel',
    group: 'hongguo',
    id: 'UClLFAdpuxe1mHQgRkU6A2jQ',
  },
  {
    key: 'UCeLHAHAGBuIBC35pOQpJTtg',
    name: '霸榜短劇',
    type: 'channel',
    group: 'hongguo',
    id: 'UCeLHAHAGBuIBC35pOQpJTtg',
  },
  {
    key: 'UCqXsQdhnaAbHQRR2EfGu4IA',
    name: '小猫漫谈',
    type: 'channel',
    group: 'hongguo',
    id: 'UCqXsQdhnaAbHQRR2EfGu4IA',
  },
  {
    key: 'UCX-aRQ8LjZ_Gp448l3iq_Ow',
    name: '云阙短剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCX-aRQ8LjZ_Gp448l3iq_Ow',
  },
  {
    key: 'UC3_d0jIw-voCLXfLiQCe3ug',
    name: '零号梦魇',
    type: 'channel',
    group: 'hongguo',
    id: 'UC3_d0jIw-voCLXfLiQCe3ug',
  },
  {
    key: 'UCxYT6Zt-rDSQXJsR3bT3yGQ',
    name: '玉影剧场',
    type: 'channel',
    group: 'hongguo',
    id: 'UCxYT6Zt-rDSQXJsR3bT3yGQ',
  },
  {
    key: 'UCcWBfwuamRt15FECRt0MENA',
    name: '爽文劇',
    type: 'channel',
    group: 'hongguo',
    id: 'UCcWBfwuamRt15FECRt0MENA',
  },
  {
    key: 'UCaO_83tDE1cULyVOObwswIQ',
    name: '蝉鸣漫剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCaO_83tDE1cULyVOObwswIQ',
  },
  {
    key: 'UCnsVkke7tY6hCUFZxplDseA',
    name: '橙橙劇場',
    type: 'channel',
    group: 'hongguo',
    id: 'UCnsVkke7tY6hCUFZxplDseA',
  },
  {
    key: 'UCy-DMpmGa4atHuejIVs3Kew',
    name: '千禧剧场',
    type: 'channel',
    group: 'hongguo',
    id: 'UCy-DMpmGa4atHuejIVs3Kew',
  },
  {
    key: 'UC0RrJBFeB44I606jbY-bVvQ',
    name: '見隱密境',
    type: 'channel',
    group: 'hongguo',
    id: 'UC0RrJBFeB44I606jbY-bVvQ',
  },
  {
    key: 'UCVKhgDZsUpKPApDEgkCjCkQ',
    name: '溫予漫劇社',
    type: 'channel',
    group: 'hongguo',
    id: 'UCVKhgDZsUpKPApDEgkCjCkQ',
  },
  {
    key: 'UCuuAI1xXy3ncx-s23Zs3Jig',
    name: 'TACO漫剧 Animation',
    type: 'channel',
    group: 'hongguo',
    id: 'UCuuAI1xXy3ncx-s23Zs3Jig',
  },
  {
    key: 'UCoQbbWu6qnDEs_Z_XgWwu6Q',
    name: '动画电影日记',
    type: 'channel',
    group: 'hongguo',
    id: 'UCoQbbWu6qnDEs_Z_XgWwu6Q',
  },
  {
    key: 'UCyF1RiWMcJdn0gV8bw29lRQ',
    name: '飞扬漫剧TV',
    type: 'channel',
    group: 'hongguo',
    id: 'UCyF1RiWMcJdn0gV8bw29lRQ',
  },
  {
    key: 'UCVokxxjZOIJQB_HbgpmbFPQ',
    name: '漫影流光',
    type: 'channel',
    group: 'hongguo',
    id: 'UCVokxxjZOIJQB_HbgpmbFPQ',
  },
  {
    key: 'UCo2NKBbubJ8vyQm4Tw8imsQ',
    name: '星绘说漫',
    type: 'channel',
    group: 'hongguo',
    id: 'UCo2NKBbubJ8vyQm4Tw8imsQ',
  },
  {
    key: 'UCK4FaUYmHCw3nWPlG8Ceylw',
    name: '面包小剧场',
    type: 'channel',
    group: 'hongguo',
    id: 'UCK4FaUYmHCw3nWPlG8Ceylw',
  },
  {
    key: 'UCOkOP7EqZjoQZAvN6mLb6jw',
    name: '萌萌漫剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCOkOP7EqZjoQZAvN6mLb6jw',
  },
  {
    key: 'UCG6hzJFIZFpc7bJ36OfS6kg',
    name: '幻境高清剧场',
    type: 'channel',
    group: 'hongguo',
    id: 'UCG6hzJFIZFpc7bJ36OfS6kg',
  },
  {
    key: 'UCtvPSJoFDJTg1TncA12Dzfg',
    name: '奶茶短劇',
    type: 'channel',
    group: 'hongguo',
    id: 'UCtvPSJoFDJTg1TncA12Dzfg',
  },
  {
    key: 'UC3xQ7uPZc5qJLUWMe0JXDXA',
    name: '尼尼剧场',
    type: 'channel',
    group: 'hongguo',
    id: 'UC3xQ7uPZc5qJLUWMe0JXDXA',
  },
  {
    key: 'UC3ilrrUQZ9NWcjuPtE5HmlA',
    name: '比巴卜短剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UC3ilrrUQZ9NWcjuPtE5HmlA',
  },
  {
    key: 'UCIoxqZ8J_VxM-0rPQm1nNbQ',
    name: 'KCM Rv',
    type: 'channel',
    group: 'hongguo',
    id: 'UCIoxqZ8J_VxM-0rPQm1nNbQ',
  },
  {
    key: 'UCIYUPRynNLfDF3_SSacRtMw',
    name: '孤月',
    type: 'channel',
    group: 'hongguo',
    id: 'UCIYUPRynNLfDF3_SSacRtMw',
  },
  {
    key: 'UCTi0DMHQbiU6jt8PQGoPgXg',
    name: '秦逸さん',
    type: 'channel',
    group: 'hongguo',
    id: 'UCTi0DMHQbiU6jt8PQGoPgXg',
  },
  {
    key: 'UCj8ZSTfmZXt1y_GX4gpVrmQ',
    name: 'CJ Anime Studio',
    type: 'channel',
    group: 'hongguo',
    id: 'UCj8ZSTfmZXt1y_GX4gpVrmQ',
  },
  {
    key: 'UC15m_0cFPBan52Yxp_vwf9g',
    name: '智绘漫影',
    type: 'channel',
    group: 'hongguo',
    id: 'UC15m_0cFPBan52Yxp_vwf9g',
  },
  {
    key: 'UCcOS0AG56onO3P0sfNh4h_g',
    name: '漫聽時光',
    type: 'channel',
    group: 'hongguo',
    id: 'UCcOS0AG56onO3P0sfNh4h_g',
  },
  {
    key: 'UCOLlkS290dKh-v8iDIM6NGA',
    name: '妙妙漫剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCOLlkS290dKh-v8iDIM6NGA',
  },
  {
    key: 'UCoBvn6c9rvkskiuc7ZDS8KQ',
    name: '金光动漫社',
    type: 'channel',
    group: 'hongguo',
    id: 'UCoBvn6c9rvkskiuc7ZDS8KQ',
  },
  {
    key: 'UCAylP-dfcI51BchxSVHqCIQ',
    name: '南柯追漫剧',
    type: 'channel',
    group: 'hongguo',
    id: 'UCAylP-dfcI51BchxSVHqCIQ',
  },
  {
    key: 'UC59T80NEtlWCIB22ZZ2f2Vg',
    name: '啟動',
    type: 'channel',
    group: 'hongguo',
    id: 'UC59T80NEtlWCIB22ZZ2f2Vg',
  },
  {
    key: 'UCP9N46LjGL-_UkhiEMxfMug',
    name: '九菇凉',
    type: 'channel',
    group: 'hongguo',
    id: 'UCP9N46LjGL-_UkhiEMxfMug',
  },
  {
    key: 'UCAIJIl77GwibmJoCgnO0f8w',
    name: 'webdrama',
    type: 'channel',
    group: 'hongguo',
    id: 'UCAIJIl77GwibmJoCgnO0f8w',
  },
  {
    key: 'UCRvbvEGaLdyfIp9x-gVvXGw',
    name: 'Sakuraxplay Animation',
    type: 'channel',
    group: 'hongguo',
    id: 'UCRvbvEGaLdyfIp9x-gVvXGw',
  },
  {
    key: 'UCCAtlYwGZiOUD3SENIwqtyQ',
    name: '星梦动漫Anime Studio',
    type: 'channel',
    group: 'hongguo',
    id: 'UCCAtlYwGZiOUD3SENIwqtyQ',
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
