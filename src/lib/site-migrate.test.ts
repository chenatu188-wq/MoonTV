import { TextDecoder, TextEncoder } from 'util';

import {
  decodePayload,
  encodePayload,
  mergePayload,
  MIGRATE_HASH,
  MigratePayload,
  newSiteOrigin,
} from './site-migrate';

// jsdom 测试环境没有 TextEncoder／TextDecoder（浏览器有）
Object.assign(global, { TextEncoder, TextDecoder });

const fav = (title: string, t = 1) => ({
  source_name: '源',
  total_episodes: 1,
  title,
  year: '2024',
  cover: '',
  save_time: t,
  search_title: title,
});
const pick = (id: string, at: number) => ({
  source: 's',
  id,
  title: `片 ${id}`,
  poster: '',
  sourceName: '源',
  at,
});

describe('site-migrate', () => {
  it('maps zeabur hosts to railway', () => {
    expect(newSiteOrigin('moon-vip.zeabur.app')).toBe(
      'https://moon-vip.up.railway.app'
    );
    expect(newSiteOrigin('moon-vip.up.railway.app')).toBeNull();
    expect(newSiteOrigin('localhost:3999')).toBeNull();
  });

  it('round-trips through the url hash, including Chinese', () => {
    const p: MigratePayload = {
      v: 1,
      favorites: { 'a+1': fav('中文片名') },
      picks: [pick('9', 5)],
      codePicks: [{ code: 'ABC-123', actress: '演員' }],
    };
    const hash = `#${MIGRATE_HASH}${encodePayload(p)}`;
    expect(encodePayload(p)).not.toMatch(/[+/=]/);
    expect(decodePayload(hash)).toEqual(p);
  });

  it('rejects garbage and bad entries', () => {
    expect(decodePayload(`#${MIGRATE_HASH}not-base64!!`)).toBeNull();
    const bad = encodePayload({
      v: 1,
      favorites: { nokey: fav('x'), 'a+1': { title: '' } },
      picks: [{ id: 'x' }],
      codePicks: [{ code: 'nope' }],
    } as unknown as MigratePayload);
    expect(decodePayload(`#${MIGRATE_HASH}${bad}`)).toEqual({
      v: 1,
      favorites: {},
      picks: [],
      codePicks: [],
    });
  });

  it('merges without overwriting what the new site already has', () => {
    const r = mergePayload(
      {
        favorites: { 'a+1': fav('新站的', 9) },
        picks: [pick('1', 10)],
        codePicks: [{ code: 'XYZ-001', actress: '' }],
      },
      {
        v: 1,
        favorites: { 'a+1': fav('舊站的'), 'b+2': fav('只有舊站') },
        picks: [pick('1', 1), pick('2', 20)],
        codePicks: [
          { code: 'XYZ-001', actress: '' },
          { code: 'XYZ-002', actress: '' },
        ],
      }
    );
    expect(r.favorites['a+1'].title).toBe('新站的');
    expect(r.favorites['b+2'].title).toBe('只有舊站');
    expect(r.picks.map((p) => p.id)).toEqual(['2', '1']);
    expect(r.picks.find((p) => p.id === '1')?.at).toBe(10);
    expect(r.codePicks.map((p) => p.code)).toEqual(['XYZ-002', 'XYZ-001']);
    expect(r.added).toEqual({ favorites: 1, picks: 1, codePicks: 1 });
  });
});
