// Message types for inter-component communication
export const MSG = {
  START_CAPTURE: 'START_CAPTURE',
  STOP_CAPTURE: 'STOP_CAPTURE',
  TRANSCRIPT_CHUNK: 'TRANSCRIPT_CHUNK',
  OCR_CHUNK: 'OCR_CHUNK',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  HISTORY_REQUEST: 'HISTORY_REQUEST',
  HISTORY_RESPONSE: 'HISTORY_RESPONSE',
  SHOW_SUBTITLE: 'SHOW_SUBTITLE',
  HIDE_SUBTITLE: 'HIDE_SUBTITLE',
  SEEK_VIDEO: 'SEEK_VIDEO',
  ERROR: 'ERROR',
  START_AUDIO: 'START_AUDIO',
  STOP_AUDIO: 'STOP_AUDIO',
  CAPTURE_STATUS: 'CAPTURE_STATUS'
};

// ASR Providers
export const ASR_PROVIDERS = {
  OPENAI: 'openai',
  DEEPGRAM: 'deepgram',
  GROQ: 'groq',
  CUSTOM: 'custom'
};

// OCR Providers
export const OCR_PROVIDERS = {
  OPENAI: 'openai',
  TESSERACT: 'tesseract'
};

// LLM Providers
export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  CUSTOM: 'custom'
};

// Capture modes
export const CAPTURE_MODES = {
  AUDIO: 'audio',
  OCR: 'ocr',
  BOTH: 'both'
};

// Default settings
export const DEFAULT_SETTINGS = {
  captureMode: CAPTURE_MODES.AUDIO,
  asr: {
    provider: ASR_PROVIDERS.OPENAI,
    apiKey: '',
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    language: 'auto'
  },
  ocr: {
    provider: OCR_PROVIDERS.OPENAI,
    apiKey: '',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  },
  llm: {
    provider: LLM_PROVIDERS.OPENAI,
    apiKey: '',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    enabled: false
  },
  ui: {
    floatingSubtitles: true,
    fontSize: 16,
    theme: 'dark'
  }
};

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  HISTORY: 'history',
  SESSION: 'session'
};

// VAD configuration
export const VAD_CONFIG = {
  SILENCE_THRESHOLD: 0.01,
  CHUNK_INTERVAL_MS: 10000
};

// Frame diff threshold for OCR
export const FRAME_DIFF_THRESHOLD = 10;

// Subtitle crop: bottom 20% of video
export const SUBTITLE_CROP_PERCENT = 0.2;

// Provider endpoint defaults
export const PROVIDER_ENDPOINTS = {
  openai_asr: 'https://api.openai.com/v1/audio/transcriptions',
  deepgram_asr: 'https://api.deepgram.com/v1/listen',
  groq_asr: 'https://api.groq.com/openai/v1/audio/transcriptions',
  openai_ocr: 'https://api.openai.com/v1/chat/completions',
  openai_llm: 'https://api.openai.com/v1/chat/completions',
  anthropic_llm: 'https://api.anthropic.com/v1/messages'
};
