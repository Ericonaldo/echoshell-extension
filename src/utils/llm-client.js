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

const FULL_POLISH_SYSTEM_PROMPT = `你是一个专业的播客文字稿编辑器。你的任务是将原始的语音转录文本优化为高质量、可读性强的文字稿。

## 输出要求
1. **添加标点符号**：在合适的位置添加逗号、句号、问号、感叹号等中/英文标点
2. **识别说话人**：根据语境、语气、对话模式识别不同说话人，用 **[主持人]** **[嘉宾]** 或 **[嘉宾A]** **[嘉宾B]** 标记。如果能从内容中推断出名字，使用真实名字如 **[罗永浩]** **[闫辉]**
3. **分段**：按说话人轮次分段，每次换人说话另起一行
4. **保留时间戳**：如果输入有 [MM:SS] 时间戳，保留在每段开头
5. **不要改变原意**：不添加、不删除、不改写内容含义
6. **修正明显错误**：修正明显的语音识别错误（同音字、断句错误等）

## 输出格式示例
[00:12] **[主持人]** 大家好，欢迎收听本期节目。今天我们请到了一位非常特别的嘉宾。
[00:25] **[嘉宾]** 谢谢邀请，很高兴来到这里。
[01:03] **[主持人]** 能跟我们聊聊你最近在做的项目吗？

只输出处理后的文稿，不要任何解释。`;

/**
 * Polish/refine transcript text using an LLM
 * @param {string} text - Raw transcript text
 * @param {Object} config - LLM configuration
 * @returns {Promise<string>} Polished text
 */
/**
 * Full polish: add punctuation, speaker diarization, and formatting.
 * Processes text in chunks to handle long transcripts.
 * @param {string} text - Raw transcript text (may include [MM:SS] timestamps)
 * @param {Object} config - LLM configuration
 * @param {Function} [onProgress] - Progress callback (0-1)
 * @returns {Promise<string>} Fully polished text with speakers and punctuation
 */
export async function fullPolishText(text, config, onProgress) {
  if (!config.enabled || !config.apiKey) {
    return text;
  }

  // Split into chunks of ~2000 chars at paragraph boundaries
  const CHUNK_SIZE = 2000;
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n' : '') + line;
  }
  if (current) chunks.push(current);

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const contextHint = i > 0
      ? `\n\n（这是第${i + 1}/${chunks.length}段，请保持与前文一致的说话人标注）`
      : '';

    const polished = await callLLM(
      FULL_POLISH_SYSTEM_PROMPT,
      chunks[i] + contextHint,
      config
    );
    results.push(polished);
    if (onProgress) onProgress((i + 1) / chunks.length);
  }

  return results.join('\n\n');
}

async function callLLM(systemPrompt, userText, config) {
  const { provider = LLM_PROVIDERS.OPENAI, apiKey, endpoint, model } = config;
  const maxTokens = 4000;

  if (provider === LLM_PROVIDERS.ANTHROPIC) {
    const url = endpoint || 'https://api.anthropic.com/v1/messages';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }]
      })
    });
    if (!resp.ok) throw new LLMError(`Anthropic API error: ${resp.status}`, 'anthropic');
    const data = await resp.json();
    return data?.content?.[0]?.text || userText;
  }

  // OpenAI / Custom
  const url = endpoint || 'https://api.openai.com/v1/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      max_tokens: maxTokens,
      stream: false
    })
  });
  if (!resp.ok) throw new LLMError(`LLM API error: ${resp.status}`, 'openai');
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || userText;
}

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
