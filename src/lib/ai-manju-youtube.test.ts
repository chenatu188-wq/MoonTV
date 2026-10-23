import { popularToken } from '@/lib/ai-manju-youtube';

const chip = (text: string, token: string) => ({
  chipViewModel: {
    text,
    tapCommand: { innertubeCommand: { continuationCommand: { token } } },
  },
});

describe('popularToken', () => {
  it('取第二颗（热门）的 token，不看文字', () => {
    const data = {
      header: {
        chipBarViewModel: {
          chips: [
            chip('Latest', 'a'),
            chip('Popular', 'b'),
            chip('Oldest', 'c'),
          ],
        },
      },
    };
    expect(popularToken(data)).toBe('b');
  });

  it('影片太少的频道没有排序列，回 null', () => {
    expect(popularToken({ contents: [] })).toBeNull();
  });
});

describe('parseVideos metadata used by RSS fallback', () => {
  it('keeps relative dates and view counts for weekly and monthly rankings', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-23T04:00:00Z'));
    const { parseVideos } = jest.requireActual('./ai-manju-youtube');
    const videos = parseVideos(
      {
        contents: [
          {
            videoRenderer: {
              videoId: 'a',
              title: { simpleText: 'A' },
              publishedTimeText: { simpleText: '3 天前' },
              viewCountText: { simpleText: '觀看次數：1.2萬次' },
            },
          },
          {
            lockupViewModel: {
              contentId: 'b',
              contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
              metadata: {
                lockupMetadataViewModel: {
                  title: { content: 'B' },
                  metadata: {
                    metadataRows: [
                      {
                        metadataParts: [
                          { text: { content: '1,234 views' } },
                          { text: { content: '2 weeks ago' } },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        ],
      },
      { channel: 'Test', channelId: 'UCtest' }
    );
    expect(videos[0]).toMatchObject({
      views: 12000,
      published: '2026-10-20T04:00:00.000Z',
      channel: 'Test',
    });
    expect(videos[1]).toMatchObject({
      views: 1234,
      published: '2026-10-09T04:00:00.000Z',
    });
    jest.restoreAllMocks();
  });
});
