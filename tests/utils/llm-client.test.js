import { polishText, polishTextStream, LLMError } from '../../src/utils/llm-client.js';
import { LLM_PROVIDERS } from '../../src/utils/constants.js';

const openaiLlmConfig = {
  provider: LLM_PROVIDERS.OPENAI,
  apiKey: 'sk-test-key',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  enabled: true
};

describe('llm-client.js', () => {
  describe('polishText()', () => {
    test('sends system prompt + user text in messages array', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Polished text.' } }]
        })
      });

      await polishText('raw transcript', openaiLlmConfig);

      const [, options] = fetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('raw transcript');
    });

    test('returns polished text from choices[0].message.content', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Polished result.' } }]
        })
      });

      const result = await polishText('raw', openaiLlmConfig);
      expect(result).toBe('Polished result.');
    });

    test('returns input text unchanged when enabled=false (passthrough)', async () => {
      const config = { ...openaiLlmConfig, enabled: false };
      const result = await polishText('original text', config);
      expect(result).toBe('original text');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('returns input text when apiKey is empty', async () => {
      const config = { ...openaiLlmConfig, apiKey: '' };
      const result = await polishText('input text', config);
      expect(result).toBe('input text');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('Anthropic format uses x-api-key header', async () => {
      const anthropicConfig = {
        ...openaiLlmConfig,
        provider: LLM_PROVIDERS.ANTHROPIC,
        apiKey: 'ant-test-key',
        endpoint: 'https://api.anthropic.com/v1/messages'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ text: 'Anthropic result' }]
        })
      });

      await polishText('test text', anthropicConfig);

      const [, options] = fetch.mock.calls[0];
      expect(options.headers['x-api-key']).toBe('ant-test-key');
      expect(options.headers['Authorization']).toBeUndefined();
    });

    test('Anthropic response parsed from content[0].text', async () => {
      const anthropicConfig = {
        ...openaiLlmConfig,
        provider: LLM_PROVIDERS.ANTHROPIC,
        apiKey: 'ant-key',
        endpoint: 'https://api.anthropic.com/v1/messages'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ text: 'Claude response' }]
        })
      });

      const result = await polishText('input', anthropicConfig);
      expect(result).toBe('Claude response');
    });

    test('throws LLMError on network failure', async () => {
      fetch.mockRejectedValueOnce(new Error('connection refused'));
      await expect(polishText('text', openaiLlmConfig)).rejects.toThrow(LLMError);
    });
  });

  describe('polishTextStream()', () => {
    test('assembles SSE chunks into complete text', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const encoder = new TextEncoder();
      let chunkIndex = 0;

      const mockReader = {
        read: jest.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            return Promise.resolve({
              done: false,
              value: encoder.encode(chunks[chunkIndex++])
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        })
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader }
      });

      const receivedChunks = [];
      const result = await polishTextStream('input', openaiLlmConfig, (chunk) => {
        receivedChunks.push(chunk);
      });

      expect(result).toBe('Hello world');
      expect(receivedChunks).toEqual(['Hello', ' world']);
    });

    test('returns input unchanged when enabled=false', async () => {
      const config = { ...openaiLlmConfig, enabled: false };
      const chunks = [];
      const result = await polishTextStream('original', config, c => chunks.push(c));
      expect(result).toBe('original');
      expect(chunks).toEqual(['original']);
    });
  });
});
