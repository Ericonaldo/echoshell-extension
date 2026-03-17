import { LLM_PROVIDERS } from './constants.js';

export class LLMError extends Error {
  constructor(message, provider) {
    super(message);
    this.name = 'LLMError';
    this.provider = provider;
  }
}

const POLISH_SYSTEM_PROMPT = `You are a transcript editor. Your job is to clean up and polish transcribed text:
- Fix obvious transcription errors
- Add punctuation where missing
- Do NOT change the meaning or add information
- Return only the polished text, no explanations`;

/**
 * Polish/refine transcript text using an LLM
 * @param {string} text - Raw transcript text
 * @param {Object} config - LLM configuration
 * @returns {Promise<string>} Polished text
 */
export async function polishText(text, config) {
  if (!config.enabled) {
    return text; // passthrough when LLM is disabled
  }

  const { provider = LLM_PROVIDERS.OPENAI, apiKey, endpoint, model } = config;

  if (!apiKey) {
    return text; // fallback gracefully
  }

  switch (provider) {
    case LLM_PROVIDERS.ANTHROPIC:
      return polishTextAnthropic(text, { apiKey, endpoint, model });
    case LLM_PROVIDERS.OPENAI:
    case LLM_PROVIDERS.CUSTOM:
    default:
      return polishTextOpenAI(text, { apiKey, endpoint, model });
  }
}

async function polishTextOpenAI(text, { apiKey, endpoint, model }) {
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
          { role: 'system', content: POLISH_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        max_tokens: 1000,
        stream: false
      })
    });
  } catch (err) {
    throw new LLMError(`Network error: ${err.message}`, 'openai');
  }

  if (!response.ok) {
    throw new LLMError(`LLM API error: ${response.status}`, 'openai');
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || text;
}

async function polishTextAnthropic(text, { apiKey, endpoint, model }) {
  const url = endpoint || 'https://api.anthropic.com/v1/messages';

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: POLISH_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: text }
        ]
      })
    });
  } catch (err) {
    throw new LLMError(`Network error: ${err.message}`, 'anthropic');
  }

  if (!response.ok) {
    throw new LLMError(`Anthropic API error: ${response.status}`, 'anthropic');
  }

  const data = await response.json();
  return data?.content?.[0]?.text || text;
}

/**
 * Polish text with streaming response
 * @param {string} text - Input text
 * @param {Object} config - LLM config
 * @param {Function} onChunk - Callback called with each text chunk
 * @returns {Promise<string>} Complete polished text
 */
export async function polishTextStream(text, config, onChunk) {
  if (!config.enabled || !config.apiKey) {
    onChunk && onChunk(text);
    return text;
  }

  const url = config.endpoint || 'https://api.openai.com/v1/chat/completions';
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: POLISH_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        stream: true
      })
    });
  } catch (err) {
    throw new LLMError(`Network error: ${err.message}`, config.provider);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk && onChunk(delta);
        }
      } catch (_) {
        // Skip malformed SSE lines
      }
    }
  }

  return fullText;
}
