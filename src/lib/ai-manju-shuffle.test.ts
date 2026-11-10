import { pickRandom, swipeOf } from './ai-manju-shuffle';

const v = (id: string) => ({ videoId: id });

describe('ai-manju shuffle', () => {
  it('skips the current and recently watched videos', () => {
    const pool = [v('a'), v('b'), v('c'), v('d')];
    expect(pickRandom(pool, ['b', 'c'], 'a', () => 0)?.videoId).toBe('d');
  });

  it('falls back to anything but the current one when all were seen', () => {
    const pool = [v('a'), v('b')];
    expect(pickRandom(pool, ['a', 'b'], 'a', () => 0.99)?.videoId).toBe('b');
    expect(pickRandom([v('a')], [], 'a')).toBeNull();
    expect(pickRandom([], [], null)).toBeNull();
  });

  it('reads vertical swipes like Douyin', () => {
    expect(swipeOf(5, -120)).toBe('next');
    expect(swipeOf(-10, 90)).toBe('prev');
    expect(swipeOf(0, 30)).toBeNull();
    expect(swipeOf(150, -80)).toBeNull();
  });
});
