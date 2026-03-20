import { MSG } from '../utils/constants.js';
import { getSettings, setSettings } from '../utils/storage.js';
import './popup.css';

let isCapturing = false;
let timerInterval = null;
let timerSeconds = 0;

// State for native subtitle detection
let nativeTrackInfo = null; // { site, method, tracks, segments }

/**
 * Show a specific view (idle/detecting/native/ai)
 * @param {string} viewId - e.g. 'view-idle'
 */
function showView(viewId) {
  document.querySelectorAll('.popup-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(viewId);
  if (el) el.classList.add('active');
}

async function init() {
  const settings = await getSettings();

  // Set current mode
  const modeInput = document.querySelector(`input[name="mode"][value="${settings.captureMode}"]`);
  if (modeInput) modeInput.checked = true;

  // Check current capture status
  try {
    const status = await chrome.runtime.sendMessage({ type: MSG.CAPTURE_STATUS });
    if (status?.captureActive) {
      showView('view-ai');
      setCapturingState(true);
    }
  } catch (_) {}

  // Event: settings button
  document.getElementById('settings-link').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Event: "Start Transcript" button (idle view)
  document.getElementById('start-transcript-btn').addEventListener('click', onStartTranscript);

  // Event: "View in Forum" link (forum-found view) — href set dynamically
  // Event: "Transcribe anyway" (forum-found view)
  document.getElementById('skip-forum-btn').addEventListener('click', () => {
    showView('view-detecting');
    runNativeSubtitleDetection();
  });

  // Event: open side panel (idle view)
  document.getElementById('open-panel-idle-btn').addEventListener('click', openSidePanel);

  // Event: "Export to Side Panel" (native view)
  document.getElementById('export-to-panel-btn').addEventListener('click', onExportToSidePanel);

  // Event: "Use AI instead" link (native view)
  document.getElementById('use-ai-btn').addEventListener('click', () => {
    showView('view-ai');
    document.getElementById('no-native-notice').style.display = 'none';
  });

  // Event: start capture (AI view)
  document.getElementById('start-btn').addEventListener('click', startCapture);

  // Event: stop capture (AI view)
  document.getElementById('stop-btn').addEventListener('click', stopCapture);

  // Event: open side panel (AI view)
  document.getElementById('open-panel-btn').addEventListener('click', openSidePanel);

  // Event: config settings button
  document.getElementById('config-settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Mode change -> save settings + check config warning
  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener('change', async () => {
      const updatedSettings = await getSettings();
      updatedSettings.captureMode = input.value;
      await setSettings(updatedSettings);
      await updateConfigWarning(input.value, updatedSettings);
    });
  });

  // Pre-check config warning for current mode
  await updateConfigWarning(settings.captureMode, settings);
}

/**
 * "Start Transcript" clicked from idle view:
 * 1. Check forum for existing transcript (if enabled)
 * 2. If found -> show forum-found view with link
 * 3. If not found -> show detecting view
 * 4. Detect native subtitles -> show native or AI view
 */
async function onStartTranscript() {
  clearError();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError('No active tab found');
      return;
    }

    // Step 1: Check forum for existing transcript
    const forumResult = await chrome.runtime.sendMessage({
      type: MSG.FORUM_CHECK,
      url: tab.url
    });

    if (forumResult?.found && forumResult?.forumUrl) {
      // Show forum-found view
      const titleEl = document.getElementById('forum-episode-title');
      if (titleEl) titleEl.textContent = forumResult.episodeTitle || 'Episode';
      const openBtn = document.getElementById('open-forum-btn');
      if (openBtn) openBtn.href = forumResult.forumUrl;
      showView('view-forum-found');
      return;
    }

    // Step 2: Proceed to native subtitle detection
    showView('view-detecting');
    await runNativeSubtitleDetection();
  } catch (err) {
    showView('view-detecting');
    await runNativeSubtitleDetection();
  }
}

/**
 * Detect native subtitles and show appropriate view
 */
async function runNativeSubtitleDetection() {
  clearError();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError('No active tab found');
      showView('view-idle');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: MSG.DETECT_NATIVE_SUBTITLES,
      tabId: tab.id
    });

    if (response?.found && response?.tracks?.length > 0) {
      nativeTrackInfo = response;
      showNativeView(response);
    } else {
      nativeTrackInfo = null;
      showView('view-ai');
      document.getElementById('no-native-notice').style.display = 'flex';
    }
  } catch (err) {
    nativeTrackInfo = null;
    showView('view-ai');
    document.getElementById('no-native-notice').style.display = 'flex';
  }
}

/**
 * Populate and show the native subtitle view
 * @param {Object} info - { site, tracks, segments }
 */
function showNativeView(info) {
  const siteNameEl = document.getElementById('native-site-name');
  if (siteNameEl) siteNameEl.textContent = info.site || 'Native';

  const select = document.getElementById('native-track-select');
  select.innerHTML = '';
  const tracks = info.tracks || [];
  tracks.forEach((track, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    const autoLabel = track.isAuto ? ' (auto)' : '';
    opt.textContent = `${track.label || track.lang || 'Subtitles'}${autoLabel}`;
    select.appendChild(opt);
  });

  showView('view-native');
}

/**
 * "Export to Side Panel" clicked: load chosen track's segments into side panel
 */
async function onExportToSidePanel() {
  if (!nativeTrackInfo) return;

  const select = document.getElementById('native-track-select');
  const trackIndex = parseInt(select.value, 10) || 0;

  // If we already have segments from detection (first track), use them
  // Otherwise, re-fetch with the chosen track index
  let segments = nativeTrackInfo.segments || [];

  if (trackIndex !== 0 || segments.length === 0) {
    // Need to re-fetch for a different track
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const response = await chrome.runtime.sendMessage({
          type: MSG.DETECT_NATIVE_SUBTITLES,
          tabId: tab.id,
          trackIndex
        });
        segments = response?.segments || [];
      }
    } catch (_) {}
  }

  // Send segments to side panel
  try {
    await chrome.runtime.sendMessage({
      type: MSG.NATIVE_SEGMENTS,
      segments,
      site: nativeTrackInfo.site,
      trackIndex
    });
  } catch (_) {}

  // Open side panel
  await openSidePanel();
}

async function openSidePanel() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  } catch (err) {
    showError(err.message);
  }
}

async function startCapture() {
  clearError();

  // Check config warning before starting
  const settings = await getSettings();
  const mode = document.querySelector('input[name="mode"]:checked')?.value || settings.captureMode;
  const warning = await checkModeConfigured(mode, settings);
  if (warning) {
    showError(warning + ' — please configure in Settings');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showError('No active tab found'); return; }

    const response = await chrome.runtime.sendMessage({
      type: MSG.START_CAPTURE,
      tabId: tab.id,
      url: tab.url,
      title: tab.title
    });

    if (response?.success) {
      setCapturingState(true);
    } else {
      showError(response?.error || 'Failed to start capture');
    }
  } catch (err) {
    showError(err.message);
  }
}

async function stopCapture() {
  try {
    await chrome.runtime.sendMessage({ type: MSG.STOP_CAPTURE });
    setCapturingState(false);
  } catch (err) {
    showError(err.message);
  }
}

function setCapturingState(capturing) {
  isCapturing = capturing;
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const pip = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const timerEl = document.getElementById('status-timer');

  if (!startBtn || !stopBtn) return;

  startBtn.disabled = capturing;
  stopBtn.disabled = !capturing;

  const statusBar = document.querySelector('.status-bar');

  if (capturing) {
    pip.className = 'status-pip active';
    statusText.textContent = 'Recording';
    timerEl.style.display = 'inline';
    statusBar?.classList.add('recording');
    timerSeconds = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = Math.floor(timerSeconds / 60);
      const s = timerSeconds % 60;
      timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 1000);
  } else {
    pip.className = 'status-pip inactive';
    statusText.textContent = 'Ready';
    timerEl.style.display = 'none';
    statusBar?.classList.remove('recording');
    clearInterval(timerInterval);
  }
}

/**
 * Check if the selected mode is properly configured
 * @param {string} mode - 'audio', 'ocr', or 'both'
 * @param {Object} settings
 * @returns {Promise<string|null>} Warning message or null if configured
 */
export async function checkModeConfigured(mode, settings) {
  if (mode === 'audio' || mode === 'both') {
    if (!settings.asr?.apiKey && settings.asr?.provider !== 'tesseract') {
      return 'ASR API key not configured';
    }
  }
  if (mode === 'ocr' || mode === 'both') {
    if (settings.ocr?.provider === 'openai' && !settings.ocr?.apiKey) {
      return 'OCR API key not configured';
    }
  }
  return null;
}

/**
 * Show or hide config warning pill based on current mode
 */
async function updateConfigWarning(mode, settings) {
  const warning = await checkModeConfigured(mode, settings);
  const warningEl = document.getElementById('config-warning');
  const warningText = document.getElementById('config-warning-text');
  if (!warningEl || !warningText) return;

  if (warning) {
    warningText.textContent = warning;
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }
}

function showError(message) {
  const errorEl = document.getElementById('error-msg');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearError() {
  const errorEl = document.getElementById('error-msg');
  if (errorEl) errorEl.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', init);
