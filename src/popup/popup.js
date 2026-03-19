import { MSG } from '../utils/constants.js';
import { getSettings, setSettings } from '../utils/storage.js';
import './popup.css';

let isCapturing = false;
let timerInterval = null;
let timerSeconds = 0;

async function init() {
  const settings = await getSettings();

  // Set current mode
  const modeInput = document.querySelector(`input[name="mode"][value="${settings.captureMode}"]`);
  if (modeInput) modeInput.checked = true;

  // Check current capture status
  try {
    const status = await chrome.runtime.sendMessage({ type: MSG.CAPTURE_STATUS });
    if (status?.captureActive) setCapturingState(true);
  } catch (_) {}

  // Mode change
  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener('change', async () => {
      const updatedSettings = await getSettings();
      updatedSettings.captureMode = input.value;
      await setSettings(updatedSettings);
    });
  });

  document.getElementById('start-btn').addEventListener('click', startCapture);
  document.getElementById('stop-btn').addEventListener('click', stopCapture);

  document.getElementById('settings-link').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('open-panel-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  });
}

async function startCapture() {
  const errorEl = document.getElementById('error-msg');
  errorEl.style.display = 'none';

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

  startBtn.disabled = capturing;
  stopBtn.disabled = !capturing;

  if (capturing) {
    pip.className = 'status-pip active';
    statusText.textContent = 'Recording';
    timerEl.style.display = 'inline';
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
    clearInterval(timerInterval);
  }
}

function showError(message) {
  const errorEl = document.getElementById('error-msg');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  document.getElementById('status-indicator').className = 'status-pip error';
  document.getElementById('status-text').textContent = 'Error';
}

document.addEventListener('DOMContentLoaded', init);
