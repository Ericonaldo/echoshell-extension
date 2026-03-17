# EchoShell Extension - Progress Log

## 2026-03-17 - Initial Implementation

### What was done
Built the complete EchoShell Chrome Extension from scratch:

**Architecture:**
- Chrome MV3 extension with Background Service Worker, Offscreen Document, Content Script, Side Panel, Popup, and Settings pages
- BYOK (Bring Your Own Key) model - all API keys stored in `chrome.storage.local`
- Multi-provider ASR support: OpenAI Whisper, Deepgram, Groq, custom endpoints
- OCR support via OpenAI Vision (gpt-4o-mini) with frame-diff optimization
- LLM text polish via OpenAI or Anthropic

**Key technical decisions:**
1. Used `chrome.tabCapture.getMediaStreamId()` + offscreen `getUserMedia` pattern (the only way to capture tab audio in MV3)
2. VAD using RMS energy threshold to skip silent audio chunks (saves API quota)
3. Frame diff using Y-channel MSE to avoid redundant OCR calls
4. Exponential backoff retry (up to 3x) for 429/503 rate limit responses
5. `setupFiles` vs `setupFilesAfterEnv` - Jest globals (`beforeEach`) are only available in `setupFilesAfterEnv`, not `setupFiles`

**Problems solved:**
1. Jest `beforeEach` is not defined in `setupFiles` - moved reset logic to `setupFilesAfterEnv`
2. Mocking `global.Blob` breaks jsdom's `FormData.append` - removed Blob mock, use jsdom native
3. `TextEncoder` not available in jsdom - added polyfill from Node's `util` module
4. Retry test timeout - replaced `jest.useFakeTimers()` pattern with direct `setTimeout` override to 0ms

**Test results:**
- 139 tests passing across 11 test suites
- Coverage: ~70% overall (utility modules >85%, UI modules lower as expected)
