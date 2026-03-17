# EchoShell - Chrome Extension

A BYOK (Bring Your Own Key) Chrome Extension for high-precision podcast and video transcription.

## Features

- **Audio Transcription (ASR)**: Captures tab audio and transcribes via OpenAI Whisper, Deepgram, Groq, or custom endpoints
- **Screen OCR**: Extracts on-screen subtitles using OpenAI Vision with frame-diff optimization
- **BYOK Configuration**: All API keys stored locally, never sent to any third-party server
- **Side Panel**: Real-time transcript display with timestamp navigation
- **Floating Subtitles**: LLM-polished subtitles overlaid on video
- **History Manager**: Export transcripts as `.txt`, `.md`, or `.srt`

## Installation

1. Build the extension:
```bash
npm install
npm run build
```

2. Open Chrome → `chrome://extensions` → Enable Developer mode
3. Click "Load unpacked" → Select the `dist/` folder

## Configuration

Click the ⚙ settings icon to configure:
- **ASR Provider**: OpenAI, Deepgram, Groq, or custom endpoint
- **OCR Provider**: OpenAI Vision or Tesseract.js (offline)
- **LLM Polish**: Optional text cleanup via OpenAI or Anthropic
- **API Keys**: Securely stored in `chrome.storage.local`

## Usage

1. Open a podcast or video page
2. Click the EchoShell extension icon
3. Select capture mode: 🎙 Audio, 👁 Screen, or ⚡ Both
4. Click **▶ Start** to begin transcription
5. View transcript in the Side Panel
6. Click timestamps to jump to that point in the video
7. Export transcript via the ⬇ button

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Build for development (with source maps)
npm run build:dev
```

## Architecture

- **Background Service Worker** (`src/background/service-worker.js`): Lifecycle and message routing
- **Offscreen Document** (`src/offscreen/`): Audio capture and processing (bypasses MV3 DOM restrictions)
- **Content Script** (`src/content/`): Floating subtitle overlay injection
- **Side Panel** (`src/sidepanel/`): Real-time transcript UI
- **Settings** (`src/settings/`): BYOK API configuration
- **Popup** (`src/popup/`): Quick start/stop controls

## Technical Notes

- Uses `chrome.tabCapture.getMediaStreamId()` + offscreen `getUserMedia` pattern (required in MV3)
- VAD (Voice Activity Detection) via RMS energy threshold prevents silent chunk API calls
- Frame diffing via Y-channel MSE avoids redundant OCR API calls
- Exponential backoff retry (3x) for 429/503 rate limiting

## License

MIT
