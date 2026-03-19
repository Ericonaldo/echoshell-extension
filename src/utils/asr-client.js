import { ASR_PROVIDERS } from './constants.js';

export class ASRError extends Error {
  constructor(message, provider, statusCode) {
    super(message);
    this.name = 'ASRError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

/**
 * Transcribe audio blob using the configured ASR provider
 * @param {Blob} audioBlob - Audio data to transcribe
 * @param {Object} config - ASR configuration
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBlob, config) {
  const { provider = ASR_PROVIDERS.OPENAI, apiKey, endpoint, model = 'whisper-1', language } = config;

  if (!apiKey) {
    throw new ASRError('API key not configured', provider, null);
  }

  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let result;
      switch (provider) {
        case ASR_PROVIDERS.OPENAI:
        case ASR_PROVIDERS.GROQ:
        case ASR_PROVIDERS.CUSTOM:
          result = await transcribeOpenAICompatible(audioBlob, { apiKey, endpoint, model, language });
          break;
        case ASR_PROVIDERS.DEEPGRAM:
          result = await transcribeDeepgram(audioBlob, { apiKey, endpoint, language });
          break;
        default:
          result = await transcribeOpenAICompatible(audioBlob, { apiKey, endpoint, model, language });
      }
      return result;
    } catch (err) {
      lastError = err;
      if (err.statusCode === 429 || err.statusCode === 503) {
        // Exponential backoff for rate limiting
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

async function transcribeOpenAICompatible(audioBlob, { apiKey, endpoint, model, language }) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', model || 'whisper-1');
  if (language && language !== 'auto') {
    formData.append('language', language);
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
  } catch (err) {
    throw new ASRError(`Network error: ${err.message}`, 'openai', null);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ASRError(
      `ASR API error: ${response.status} ${body}`,
      'openai',
      response.status
    );
  }

  const data = await response.json();
  return data.text || '';
}

async function transcribeDeepgram(audioBlob, { apiKey, endpoint, language }) {
  const url = endpoint || 'https://api.deepgram.com/v1/listen';
  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true'
  });
  if (language && language !== 'auto') {
    params.set('language', language);
  }

  let response;
  try {
    response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm'
      },
      body: audioBlob
    });
  } catch (err) {
    throw new ASRError(`Network error: ${err.message}`, 'deepgram', null);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ASRError(
      `Deepgram API error: ${response.status} ${body}`,
      'deepgram',
      response.status
    );
  }

  const data = await response.json();
  return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}

/**
 * Transcribe audio with Deepgram diarization enabled
 * Returns {text, segments} where segments have per-speaker information
 * @param {Blob} audioBlob - Audio data to transcribe
 * @param {Object} config - ASR configuration (must use Deepgram provider)
 * @returns {Promise<{text: string, segments: Array<{timestamp: number, endTime: number, text: string, speakerLabel: string, source: string}>}>}
 */
export async function transcribeAudioDiarized(audioBlob, config) {
  const { apiKey, endpoint, language } = config;

  if (!apiKey) {
    throw new ASRError('API key not configured', ASR_PROVIDERS.DEEPGRAM, null);
  }

  const url = endpoint || 'https://api.deepgram.com/v1/listen';
  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    diarize: 'true'
  });
  if (language && language !== 'auto') {
    params.set('language', language);
  }

  let response;
  try {
    response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm'
      },
      body: audioBlob
    });
  } catch (err) {
    throw new ASRError(`Network error: ${err.message}`, ASR_PROVIDERS.DEEPGRAM, null);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ASRError(
      `Deepgram API error: ${response.status} ${body}`,
      ASR_PROVIDERS.DEEPGRAM,
      response.status
    );
  }

  const data = await response.json();

  // Extract plain transcript
  const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

  // Extract diarized words and build per-speaker segments
  const words = data?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  const segments = buildDiarizedSegments(words);

  return { text, segments };
}

/**
 * Build per-speaker segments from Deepgram diarized words array
 * @param {Array} words - Array of word objects with speaker, start, end fields
 * @returns {Array<{timestamp: number, endTime: number, text: string, speakerLabel: string, source: string}>}
 */
function buildDiarizedSegments(words) {
  if (!words || words.length === 0) return [];

  const speakerIdToLabel = (id) => {
    const letter = String.fromCharCode(65 + (id % 26));
    return `Speaker ${letter}`;
  };

  const segments = [];
  let currentSpeaker = null;
  let currentWords = [];
  let segmentStart = null;
  let segmentEnd = null;

  for (const word of words) {
    const speakerId = word.speaker !== undefined ? word.speaker : null;

    if (speakerId !== currentSpeaker) {
      if (currentWords.length > 0) {
        segments.push({
          timestamp: Math.round(segmentStart * 1000),
          endTime: Math.round(segmentEnd * 1000),
          text: currentWords.join(' '),
          speakerLabel: speakerIdToLabel(currentSpeaker !== null ? currentSpeaker : 0),
          source: 'asr'
        });
      }
      currentSpeaker = speakerId;
      currentWords = [word.punctuated_word || word.word || ''];
      segmentStart = word.start;
      segmentEnd = word.end;
    } else {
      currentWords.push(word.punctuated_word || word.word || '');
      segmentEnd = word.end;
    }
  }

  if (currentWords.length > 0) {
    segments.push({
      timestamp: Math.round(segmentStart * 1000),
      endTime: Math.round(segmentEnd * 1000),
      text: currentWords.join(' '),
      speakerLabel: speakerIdToLabel(currentSpeaker !== null ? currentSpeaker : 0),
      source: 'asr'
    });
  }

  return segments;
}
