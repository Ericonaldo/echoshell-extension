/**
 * Tests for forum-client.js
 */

// Mock fetch globally
global.fetch = jest.fn();

import { checkForumTranscript, uploadToForum, buildForumEpisodeUrl } from '../../src/utils/forum-client.js';

const FORUM_URL = 'http://localhost:4010';
const EPISODE_URL = 'https://youtube.com/watch?v=abc123';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkForumTranscript', () => {
  test('returns null if forumUrl is empty', async () => {
    const result = await checkForumTranscript(EPISODE_URL, '');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('returns null if tabUrl is empty', async () => {
    const result = await checkForumTranscript('', FORUM_URL);
    expect(result).toBeNull();
  });

  test('returns result when transcript found', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        found: true,
        episodeId: 42,
        podcastId: 7,
        episodeTitle: 'Test Episode',
        podcastName: 'Test Podcast'
      })
    });

    const result = await checkForumTranscript(EPISODE_URL, FORUM_URL);
    expect(result.found).toBe(true);
    expect(result.episodeId).toBe(42);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/check?url='),
      expect.any(Object)
    );
  });

  test('returns result when transcript not found', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ found: false })
    });

    const result = await checkForumTranscript(EPISODE_URL, FORUM_URL);
    expect(result.found).toBe(false);
  });

  test('returns null on network error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await checkForumTranscript(EPISODE_URL, FORUM_URL);
    expect(result).toBeNull();
  });

  test('returns null on non-ok response', async () => {
    fetch.mockResolvedValueOnce({ ok: false });
    const result = await checkForumTranscript(EPISODE_URL, FORUM_URL);
    expect(result).toBeNull();
  });
});

describe('uploadToForum', () => {
  const session = {
    id: 'session-1',
    title: 'Test Episode',
    url: EPISODE_URL,
    createdAt: Date.now(),
    segments: [
      { timestamp: 0, text: 'Hello world', source: 'asr' },
      { timestamp: 5000, text: 'This is a test', source: 'asr' }
    ]
  };

  test('returns null if forumUrl is empty', async () => {
    const result = await uploadToForum(session, '');
    expect(result).toBeNull();
  });

  test('returns null if session has no segments', async () => {
    const result = await uploadToForum({ ...session, segments: [] }, FORUM_URL);
    expect(result).toBeNull();
  });

  test('returns null if session is null', async () => {
    const result = await uploadToForum(null, FORUM_URL);
    expect(result).toBeNull();
  });

  test('uploads successfully and returns result', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, episodeId: 10, podcastId: 3, transcriptId: 5 })
    });

    const result = await uploadToForum(session, FORUM_URL);
    expect(result.success).toBe(true);
    expect(result.episodeId).toBe(10);

    // Verify request format
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`${FORUM_URL}/api/upload`);
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.podcast.name).toBe('YouTube');
    expect(body.episode.title).toBe('Test Episode');
    expect(body.episode.episode_url).toBe(EPISODE_URL);
    expect(body.transcript.content).toContain('Hello world');
    expect(body.transcript.content).toContain('[0:00]');
    expect(body.transcript.source).toBe('asr');
  });

  test('formats timestamps correctly in transcript', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, episodeId: 1, podcastId: 1, transcriptId: 1 })
    });

    const sessionWithTimes = {
      ...session,
      segments: [
        { timestamp: 65000, text: 'One minute 5 seconds', source: 'asr' },
        { timestamp: 3661000, text: 'Over an hour', source: 'asr' }
      ]
    };

    await uploadToForum(sessionWithTimes, FORUM_URL);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.transcript.content).toContain('[1:05]');
    expect(body.transcript.content).toContain('[61:01]');
  });

  test('extracts Bilibili as podcast name', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, episodeId: 2, podcastId: 2, transcriptId: 2 })
    });

    const bilibili = { ...session, url: 'https://bilibili.com/video/BV123' };
    await uploadToForum(bilibili, FORUM_URL);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.podcast.name).toBe('Bilibili');
  });

  test('returns null on network error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await uploadToForum(session, FORUM_URL);
    expect(result).toBeNull();
  });

  test('returns null on non-ok response', async () => {
    fetch.mockResolvedValueOnce({ ok: false });
    const result = await uploadToForum(session, FORUM_URL);
    expect(result).toBeNull();
  });
});

describe('buildForumEpisodeUrl', () => {
  test('builds correct URL', () => {
    expect(buildForumEpisodeUrl('http://localhost:4010', 42)).toBe('http://localhost:4010/episode/42');
  });

  test('handles trailing slash in base url', () => {
    // no trailing slash from user settings (settings.js strips it)
    expect(buildForumEpisodeUrl('http://localhost:4010', 1)).toBe('http://localhost:4010/episode/1');
  });
});
