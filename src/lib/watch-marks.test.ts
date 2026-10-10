import {
  formatPosition,
  parsePlayerTime,
  removeMark,
  resumeFrom,
  sanitizeMarks,
  upsertMark,
} from '@/lib/watch-marks';

const mark = (id: string, seconds = 0, at = 1) => ({
  id,
  video: { id },
  seconds,
  at,
});

describe('upsertMark / removeMark', () => {
  it('新的排最前面，同一支只留一笔', () => {
    const list = upsertMark([mark('a', 10), mark('b')], mark('b', 99));
    expect(list.map((m) => m.id)).toEqual(['b', 'a']);
    expect(list[0].seconds).toBe(99);
  });

  it('超过上限丢最旧的', () => {
    const list = upsertMark([mark('a'), mark('b')], mark('c'), 2);
    expect(list.map((m) => m.id)).toEqual(['c', 'a']);
  });

  it('removeMark', () => {
    expect(removeMark([mark('a'), mark('b')], 'a').map((m) => m.id)).toEqual([
      'b',
    ]);
  });
});

describe('sanitizeMarks', () => {
  it('丢掉格式不对的，修正坏掉的秒数', () => {
    const out = sanitizeMarks([
      mark('a', 30),
      { id: 'b', video: null },
      { id: '', video: {} },
      { id: 'c', video: {}, seconds: 'x', at: 'y' },
      'junk',
      null,
    ]);
    expect(out.map((m) => [m.id, m.seconds, m.at])).toEqual([
      ['a', 30, 1],
      ['c', 0, 0],
    ]);
  });

  it('不是阵列回空阵列', () => {
    expect(sanitizeMarks('x')).toEqual([]);
    expect(sanitizeMarks(null)).toEqual([]);
  });
});

it('formatPosition', () => {
  expect(formatPosition(0)).toBe('0:00');
  expect(formatPosition(125.9)).toBe('2:05');
  expect(formatPosition(3725)).toBe('1:02:05');
});

it('resumeFrom 往回退 3 秒，不会变负的', () => {
  expect(resumeFrom(125.9)).toBe(122);
  expect(resumeFrom(2)).toBe(0);
});

describe('parsePlayerTime', () => {
  it('YouTube 的进度讯息（JSON 字串）', () => {
    const data = JSON.stringify({
      event: 'infoDelivery',
      info: { currentTime: 61.5 },
    });
    expect(parsePlayerTime('youtube', data)).toBe(61.5);
  });

  it('TikTok 的进度讯息（物件）', () => {
    const data = {
      'x-tiktok-player': true,
      type: 'onCurrentTime',
      value: { currentTime: 12, duration: 60 },
    };
    expect(parsePlayerTime('tiktok', data)).toBe(12);
  });

  it('别种讯息、别的播放器、坏掉的内容都回 null', () => {
    expect(parsePlayerTime('youtube', '{"event":"onReady"}')).toBeNull();
    expect(
      parsePlayerTime('youtube', '{"event":"infoDelivery","info":{"volume":5}}')
    ).toBeNull();
    expect(parsePlayerTime('youtube', 'not json')).toBeNull();
    expect(
      parsePlayerTime('tiktok', {
        type: 'onCurrentTime',
        value: { currentTime: 1 },
      })
    ).toBeNull();
    expect(parsePlayerTime('tiktok', null)).toBeNull();
  });
});
