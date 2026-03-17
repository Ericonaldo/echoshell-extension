import { transcribeAudio, ASRError } from '../../src/utils/asr-client.js';
import { ASR_PROVIDERS } from '../../src/utils/constants.js';

const mockAudioBlob = new Blob(['audio data'], { type: 'audio/webm' });

const openaiConfig = {
  provider: ASR_PROVIDERS.OPENAI,
  apiKey: 'sk-test-key',
  endpoint: 'https://api.openai.com/v1/audio/transcriptions',
  model: 'whisper-1',
  language: 'en'
};

describe('asr-client.js', () => {
  describe('OpenAI Whisper', () => {
    test('sends Authorization header with API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Hello world' })
      });

      await transcribeAudio(mockAudioBlob, openaiConfig);

      const [url, options] = fetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer sk-test-key');
    });

    test('constructs correct FormData with file, model, language', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Test transcript' })
      });

      await transcribeAudio(mockAudioBlob, openaiConfig);

      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe(openaiConfig.endpoint);
      expect(options.body).toBeInstanceOf(FormData);
    });

    test('parses response.text from JSON', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Transcribed text here' })
      });

      const result = await transcribeAudio(mockAudioBlob, openaiConfig);
      expect(result).toBe('Transcribed text here');
    });

    test('returns empty string when response text is empty', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: '' })
      });

      const result = await transcribeAudio(mockAudioBlob, openaiConfig);
      expect(result).toBe('');
    });
  });

  describe('Deepgram', () => {
    const deepgramConfig = {
      provider: ASR_PROVIDERS.DEEPGRAM,
      apiKey: 'dg-test-key',
      endpoint: 'https://api.deepgram.com/v1/listen',
      language: 'en'
    };

    test('uses Token auth header format', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: { channels: [{ alternatives: [{ transcript: 'hello' }] }] }
        })
      });

      await transcribeAudio(mockAudioBlob, deepgramConfig);

      const [, options] = fetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Token dg-test-key');
      // Should NOT use Bearer token
      expect(options.headers['Authorization']).not.toContain('Bearer');
    });

    test('sends audio as request body with content-type header', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: { channels: [{ alternatives: [{ transcript: 'deepgram result' }] }] }
        })
      });

      await transcribeAudio(mockAudioBlob, deepgramConfig);

      const [, options] = fetch.mock.calls[0];
      expect(options.body).toBe(mockAudioBlob);
      expect(options.headers['Content-Type']).toBeTruthy();
    });

    test('parses Deepgram response transcript correctly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: { channels: [{ alternatives: [{ transcript: 'deepgram transcript' }] }] }
        })
      });

      const result = await transcribeAudio(mockAudioBlob, deepgramConfig);
      expect(result).toBe('deepgram transcript');
    });
  });

  describe('Groq', () => {
    test('follows OpenAI-compatible format', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'groq result' })
      });

      const groqConfig = {
        provider: ASR_PROVIDERS.GROQ,
        apiKey: 'gsk-test',
        endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
        model: 'whisper-large-v3'
      };

      const result = await transcribeAudio(mockAudioBlob, groqConfig);
      expect(result).toBe('groq result');

      const [url, options] = fetch.mock.calls[0];
      expect(options.headers['Authorization']).toContain('Bearer');
    });
  });

  describe('Custom endpoint', () => {
    test('uses user-supplied endpoint URL verbatim', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'custom result' })
      });

      const customConfig = {
        provider: ASR_PROVIDERS.CUSTOM,
        apiKey: 'custom-key',
        endpoint: 'https://my-custom-asr.example.com/v1/transcribe',
        model: 'my-model'
      };

      await transcribeAudio(mockAudioBlob, customConfig);
      expect(fetch.mock.calls[0][0]).toBe('https://my-custom-asr.example.com/v1/transcribe');
    });
  });

  describe('Error handling', () => {
    test('throws ASRError on network failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Network unreachable'));

      await expect(transcribeAudio(mockAudioBlob, openaiConfig))
        .rejects.toThrow(ASRError);
    });

    test('throws ASRError on non-2xx response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized')
      });

      await expect(transcribeAudio(mockAudioBlob, openaiConfig))
        .rejects.toThrow(ASRError);
    });

    test('ASRError includes status code for HTTP errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden')
      });

      try {
        await transcribeAudio(mockAudioBlob, openaiConfig);
      } catch (err) {
        expect(err).toBeInstanceOf(ASRError);
        expect(err.statusCode).toBe(403);
      }
    });

    test('throws ASRError when API key is missing', async () => {
      const configWithoutKey = { ...openaiConfig, apiKey: '' };
      await expect(transcribeAudio(mockAudioBlob, configWithoutKey))
        .rejects.toThrow(ASRError);
    });

    test('retries up to 3 times on 429 rate limit', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Too Many Requests')
      };
      // Fail 2 times with 429, then succeed
      fetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ text: 'retry success' })
        });

      // Override setTimeout to execute immediately during test
      const origSetTimeout = global.setTimeout;
      global.setTimeout = (fn) => origSetTimeout(fn, 0);

      try {
        const result = await transcribeAudio(mockAudioBlob, openaiConfig);
        expect(result).toBe('retry success');
        expect(fetch).toHaveBeenCalledTimes(3);
      } finally {
        global.setTimeout = origSetTimeout;
      }
    }, 10000);
  });
});
