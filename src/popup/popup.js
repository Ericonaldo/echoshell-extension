import { MSG, CAPTURE_MODES } from '../utils/constants.js';
import { getSettings, setSettings } from '../utils/storage.js';

let isCapturing = false;

async function init() {
  const settings = await getSettings();

  // Set current mode
  const modeInput = document.querySelector(`input[name="mode"][value="${settings.captureMode}"]`);
  if (modeInput) modeInput.checked = true;

  // Check current capture status
  const status = await chrome.runtime.sendMessage({ type: MSG.CAPTURE_STATUS });
  if (status?.captureActive) {
    setCapturingState(true);
  }

  // Mode change
  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener('change', async () => {
      const updatedSettings = await getSettings();
      updatedSettings.captureMode = input.value;
      await setSettings(updatedSettings);
    });
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click', startCapture);

  // Stop button
  document.getElementById('stop-btn').addEventListener('click', stopCapture);

  // Settings link
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Open side panel
  document.getElementById('open-panel-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  });
}

async function startCapture() {
  const errorMsg = document.getElementById('error-msg');
  errorMsg.style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError('No active tab found');
      return;
    }

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
  const statusDot = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  startBtn.disabled = capturing;
  stopBtn.disabled = !capturing;

  if (capturing) {
    statusDot.className = 'status-dot active';
    statusText.textContent = 'Recording...';
  } else {
    statusDot.className = 'status-dot inactive';
    statusText.textContent = 'Inactive';
  }
}

function showError(message) {
  const errorMsg = document.getElementById('error-msg');
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  document.getElementById('status-indicator').className = 'status-dot error';
}

document.addEventListener('DOMContentLoaded', init);
