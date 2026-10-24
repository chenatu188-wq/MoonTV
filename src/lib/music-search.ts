/**
 * 音乐分区的 YouTube 搜寻：结果以音乐为主。纯函数。
 * YouTube 搜寻没有「只搜音乐」的开关，所以多搜一次「关键字 + 歌曲」，
 * 再照标题、频道名里的音乐字眼重排，明显不是音乐的（解说、教学、短剧…）拿掉。
 */
import type { YtVideo } from '@/lib/ai-manju-youtube';

const MUSIC_RE =
  /\bMV\b|M\/V|official|官方|歌词|歌詞|lyrics?|\baudio\b|音乐|音樂|music|翻唱|cover|\blive\b|演唱|单曲|單曲|专辑|專輯|伴奏|纯音乐|純音樂|钢琴|鋼琴|piano|instrumental|歌曲|新歌|主题曲|主題曲|插曲|片尾曲|片头曲|片頭曲|OST|playlist|歌单|歌單|\bremix\b|伴唱|KTV|卡拉OK|- Topic|VEVO|唱片|Records/i;
const NOT_MUSIC_RE =
  /reaction|反应|反應|教学|教學|教程|tutorial|解说|解說|新闻|新聞|开箱|開箱|vlog|短剧|短劇|漫剧|漫劇|电影解说|電影解說|访谈|訪談|采访|採訪|综艺|綜藝|搞笑|游戏|遊戲|gameplay|怎么唱|怎麼唱|发声|發聲|声乐课|聲樂課/i;

/** 音乐分数：大于 0 像音乐，小于 0 明显不是 */
export function musicScore(v: Pick<YtVideo, 'title' | 'channel'>): number {
  const text = `${v.title} ${v.channel}`;
  if (NOT_MUSIC_RE.test(text)) return -1;
  return MUSIC_RE.test(text) ? 1 : 0;
}

/** 两次搜寻结果合并去重，像音乐的排前面（同分照 YouTube 原本的顺序），不是音乐的拿掉 */
export function rankMusic(...lists: YtVideo[][]): YtVideo[] {
  const seen = new Set<string>();
  const merged: YtVideo[] = [];
  // 两份清单交错合并，原本排前面的仍排前面
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      const v = l[i];
      if (!v || seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      merged.push(v);
    }
  }
  return merged
    .map((v, i) => ({ v, i, s: musicScore(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.v);
}
