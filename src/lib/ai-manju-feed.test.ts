import { fetchSource } from './ai-manju-feed';
import { listSource } from './ai-manju-youtube';

jest.mock('./ai-manju-youtube', () => ({ listSource: jest.fn() }));

const originalFetch = global.fetch;
// jsdom 的 AbortSignal 尚未提供 Node.js runtime 的 timeout API。
beforeAll(() => {
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: () => new AbortController().signal,
  });
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('RSS 404 falls back to channel videos and caches a successful result', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  const source = {
    key: 'fallback',
    name: '正常频道',
    type: 'channel' as const,
    id: 'UCfallback',
  };
  (listSource as jest.Mock).mockResolvedValue({
    videos: [{ videoId: 'video', sourceKey: source.id, sourceName: 'old' }],
    next: null,
  });
  const result = await fetchSource(source);
  expect(result.error).toBeNull();
  expect(result.videos[0]).toMatchObject({
    videoId: 'video',
    sourceKey: 'fallback',
    sourceName: '正常频道',
  });
  expect(listSource).toHaveBeenCalledWith('channel', source.id, source.name);
  expect((await fetchSource(source)).videos).toEqual(result.videos);
  expect(listSource).toHaveBeenCalledTimes(1);
});

test('an empty fallback must not hide a failed source', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  (listSource as jest.Mock).mockResolvedValue({ videos: [], next: null });
  const result = await fetchSource({
    key: 'missing',
    name: 'missing',
    type: 'playlist',
    id: 'PLmissing',
  });
  expect(result.error).not.toBeNull();
  expect(result.videos).toEqual([]);
});

test('a valid RSS feed does not need the fallback', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => '<feed><title>Empty channel</title></feed>',
  });
  expect(
    (
      await fetchSource({
        key: 'rss',
        name: 'rss',
        type: 'channel',
        id: 'UCrss',
      })
    ).error
  ).toBeNull();
  expect(listSource).not.toHaveBeenCalled();
});
