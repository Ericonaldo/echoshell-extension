# EchoShell - Chrome Extension

> BYOK (Bring Your Own Key) Chrome Extension for high-precision podcast and video transcription. Capture real-time audio (ASR) and on-screen subtitles (OCR) simultaneously.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration (BYOK)](#configuration-byok)
  - [ASR Providers](#asr-providers)
  - [OCR Providers](#ocr-providers)
  - [LLM Polish](#llm-polish)
- [Usage Guide](#usage-guide)
  - [Capture Modes](#capture-modes)
  - [Side Panel](#side-panel)
  - [Floating Subtitles](#floating-subtitles)
  - [History & Export](#history--export)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Running Tests](#running-tests)
  - [Building](#building)
- [Architecture](#architecture)
- [Privacy & Security](#privacy--security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| 🎙 **Audio ASR** | Captures tab audio, transcribes via Whisper/Deepgram/Groq |
| 👁 **Screen OCR** | Extracts on-screen subtitles with frame-diff optimization |
| ⚡ **Dual Mode** | Both ASR and OCR simultaneously |
| 🔑 **BYOK** | Your API keys, stored only on your device |
| 📋 **Side Panel** | Real-time transcript with clickable timestamps |
| 💬 **Floating Subtitles** | Overlaid subtitles on any video player |
| ✨ **LLM Polish** | Optional GPT/Claude cleanup of raw transcript |
| 📤 **Export** | Download as `.txt`, `.md`, or `.srt` |

---

## Quick Start (Free Setup)

The fastest way to get started at zero cost:

1. **Install** the extension (see [Installation](#installation))
2. Get a free [Groq API key](https://console.groq.com) — takes 30 seconds
3. Open **Settings** (⚙) → ASR → set Provider to **Groq**, paste your key, set model to `whisper-large-v3-turbo`
4. For OCR, set Provider to **Tesseract.js** — no key needed, works offline
5. Navigate to any podcast/video page (YouTube, Spotify, etc.)
6. Click the EchoShell icon → select **🎙 Audio** mode → click **▶ Start**
7. Your transcript appears live in the **Side Panel**

---

## Installation

### From Source

```bash
git clone git@github.com:Ericonaldo/echoshell-extension.git
cd echoshell-extension
npm install
npm run build
```

Then load in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Prerequisites

- Node.js ≥ 18
- Chrome ≥ 116 (for Side Panel API)

---

## Configuration (BYOK)

Open Settings via the ⚙ icon in the popup or side panel. All keys are stored locally in `chrome.storage.local` and never leave your browser.

### ASR Providers

| Provider | Model | Cost | Notes |
|---|---|---|---|
| **Groq** | `whisper-large-v3-turbo` | **Free tier** ⭐ | Fastest inference, generous free quota — recommended |
| **OpenAI** | `whisper-1` | $0.006/min | Best accuracy |
| **Deepgram** | `nova-2` | $200 free credit | Great for live streaming |
| **Custom** | Any | Varies | Any OpenAI-compatible endpoint |

> **Recommended**: Groq — get a free key at [console.groq.com](https://console.groq.com). Use model `whisper-large-v3-turbo` for the best speed/accuracy balance.

**Fields:**
- **API Key** — your provider's secret key
- **Endpoint URL** — leave blank for default, or enter a custom proxy
- **Model** — model name (e.g. `whisper-large-v3-turbo`)
- **Language** — ISO code (`en`, `zh`, `ja`…) or leave blank for auto-detect

### OCR Providers

| Provider | Cost | Notes |
|---|---|---|
| **Tesseract.js** | **Free, offline** ⭐ | No API key needed, works without internet — recommended |
| **OpenAI Vision** | $0.15/1M tokens | `gpt-4o-mini` — better with stylized/degraded fonts |

> **Recommended**: Tesseract.js — zero cost, no key required, fully private.

OCR uses frame-diff to detect subtitle changes — only triggers processing when the subtitle region changes significantly, saving quota.

### LLM Polish

Optional cleanup pass on raw ASR/OCR output (fix punctuation, remove filler words):

| Provider | Model | Cost | Notes |
|---|---|---|---|
| **Groq** | `llama-3.1-8b-instant` | **Free tier** ⭐ | Fast, good quality for cleanup |
| **OpenAI** | `gpt-4o-mini` | $0.15/1M tokens | Reliable, cheap |
| **Anthropic** | `claude-haiku-4-5` | $0.80/1M tokens | Best quality/price ratio |
| **Custom** | Any | Varies | Any OpenAI-compatible endpoint |

> **Recommended**: Disable if not needed, or use Groq with `llama-3.1-8b-instant` for free cleanup.

Enable the **"Enable LLM text polish"** toggle to activate.

---

## Usage Guide

### Capture Modes

Select a mode in the popup before starting:

| Mode | How it works |
|---|---|
| 🎙 **Audio** | Captures tab audio stream → sends 10s chunks to ASR API |
| 👁 **Screen** | Captures video frame → crops bottom 20% → OCR on subtitle changes |
| ⚡ **Both** | Runs audio and OCR pipelines in parallel |

Click **▶ Start** to begin. A green pulsing dot indicates active recording. Click **⏹ Stop** to end the session.

### Side Panel

Open via **"Open Side Panel"** in the popup or click the browser's side panel button.

- **Transcript segments** appear in real time as audio is processed
- **Click any timestamp** to jump to that moment in the video
- Each segment is labeled `ASR` or `OCR` in the corner

### Floating Subtitles

When enabled (Settings → Display → "Show floating subtitles"), a dark overlay appears at the bottom of the video player showing the latest transcript line.

- Works on YouTube, Bilibili, and any page with an HTML5 `<video>` element
- Auto-hides after 8 seconds if no new text arrives
- Toggle off in Settings if you find it distracting

### History & Export

**History** (📋 button in side panel): Browse all past transcription sessions. Click any session to reload it into the transcript view.

**Export** (⬇ button): Choose format and download:

| Format | Best for |
|---|---|
| `.txt` | Plain reading, pasting into docs |
| `.md` | Markdown with timestamp headings |
| `.srt` | Import into video editors (Premiere, DaVinci) |

**Clear** (🗑 button): Clears the current session's transcript from the view (does not delete history).

---

## Development

### Project Structure

```
echoshell-extension/
├── manifest.json              # Chrome Extension MV3 manifest
├── webpack.config.js          # Build config (6 entry points)
├── src/
│   ├── background/
│   │   └── service-worker.js  # Message router, offscreen lifecycle
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.js       # Audio capture, VAD, ASR pipeline
│   ├── content/
│   │   ├── content.js         # Floating subtitle overlay
│   │   └── content.css
│   ├── sidepanel/
│   │   ├── sidepanel.html
│   │   ├── sidepanel.js       # Real-time transcript UI
│   │   └── sidepanel.css
│   ├── settings/
│   │   ├── settings.html
│   │   ├── settings.js        # BYOK config form
│   │   └── settings.css
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js           # Start/stop controls
│   │   └── popup.css
│   └── utils/
│       ├── constants.js       # MSG types, provider enums, defaults
│       ├── storage.js         # chrome.storage wrappers
│       ├── asr-client.js      # Multi-provider ASR with retry
│       ├── ocr-client.js      # OpenAI Vision / Tesseract
│       ├── llm-client.js      # Text polish, streaming
│       ├── audio-utils.js     # WAV builder, PCM encoder, RMS
│       ├── frame-diff.js      # Y-channel MSE diff, crop
│       └── export.js          # .txt / .md / .srt formatters
└── tests/
    ├── setup.js               # Chrome API mocks (setupFiles)
    ├── setup-after.js         # beforeEach resets (setupFilesAfterEnv)
    ├── background/
    ├── content/
    ├── offscreen/
    ├── sidepanel/
    └── utils/                 # Unit tests for all util modules
```

### Running Tests

```bash
npm test                # Run all tests with coverage
npm run test:watch      # Watch mode
```

Current status: **139 tests passing** across 11 suites.

### Building

```bash
npm run build           # Production build → dist/
npm run build:dev       # Development build with source maps
```

Output files in `dist/` are what gets loaded as the unpacked extension.

---

## Architecture

### Data Flow

```
[Tab Audio] ──tabCapture.getMediaStreamId()──▶ [Offscreen Doc]
                                                      │
                                               MediaRecorder
                                               VAD (RMS check)
                                                      │
                                               ASR API call
                                                      │
                                          ◀── TRANSCRIPT_CHUNK ──▶ [Background SW]
                                                                          │
                                                         ┌────────────────┼────────────────┐
                                                         ▼                ▼                ▼
                                                   [Side Panel]   [Content Script]   [Storage]
                                                  (display text)  (floating subtitle) (history)
```

```
[Screen Video] ──getDisplayMedia()──▶ [Offscreen Doc]
                                             │
                                      requestAnimationFrame
                                      cropBottomPercent(20%)
                                      frameDiff MSE check
                                             │
                                       OCR API call
                                             │
                                    ◀── OCR_CHUNK ──▶ [Background SW] ──▶ ...
```

### Key Technical Decisions

- **MV3 audio capture**: `chrome.tabCapture.getMediaStreamId()` returns a string ID that the offscreen document uses with `getUserMedia({ chromeMediaSource: 'tab' })`. Direct stream transfer across contexts is not supported in MV3.
- **Service worker ephemerality**: All persistent state lives in `chrome.storage.local` / `chrome.storage.session`. The SW itself holds no in-memory state between activations.
- **One offscreen doc limit**: Chrome allows only one offscreen document per extension. The background SW guards creation with `hasDocument()` checks.
- **VAD**: RMS energy threshold (`< 0.01`) discards silent audio chunks before making any API call.
- **Frame diff**: Y-channel (luminance) MSE between consecutive subtitle crops. Only calls OCR when MSE > 10.
- **Retry**: Exponential backoff (1s, 2s, 4s) for HTTP 429 and 503 responses, up to 3 attempts.

---

## Test URLs

Use these publicly available podcasts and talks to verify each capture mode.

### Native Subtitle Extraction (no API key needed)

| Site | URL | Why |
|------|-----|-----|
| **YouTube** | `https://www.youtube.com/watch?v=H14bBuluwB8` | Lex Fridman Podcast — auto-captions + manual EN |
| **YouTube** | `https://www.youtube.com/watch?v=tLd9LWqnLfY` | Huberman Lab — multi-language captions |
| **YouTube** | `https://www.youtube.com/watch?v=JN3KPFbWDog` | TED on YouTube — verified manual captions |
| **TED.com** | `https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity` | Classic TED, `<track>` WebVTT, 60+ languages |
| **TED.com** | `https://www.ted.com/talks/brene_brown_the_power_of_vulnerability` | Multi-speaker segments, good diarization test |
| **Bilibili** | `https://www.bilibili.com/video/BV1GJ411x7h7` | CN subtitles via `/x/player/v2` API |

### Audio ASR (requires Groq or OpenAI key)

| Site | URL | Why |
|------|-----|-----|
| **YouTube** | `https://www.youtube.com/watch?v=aircAruvnKk` | 3Blue1Brown — clear single speaker, good ASR baseline |
| **NPR** | `https://www.npr.org/podcasts/510310/how-i-built-this` | HTML5 audio player, no native subs → ASR fallback |
| **Spotify** | `https://open.spotify.com/episode/3ZDMrCJtSqVUPzTMFZHqbN` | No native subs → ASR fallback |

### Screen OCR

| Site | URL | Why |
|------|-----|-----|
| **YouTube** | Any video with CC enabled | Turn on YouTube's own CC, then use EchoShell OCR mode to capture them visually |
| **Bilibili** | Any video with burn-in subs | Tests frame-diff + Tesseract on hardcoded Chinese subtitles |

### Speaker Diarization

| Test | How |
|------|-----|
| **Two-host podcast** | Use Deepgram ASR on any podcast with 2 speakers (e.g. Lex Fridman) — segments will be labeled Speaker A / Speaker B |
| **Native with speaker labels** | Open `https://www.ted.com/talks/brene_brown_the_power_of_vulnerability` → native mode — `>> Speaker:` patterns parsed automatically |

---

## Privacy & Security

- **No telemetry**: EchoShell sends zero data to any EchoShell server. It only contacts the API providers you configure.
- **Local storage**: API keys are stored in `chrome.storage.local` — accessible only to this extension, not to web pages or other extensions.
- **BYOK model**: You control which provider receives your audio/screen data. Use a local Whisper.cpp endpoint for fully offline operation.
- **No key logging**: Keys are never included in error messages or console output.

---

## Troubleshooting

**"Failed to start capture"**
- Make sure you're on an HTTP/HTTPS page (not `chrome://` pages)
- Check that the ASR API key is configured in Settings

**No transcript appearing**
- Verify the API key is valid and has sufficient quota
- For audio mode: check the tab has audio playing
- Open DevTools on the extension's background page (`chrome://extensions` → EchoShell → "Service Worker") to see error logs

**Floating subtitles not showing**
- Enable "Show floating subtitles" in Settings → Display
- The overlay requires an HTML5 `<video>` element on the page

**OCR mode captures blank text**
- Ensure the video has visible on-screen subtitles/captions
- Try Audio mode instead for audio-based transcription

---

## License

MIT
