import { MSG } from '../utils/constants.js';
import { getHistory, clearHistory } from '../utils/storage.js';
import { exportSession } from '../utils/export.js';
import './sidepanel.css';

let currentSegments = [];
let currentSessionTitle = 'Transcript';

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function appendSegment(segment) {
  const list = document.getElementById('transcript-list');
  const empty = list.querySelector('.empty-state');
  if (empty) empty.remove();

  const isOcr = segment.source === 'ocr';
  const div = document.createElement('div');
  div.className = 'transcript-segment';
  div.innerHTML = `
    <div class="segment-meta">
      <span class="segment-timestamp" data-ts="${segment.timestamp}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        ${formatTime(segment.timestamp)}
      </span>
      <span class="segment-source ${isOcr ? 'source-ocr' : ''}">${isOcr ? 'OCR' : 'ASR'}</span>
    </div>
    <p class="segment-text">${escapeHtml(segment.text)}</p>
  `;

  div.querySelector('.segment-timestamp').addEventListener('click', () => {
    const offsetSeconds = Math.floor(segment.timestamp / 1000);
    chrome.runtime.sendMessage({ type: MSG.SEEK_VIDEO, offset: offsetSeconds });
  });

  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
  currentSegments.push(segment);
}

async function loadHistory() {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '';
  const history = await getHistory(50);

  if (history.length === 0) {
    listEl.innerHTML = '<div class="empty-state" style="padding-top:40px"><p class="empty-title">No history</p><p class="empty-hint">Completed sessions will appear here.</p></div>';
    return;
  }

  for (const session of history) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-title">${escapeHtml(session.title || 'Untitled')}</div>
      <div class="history-item-meta">${new Date(session.createdAt).toLocaleString()} · ${session.segments?.length || 0} segments</div>
    `;
    item.addEventListener('click', () => loadHistorySession(session));
    listEl.appendChild(item);
  }
}

function loadHistorySession(session) {
  currentSegments = [];
  currentSessionTitle = session.title || 'Transcript';
  const list = document.getElementById('transcript-list');
  list.innerHTML = '';
  if (!session.segments?.length) {
    list.innerHTML = '<div class="empty-state" style="padding-top:40px"><p class="empty-title">No segments</p></div>';
  } else {
    for (const seg of session.segments) appendSegment(seg);
  }
  showView('transcript-view');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function init() {
  document.getElementById('history-btn').addEventListener('click', async () => {
    await loadHistory();
    showView('history-view');
  });

  document.getElementById('back-btn').addEventListener('click', () => showView('transcript-view'));

  document.getElementById('export-btn').addEventListener('click', () => {
    if (currentSegments.length === 0) return;
    document.getElementById('export-dialog').style.display = 'flex';
  });

  document.getElementById('export-confirm-btn').addEventListener('click', () => {
    const fmt = document.querySelector('input[name="export-format"]:checked')?.value || 'txt';
    exportSession({ title: currentSessionTitle, segments: currentSegments }, fmt);
    document.getElementById('export-dialog').style.display = 'none';
  });

  document.getElementById('export-cancel-btn').addEventListener('click', () => {
    document.getElementById('export-dialog').style.display = 'none';
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('clear-btn').addEventListener('click', async () => {
    if (!confirm('Clear current transcript?')) return;
    currentSegments = [];
    const list = document.getElementById('transcript-list');
    list.innerHTML = `
      <div class="empty-state">
        <svg class="empty-wave" width="64" height="40" viewBox="0 0 64 40" fill="none">
          <rect class="bar b1" x="2" y="12" width="6" height="16" rx="3" fill="#8b5cf6" opacity="0.3"/>
          <rect class="bar b2" x="11" y="6" width="6" height="28" rx="3" fill="#8b5cf6" opacity="0.5"/>
          <rect class="bar b3" x="20" y="10" width="6" height="20" rx="3" fill="#8b5cf6" opacity="0.7"/>
          <rect class="bar b4" x="29" y="4" width="6" height="32" rx="3" fill="#8b5cf6"/>
          <rect class="bar b5" x="38" y="10" width="6" height="20" rx="3" fill="#8b5cf6" opacity="0.7"/>
          <rect class="bar b6" x="47" y="6" width="6" height="28" rx="3" fill="#8b5cf6" opacity="0.5"/>
          <rect class="bar b7" x="56" y="12" width="6" height="16" rx="3" fill="#8b5cf6" opacity="0.3"/>
        </svg>
        <p class="empty-title">No transcript yet</p>
        <p class="empty-hint">Open the popup and click Start Capture<br>to begin transcribing audio or screen.</p>
      </div>`;
  });
}

chrome.runtime.onMessage.addListener((message) => {
  const pip = document.getElementById('live-pip');
  switch (message.type) {
    case MSG.TRANSCRIPT_CHUNK:
    case MSG.OCR_CHUNK:
      if (pip) pip.style.display = 'block';
      appendSegment({
        timestamp: message.timestamp || Date.now(),
        text: message.text,
        source: message.source || 'asr'
      });
      break;
    case MSG.STOP_CAPTURE:
      if (pip) pip.style.display = 'none';
      break;
  }
});

document.addEventListener('DOMContentLoaded', init);
