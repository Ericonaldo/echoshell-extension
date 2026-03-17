import { OCR_PROVIDERS } from './constants.js';

export class OCRError extends Error {
  constructor(message, provider, statusCode) {
    super(message);
    this.name = 'OCRError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

// Max base64 size ~4MB before resizing
const MAX_BASE64_SIZE = 4 * 1024 * 1024;

/**
 * Extract text from image using configured OCR provider
 * @param {string} base64Image - Base64-encoded PNG image
 * @param {Object} config - OCR configuration
 * @returns {Promise<string>} Extracted text
 */
export async function extractText(base64Image, config) {
  const { provider = OCR_PROVIDERS.OPENAI, apiKey, endpoint, model = 'gpt-4o-mini' } = config;

  if (!apiKey && provider !== OCR_PROVIDERS.TESSERACT) {
    throw new ConfigError('OCR API key not configured');
  }

  // Resize if too large
  let imageData = base64Image;
  if (base64Image.length > MAX_BASE64_SIZE) {
    imageData = await resizeBase64Image(base64Image, 0.5);
  }

  switch (provider) {
    case OCR_PROVIDERS.OPENAI:
      return extractTextOpenAI(imageData, { apiKey, endpoint, model });
    case OCR_PROVIDERS.TESSERACT:
      return extractTextTesseract(imageData);
    default:
      return extractTextOpenAI(imageData, { apiKey, endpoint, model });
  }
}

async function extractTextOpenAI(base64Image, { apiKey, endpoint, model }) {
  const url = endpoint || 'https://api.openai.com/v1/chat/completions';

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract only the subtitle text from this image. Return just the text, nothing else. If no text is visible, return an empty string.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        max_tokens: 200
      })
    });
  } catch (err) {
    throw new OCRError(`Network error: ${err.message}`, 'openai', null);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new OCRError(
      `OCR API error: ${response.status} ${body}`,
      'openai',
      response.status
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return text.trim();
}

async function extractTextTesseract(base64Image) {
  // Dynamically import tesseract.js (optional dependency)
  try {
    const Tesseract = await import('tesseract.js');
    const result = await Tesseract.recognize(
      `data:image/png;base64,${base64Image}`,
      'eng',
      { logger: () => {} }
    );
    return result.data.text.trim();
  } catch (err) {
    throw new OCRError(`Tesseract error: ${err.message}`, 'tesseract', null);
  }
}

async function resizeBase64Image(base64, scaleFactor) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(img.width * scaleFactor);
      canvas.height = Math.floor(img.height * scaleFactor);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const resized = canvas.toDataURL('image/png').split(',')[1];
      resolve(resized);
    };
    img.src = `data:image/png;base64,${base64}`;
  });
}
