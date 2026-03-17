import { MSG } from '../utils/constants.js';
import { getHistory, clearHistory } from '../utils/storage.js';
import { exportSession } from '../utils/export.js';

let currentSegments = [];
let currentSessionTitle = 'Transcript';

/**
 * Format timestamp in seconds to readable time
 */
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Append a new segment to the transcript view
 */
function appendSegment(segment) {
  const list = document.getElementById('transcript-list');

  // Remove empty state if present
  const emptyState = list.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const div = document.createElement('div');
  div.className = 'transcript-segment';
  div.dataset.timestamp = segment.timestamp;

  const ts = document.createElement('div');
  ts.className = 'segment-timestamp';
  ts.textContent = formatTime(segment.timestamp);

  const source = document.createElement('span');
  source.className = 'segment-source';
  source.textContent = segment.source === 'ocr' ? 'OCR' : 'ASR';
  ts.appendChild(source);

  const text = document.createElement('div');
  text.className = 'segment-text';
  text.textContent = segment.text;

  div.appendChild(ts);
  div.appendChild(text);

  // Click timestamp to seek video
  ts.addEventListener('click', () => {
    const offsetSeconds = Math.floor(segment.timestamp / 1000);
    chrome.runtime.sendMessage({ type: MSG.SEEK_VIDEO, offset: offsetSeconds });
  });

  list.appendChild(div);
  list.scrollTop = list.scrollHeight;

  currentSegments.push(segment);
}

/**
 * Load and display history
 */
async function loadHistory() {
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';

  const history = await getHistory(50);

  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state"><p>No history yet.</p></div>';
    return;
  }

  for (const session of history) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-title">${escapeHtml(session.title || 'Untitled')}</div>
      <div class="history-item-meta">
        ${new Date(session.createdAt).toLocaleString()} · ${session.segments?.length || 0} segments
      </div>
    `;
    item.addEventListener('click', () => loadHistorySession(session));
    historyList.appendChild(item);
  }
}

/**
 * Load a historical session into the transcript view
 */
function loadHistorySession(session) {
  currentSegments = [];
  currentSessionTitle = session.title || 'Transcript';

  const list = document.getElementById('transcript-list');
  list.innerHTML = '';

  if (!session.segments || session.segments.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No segments in this session.</p></div>';
  } else {
    for (const seg of session.segments) {
      appendSegment(seg);
    }
  }

  showView('transcript-view');
}

/**
 * Show a specific view
 */
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

/**
 * Escape HTML special chars
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Initialize the side panel
 */
function init() {
  // History button
  document.getElementById('history-btn').addEventListener('click', async () => {
    await loadHistory();
    showView('history-view');
  });

  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    showView('transcript-view');
  });

  // Export button
  document.getElementById('export-btn').addEventListener('click', () => {
    if (currentSegments.length === 0) return;
    document.getElementById('export-dialog').style.display = 'flex';
  });

  // Export confirm
  document.getElementById('export-confirm-btn').addEventListener('click', () => {
    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'txt';
    exportSession({ title: currentSessionTitle, segments: currentSegments }, format);
    document.getElementById('export-dialog').style.display = 'none';
  });

  // Export cancel
  document.getElementById('export-cancel-btn').addEventListener('click', () => {
    document.getElementById('export-dialog').style.display = 'none';
  });

  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Clear button
  document.getElementById('clear-btn').addEventListener('click', async () => {
    if (!confirm('Clear current transcript?')) return;
    currentSegments = [];
    const list = document.getElementById('transcript-list');
    list.innerHTML = '<div class="empty-state"><p>No transcript yet.</p><p class="hint">Click the extension icon to start capturing.</p></div>';
  });
}

/**
 * Message handler for incoming transcript chunks
 */
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case MSG.TRANSCRIPT_CHUNK:
    case MSG.OCR_CHUNK:
      appendSegment({
        timestamp: message.timestamp || Date.now(),
        text: message.text,
        source: message.source || 'asr'
      });
      break;
  }
});

document.addEventListener('DOMContentLoaded', init);
