import { getSettings, setSettings } from '../utils/storage.js';
import { MSG } from '../utils/constants.js';

async function init() {
  const settings = await getSettings();
  populateForm(settings);
  bindEvents(settings);
}

function populateForm(settings) {
  // ASR
  setVal('asr-provider', settings.asr.provider);
  setVal('asr-api-key', settings.asr.apiKey);
  setVal('asr-endpoint', settings.asr.endpoint);
  setVal('asr-model', settings.asr.model);
  setVal('asr-language', settings.asr.language === 'auto' ? '' : settings.asr.language);

  // OCR
  setVal('ocr-provider', settings.ocr.provider);
  setVal('ocr-api-key', settings.ocr.apiKey);
  setVal('ocr-endpoint', settings.ocr.endpoint);
  setVal('ocr-model', settings.ocr.model);

  // LLM
  setChecked('llm-enabled', settings.llm.enabled);
  setVal('llm-provider', settings.llm.provider);
  setVal('llm-api-key', settings.llm.apiKey);
  setVal('llm-model', settings.llm.model);

  // UI
  setChecked('floating-subtitles', settings.ui.floatingSubtitles);
  setVal('font-size', settings.ui.fontSize);
  updateFontSizeDisplay(settings.ui.fontSize);

  // Toggle LLM fields visibility
  toggleLlmFields(settings.llm.enabled);
}

function bindEvents(settings) {
  // Toggle password visibility
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  // Font size display
  document.getElementById('font-size').addEventListener('input', (e) => {
    updateFontSizeDisplay(e.target.value);
  });

  // LLM toggle
  document.getElementById('llm-enabled').addEventListener('change', (e) => {
    toggleLlmFields(e.target.checked);
  });

  // Form submit
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });
}

function toggleLlmFields(enabled) {
  const llmFields = document.getElementById('llm-fields');
  if (llmFields) {
    llmFields.style.opacity = enabled ? '1' : '0.4';
    llmFields.querySelectorAll('input, select').forEach(el => {
      el.disabled = !enabled;
    });
  }
}

function updateFontSizeDisplay(value) {
  const display = document.getElementById('font-size-display');
  if (display) display.textContent = `${value}px`;
}

async function saveSettings() {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = '';
  statusEl.className = 'save-status';

  try {
    const settings = {
      asr: {
        provider: getVal('asr-provider'),
        apiKey: getVal('asr-api-key'),
        endpoint: getVal('asr-endpoint'),
        model: getVal('asr-model'),
        language: getVal('asr-language') || 'auto'
      },
      ocr: {
        provider: getVal('ocr-provider'),
        apiKey: getVal('ocr-api-key'),
        endpoint: getVal('ocr-endpoint'),
        model: getVal('ocr-model')
      },
      llm: {
        provider: getVal('llm-provider'),
        apiKey: getVal('llm-api-key'),
        model: getVal('llm-model'),
        enabled: getChecked('llm-enabled')
      },
      ui: {
        floatingSubtitles: getChecked('floating-subtitles'),
        fontSize: parseInt(getVal('font-size'), 10) || 16,
        theme: 'dark'
      }
    };

    await setSettings(settings);

    // Broadcast settings update
    chrome.runtime.sendMessage({ type: MSG.SETTINGS_UPDATE, settings });

    statusEl.textContent = '✓ Settings saved';
    statusEl.className = 'save-status';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.className = 'save-status error';
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function getChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

document.addEventListener('DOMContentLoaded', init);
