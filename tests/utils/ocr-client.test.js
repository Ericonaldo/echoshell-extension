import { extractText, OCRError, ConfigError } from '../../src/utils/ocr-client.js';
import { OCR_PROVIDERS } from '../../src/utils/constants.js';

const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const openaiOcrConfig = {
  provider: OCR_PROVIDERS.OPENAI,
  apiKey: 'sk-test-key',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini'
};

describe('ocr-client.js', () => {
  describe('OpenAI Vision', () => {
    test('sends base64 image in correct image_url message format', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Subtitle text here' } }]
        })
      });

      await extractText(mockBase64Image, openaiOcrConfig);

      const [, options] = fetch.mock.calls[0];
      const body = JSON.parse(options.body);
      const content = body.messages[0].content;
      const imageContent = content.find(c => c.type === 'image_url');
      expect(imageContent).toBeDefined();
      expect(imageContent.image_url.url).toContain('base64');
      expect(imageContent.image_url.url).toContain(mockBase64Image);
    });

    test('extracts text from choices[0].message.content', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello from OCR' } }]
        })
      });

      const result = await extractText(mockBase64Image, openaiOcrConfig);
      expect(result).toBe('Hello from OCR');
    });

    test('sends Authorization header with API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'text' } }]
        })
      });

      await extractText(mockBase64Image, openaiOcrConfig);
      const [, options] = fetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer sk-test-key');
    });

    test('returns empty string for blank response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }]
        })
      });

      const result = await extractText(mockBase64Image, openaiOcrConfig);
      expect(result).toBe('');
    });

    test('throws OCRError on API failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error')
      });

      await expect(extractText(mockBase64Image, openaiOcrConfig))
        .rejects.toThrow(OCRError);
    });
  });

  describe('ConfigError', () => {
    test('throws ConfigError when API key is missing for non-tesseract provider', async () => {
      const configNoKey = { ...openaiOcrConfig, apiKey: '' };
      await expect(extractText(mockBase64Image, configNoKey))
        .rejects.toThrow(ConfigError);
    });
  });

  describe('Large image handling', () => {
    test('processes normal-sized images without resizing', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'text' } }]
        })
      });

      await extractText(mockBase64Image, openaiOcrConfig);
      // Should call fetch once (no resize needed for small image)
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
