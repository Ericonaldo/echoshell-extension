# Screenshots needed

Take these screenshots and save them in this folder with the exact filenames below.
All should be taken with Chrome's built-in screenshot tool or any screen capture app.

---

## 1. `popup-idle.png`
- Click the EchoShell toolbar icon
- Capture the popup in its **idle state** (before clicking Start Transcript)
- Size: ~288px wide popup
- Shows: logo, "Start Transcript" button, site chips (YouTube · Bilibili · TED…)

## 2. `popup-native-found.png`
- Open `https://www.youtube.com/watch?v=H14bBuluwB8`
- Click EchoShell icon → click "Start Transcript"
- Wait for detection to complete
- Capture the **green native-found card**
- Shows: ✓ YouTube · Native badge · language selector · "Export to Side Panel" button

## 3. `sidepanel-transcript.png`
- After exporting native subtitles (or after an ASR session)
- Capture the **side panel** with several transcript segments visible
- Ideally with a Speaker A / Speaker B divider visible
- Shows: segment cards with timestamps, ASR/OCR/Native badges, speaker dividers

## 4. `settings.png`
- Open Settings (⚙ icon in popup or side panel)
- Capture the full settings page showing the **ASR section**
- Shows: provider dropdown, API key field (masked), model, language fields

## 5. `overlay.png`
- Open any YouTube video, start capture
- Capture the **floating subtitle overlay** at the bottom of the video
- Shows: glassmorphism pill with subtitle text over the video player

---

## Tips
- Use Chrome's DevTools device toolbar to get a clean popup screenshot (288px × auto)
- For the side panel: drag it to a comfortable width (~360px) before screenshotting
- For the overlay: use a video with a clean background so the overlay stands out
- Crop out browser chrome (address bar, tabs) if desired for cleaner screenshots
