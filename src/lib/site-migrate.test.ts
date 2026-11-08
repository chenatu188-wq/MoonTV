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
    } as unknown as MigratePayload);
    expect(decodePayload(`#${MIGRATE_HASH}${bad}`)).toEqual({
      v: 1,
      favorites: {},
    });
  });

  it('merges without overwriting what the new site already has', () => {
    const r = mergePayload(
      {
        favorites: { 'a+1': fav('新站的', 9) },
      },
      {
        v: 1,
        favorites: { 'a+1': fav('舊站的'), 'b+2': fav('只有舊站') },
      }
    );
    expect(r.favorites['a+1'].title).toBe('新站的');
    expect(r.favorites['b+2'].title).toBe('只有舊站');
    expect(r.added).toEqual({ favorites: 1 });
  });
});
