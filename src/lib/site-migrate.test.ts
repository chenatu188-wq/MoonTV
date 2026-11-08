/**
 * @jest-environment node
 */
import { CompressionStream, DecompressionStream } from 'stream/web';

import {
  decodePayload,
  encodePayload,
  mergePayload,
  MIGRATE_HASH,
  MigratePayload,
  newSiteOrigin,
} from './site-migrate';

// jest 27 的 node 环境没把这两个放进全域（浏览器都有）
Object.assign(global, { CompressionStream, DecompressionStream });

const fav = (title: string, t = 1) => ({
  source_name: '源',
  total_episodes: 1,
  title,
  year: '2024',
  cover: '',
  save_time: t,
  search_title: title,
});
const mark = (id: string, at: number, seconds = 0) => ({
  id,
  video: { id, title: `影片 ${id}` },
  seconds,
  at,
});
const follow = (name: string, known: string[] = []) => ({
  name,
  channelId: null,
  channel: '频道',
  known,
  newIds: [],
  latest: null,
  checkedAt: 0,
  addedAt: 1,
  watchedAt: 1,
  done: false,
});
const empty = (): MigratePayload => ({
  v: 1,
  favorites: {},
  aiMarks: [],
  seriesFollows: [],
  aiPins: [],
});

describe('site-migrate', () => {
  it('maps zeabur hosts to railway', () => {
    expect(newSiteOrigin('moon-chen.zeabur.app')).toBe(
      'https://moon-chen.up.railway.app'
    );
    expect(newSiteOrigin('moon-chen.up.railway.app')).toBeNull();
    expect(newSiteOrigin('localhost:3999')).toBeNull();
  });

  it('round-trips through the url hash (gzip), including Chinese', async () => {
    const p: MigratePayload = {
      v: 1,
      favorites: { 'a+1': fav('中文片名') },
      aiMarks: [mark('abcdefghijk', 5, 93)],
      seriesFollows: [follow('仙逆', ['aaaaaaaaaaa'])],
      aiPins: ['yt:UC1'],
    };
    const data = await encodePayload(p);
    expect(data.startsWith('~')).toBe(true);
    expect(data.slice(1)).not.toMatch(/[+/=~]/);
    expect(await decodePayload(`#${MIGRATE_HASH}${data}`)).toEqual(p);
  });

  it('gzip keeps big follow lists small', async () => {
    const p = empty();
    for (let i = 0; i < 100; i++)
      p.seriesFollows.push(
        follow(
          `剧名 ${i}`,
          Array.from(
            { length: 50 },
            (_, j) => `v${String(i * 100 + j).padStart(10, '0')}`
          )
        )
      );
    const plain = Buffer.from(JSON.stringify(p)).toString('base64').length;
    const data = await encodePayload(p);
    expect(data.length).toBeLessThan(plain / 3);
    expect(
      (await decodePayload(`#${MIGRATE_HASH}${data}`))?.seriesFollows
    ).toHaveLength(100);
  });

  it('still reads the uncompressed form', async () => {
    const p = { ...empty(), favorites: { 'a+1': fav('x') } };
    const raw = Buffer.from(JSON.stringify(p)).toString('base64url');
    expect(await decodePayload(`#${MIGRATE_HASH}${raw}`)).toEqual(p);
  });

  it('rejects garbage and bad entries', async () => {
    expect(await decodePayload(`#${MIGRATE_HASH}not-base64!!`)).toBeNull();
    expect(await decodePayload(`#${MIGRATE_HASH}~AAAA`)).toBeNull();
    const bad = await encodePayload({
      v: 1,
      favorites: { nokey: fav('x'), 'a+1': { title: '' } },
      aiMarks: [{ id: '' }, { id: 'x' }],
      seriesFollows: [{ name: 'a' }],
      aiPins: [1, '', 'ok', 'ok'],
    } as unknown as MigratePayload);
    expect(await decodePayload(`#${MIGRATE_HASH}${bad}`)).toEqual({
      ...empty(),
      aiPins: ['ok'],
    });
  });

  it('merges without overwriting what the new site already has', () => {
    const r = mergePayload(
      {
        favorites: { 'a+1': fav('新站的', 9) },
        aiMarks: [mark('m1', 10, 300)],
        seriesFollows: [follow('仙逆', ['new1'])],
        aiPins: ['p1'],
      },
      {
        v: 1,
        favorites: { 'a+1': fav('舊站的'), 'b+2': fav('只有舊站') },
        aiMarks: [mark('m1', 1, 5), mark('m2', 20)],
        seriesFollows: [follow('仙逆', ['old1']), follow('斗破苍穹')],
        aiPins: ['p1', 'p2'],
      }
    );
    expect(r.favorites['a+1'].title).toBe('新站的');
    expect(r.favorites['b+2'].title).toBe('只有舊站');
    expect(r.aiMarks.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(r.aiMarks.find((m) => m.id === 'm1')?.seconds).toBe(300);
    expect(r.seriesFollows.map((f) => f.name)).toEqual(['仙逆', '斗破苍穹']);
    expect(r.seriesFollows[0].known).toEqual(['new1']);
    expect(r.aiPins).toEqual(['p1', 'p2']);
    expect(r.added).toEqual({
      favorites: 1,
      aiMarks: 1,
      seriesFollows: 1,
      aiPins: 1,
    });
  });
});
