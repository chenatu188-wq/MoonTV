/**
 * @jest-environment node
 */
import { webcrypto } from 'crypto';

import {
  canAttempt,
  guestCodeFor,
  guestPassDays,
  guestPeriod,
  newFailLog,
  recordFail,
} from '@/lib/guest-pass';

// jest 的环境里没有全域的 crypto，补上 Node 内建的 Web Crypto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).crypto ??= webcrypto;

const DAY = 86400000;

describe('guestPassDays', () => {
  it.each([
    ['14', 14],
    ['1', 1],
    ['90', 90],
    [undefined, 0],
    ['', 0],
    ['0', 0],
    ['91', 0],
    ['-3', 0],
    ['1.5', 0],
    ['abc', 0],
  ])('%p → %p', (raw, expected) => {
    expect(guestPassDays(raw as string | undefined)).toBe(expected);
  });
});

describe('guestPeriod', () => {
  it('同一期内不变，到期就换下一期', () => {
    const a = guestPeriod(14, 14 * DAY * 100);
    const b = guestPeriod(14, 14 * DAY * 100 + 13 * DAY);
    const c = guestPeriod(14, 14 * DAY * 101);
    expect(a.index).toBe(100);
    expect(b.index).toBe(100);
    expect(c.index).toBe(101);
    expect(a.expiresAt).toBe(14 * DAY * 101);
  });
});

describe('guestCodeFor', () => {
  it('四位数字，同一期同一个主密码算出来一样', async () => {
    const a = await guestCodeFor('secret', 100);
    expect(a).toMatch(/^\d{4}$/);
    expect(await guestCodeFor('secret', 100)).toBe(a);
  });

  it('换期、换主密码都会变', async () => {
    const codes = await Promise.all(
      [100, 101, 102, 103, 104, 105].map((i) => guestCodeFor('secret', i))
    );
    expect(new Set(codes).size).toBeGreaterThan(3);
    const other = await Promise.all(
      [100, 101, 102, 103, 104, 105].map((i) => guestCodeFor('other', i))
    );
    expect(other).not.toEqual(codes);
  });
});

describe('登入失败次数限制', () => {
  it('同一个 IP 错 8 次就锁住，15 分钟后解开，不影响别的 IP', () => {
    const log = newFailLog();
    for (let i = 0; i < 7; i++) recordFail(log, '1.1.1.1', 1000);
    expect(canAttempt(log, '1.1.1.1', 1000)).toBe(true);
    recordFail(log, '1.1.1.1', 1000);
    expect(canAttempt(log, '1.1.1.1', 2000)).toBe(false);
    expect(canAttempt(log, '2.2.2.2', 2000)).toBe(true);
    expect(canAttempt(log, '1.1.1.1', 1000 + 15 * 60 * 1000)).toBe(true);
  });

  it('全站一小时内错太多次，所有人都先挡下来', () => {
    const log = newFailLog();
    for (let i = 0; i < 200; i++) recordFail(log, `10.0.0.${i}`, 1000);
    expect(canAttempt(log, '9.9.9.9', 2000)).toBe(false);
    expect(canAttempt(log, '9.9.9.9', 1000 + 60 * 60 * 1000)).toBe(true);
  });
});
