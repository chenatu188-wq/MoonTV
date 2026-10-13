/**
 * 访客密码：给朋友用的第二组登入密码，四位数字，定期自动换。
 *
 * 网站没有资料库，所以密码不是「产生后存起来」，而是用主密码和「现在是第几期」算出来的：
 * 同一期怎么算都是同一组，换期就自动变成另一组，旧的当场失效（已经登入的访客也会被登出，
 * 因为每个请求都会重新比对 cookie 里的密码）。
 *
 * 预设关闭。在环境变数设 GUEST_PASS_DAYS=14（一期几天）才启用；
 * 想提前作废这一期的密码，改 GUEST_PASS_SALT 成任意新字串即可。
 * 这个档案会在 middleware（edge runtime）里跑，只能用 Web Crypto。
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 一期几天；0 = 没启用。只收 1～90 的整数 */
export function guestPassDays(raw = process.env.GUEST_PASS_DAYS): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : 0;
}

/** 现在是第几期，以及这一期什么时候结束（Unix 毫秒） */
export function guestPeriod(
  days: number,
  now = Date.now()
): { index: number; expiresAt: number } {
  const len = days * DAY_MS;
  const index = Math.floor(now / len);
  return { index, expiresAt: (index + 1) * len };
}

/** 算出某一期的四位数密码 */
export async function guestCodeFor(
  secret: string,
  index: number
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, enc.encode(`guest-pass:${index}`))
  );
  // 取前 4 个位元组当成一个整数，再取后四位
  const n = ((sig[0] << 24) | (sig[1] << 16) | (sig[2] << 8) | sig[3]) >>> 0;
  return String(n % 10000).padStart(4, '0');
}

export interface GuestPass {
  code: string;
  /** 这组密码失效的时间，Unix 毫秒 */
  expiresAt: number;
  days: number;
}

/** 目前有效的访客密码；没启用或没设主密码回 null */
export async function currentGuestPass(
  now = Date.now()
): Promise<GuestPass | null> {
  const days = guestPassDays();
  const password = process.env.PASSWORD;
  if (!days || !password) return null;
  const { index, expiresAt } = guestPeriod(days, now);
  const secret = `${password}|${process.env.GUEST_PASS_SALT ?? ''}`;
  return { code: await guestCodeFor(secret, index), expiresAt, days };
}

/**
 * 登入失败的次数限制。四位数只有一万种组合，不限制的话几分钟就能试完。
 * 同一个 IP 15 分钟内错 8 次就锁到这 15 分钟结束；全站一小时内错超过 200 次，
 * 剩下的时间只收主密码（挡用很多 IP 分散来试的）。
 * 记在记忆体里，重新部署会归零。
 */
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_FAILS = 8;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX_FAILS = 200;

export interface FailLog {
  byIp: Map<string, { count: number; start: number }>;
  global: { count: number; start: number };
}

export const newFailLog = (): FailLog => ({
  byIp: new Map(),
  global: { count: 0, start: 0 },
});

/** 这个 IP 现在还能不能再试 */
export function canAttempt(
  log: FailLog,
  ip: string,
  now = Date.now()
): boolean {
  if (
    now - log.global.start < GLOBAL_WINDOW_MS &&
    log.global.count >= GLOBAL_MAX_FAILS
  )
    return false;
  const rec = log.byIp.get(ip);
  return !rec || now - rec.start >= IP_WINDOW_MS || rec.count < IP_MAX_FAILS;
}

export function recordFail(log: FailLog, ip: string, now = Date.now()): void {
  if (now - log.global.start >= GLOBAL_WINDOW_MS) {
    log.global = { count: 0, start: now };
  }
  log.global.count += 1;

  const rec = log.byIp.get(ip);
  if (!rec || now - rec.start >= IP_WINDOW_MS) {
    log.byIp.set(ip, { count: 1, start: now });
  } else {
    rec.count += 1;
  }
  // 别让表无限长大：太多就把过期的清掉
  if (log.byIp.size > 5000) {
    log.byIp.forEach((r, k) => {
      if (now - r.start >= IP_WINDOW_MS) log.byIp.delete(k);
    });
  }
}
