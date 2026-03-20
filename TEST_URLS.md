# EchoShell — Test URLs

Quick reference for manual testing. Open each URL in Chrome with EchoShell installed, then click the extension icon.

---

## Native Subtitle Extraction ✅ (zero API calls)

Click **Start Transcript** → EchoShell auto-detects and exports without any API key.

### YouTube

| URL | Expected | Tracks |
|-----|----------|--------|
| `https://www.youtube.com/watch?v=H14bBuluwB8` | Lex Fridman #400 — EN auto-captions | EN (auto), may have manual |
| `https://www.youtube.com/watch?v=tLd9LWqnLfY` | Huberman Lab — sleep science | EN manual captions |
| `https://www.youtube.com/watch?v=JN3KPFbWDog` | TED (YouTube mirror) | EN + translations |
| `https://www.youtube.com/watch?v=aircAruvnKk` | 3Blue1Brown — Neural networks | EN manual, clean audio |
| `https://www.youtube.com/watch?v=NNnIGh9g6fA` | Y Combinator Startup School | EN auto-captions |

### TED.com (HTML5 `<track>` WebVTT)

| URL | Expected |
|-----|----------|
| `https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity` | EN + 60 languages, `<track>` elements |
| `https://www.ted.com/talks/brene_brown_the_power_of_vulnerability` | EN, good for speaker label parsing test |
| `https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action` | EN + multiple translations |

### Coursera (HTML5 `<track>`)

Requires free account login. Any video lecture page will have `<track kind="subtitles">`.

| URL pattern | Expected |
|-------------|----------|
| `https://www.coursera.org/learn/*/lecture/*` | EN subtitles via `<track>` |

### Bilibili (CN subtitles)

| URL | Expected |
|-----|----------|
| `https://www.bilibili.com/video/BV1GJ411x7h7` | CN subtitles from `/x/player/v2` API |

---

## Audio ASR Mode 🎙 (requires API key)

Set up **Groq** (free) in Settings → ASR first: `whisper-large-v3-turbo`.

| URL | Why good for testing |
|-----|----------------------|
| `https://www.youtube.com/watch?v=aircAruvnKk` | Clear single speaker, technical vocabulary |
| `https://www.youtube.com/watch?v=H14bBuluwB8` | Long-form, two speakers → diarization test |
| `https://www.npr.org/podcasts/510310/how-i-built-this` | No native subs, forces ASR fallback |

---

## Speaker Diarization 🗣🗣

### Via Deepgram (native diarization)

1. Settings → ASR → Provider: **Deepgram**, enter key, Model: `nova-2`
2. Open any multi-speaker podcast on YouTube
3. Click Start Transcript → Audio mode
4. Side panel should show **Speaker A** / **Speaker B** dividers

Good test URLs:
- `https://www.youtube.com/watch?v=H14bBuluwB8` (Lex Fridman — 2 speakers)
- `https://www.youtube.com/watch?v=tLd9LWqnLfY` (Huberman Lab solo → single speaker)

### Via Native Subtitles (pattern parsing)

Native subtitles with `>> Name:` or `[Name]` prefixes are parsed automatically:
- TED talks with multiple speakers (panel discussions)
- YouTube videos where the uploader manually labeled speakers in captions

---

## Screen OCR Mode 👁

1. Open any YouTube video
2. Enable YouTube's own CC (`C` key or CC button)
3. EchoShell → Screen mode → Start
4. Subtitles are captured visually via frame-diff + Tesseract/OpenAI Vision

---

## Expected Results Checklist

After running each test, verify:

- [ ] Popup shows correct site name in native card (e.g. "YouTube", "TED")
- [ ] Language selector shows available tracks
- [ ] "Export to Side Panel" loads all segments instantly (no API call)
- [ ] Segments have correct timestamps (click → video seeks)
- [ ] Speaker dividers appear when multiple speakers detected
- [ ] Source badge shows "Native" (green), "ASR", or "OCR"
- [ ] Export to `.txt` / `.md` / `.srt` includes speaker labels
