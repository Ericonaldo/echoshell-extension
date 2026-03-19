import { getSettings, setSettings } from '../utils/storage.js';
import { MSG } from '../utils/constants.js';
import './settings.css';

async function init() {
  const settings = await getSettings();
  populateForm(settings);
  bindEvents();
}

function populateForm(settings) {
  setVal('asr-provider', settings.asr.provider);
  setVal('asr-api-key', settings.asr.apiKey);
  setVal('asr-endpoint', settings.asr.endpoint);
  setVal('asr-model', settings.asr.model);
  setVal('asr-language', settings.asr.language === 'auto' ? '' : settings.asr.language);

  setVal('ocr-provider', settings.ocr.provider);
  setVal('ocr-api-key', settings.ocr.apiKey);
  setVal('ocr-endpoint', settings.ocr.endpoint);
  setVal('ocr-model', settings.ocr.model);

  setChecked('llm-enabled', settings.llm.enabled);
  setVal('llm-provider', settings.llm.provider);
  setVal('llm-api-key', settings.llm.apiKey);
  setVal('llm-model', settings.llm.model);
  toggleLlmFields(settings.llm.enabled);

  setChecked('floating-subtitles', settings.ui.floatingSubtitles);
  setVal('font-size', settings.ui.fontSize);
  updateFontSizeDisplay(settings.ui.fontSize);
}

function bindEvents() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active-section'));
      item.classList.add('active');
      document.getElementById(`section-${section}`)?.classList.add('active-section');
    });
  });

  // Key visibility toggles
  document.querySelectorAll('.key-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.querySelector('.eye-show').style.display = isPassword ? 'none' : '';
      btn.querySelector('.eye-hide').style.display = isPassword ? '' : 'none';
    });
  });

  // Font size display
  document.getElementById('font-size').addEventListener('input', e => {
    updateFontSizeDisplay(e.target.value);
  });

  // LLM toggle
  document.getElementById('llm-enabled').addEventListener('change', e => {
    toggleLlmFields(e.target.checked);
  });

  // Form submit
  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    await saveSettings();
  });
}

function toggleLlmFields(enabled) {
  const fields = document.getElementById('llm-fields');
  if (!fields) return;
  if (enabled) {
    fields.classList.add('expanded');
    fields.querySelectorAll('input, select').forEach(el => el.removeAttribute('disabled'));
  } else {
    fields.classList.remove('expanded');
    fields.querySelectorAll('input, select').forEach(el => el.setAttribute('disabled', ''));
  }
}

function updateFontSizeDisplay(value) {
  const el = document.getElementById('font-size-display');
  if (el) el.textContent = `${value}px`;
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
    chrome.runtime.sendMessage({ type: MSG.SETTINGS_UPDATE, settings });

    statusEl.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Saved
    `;
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.className = 'save-status error';
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
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
