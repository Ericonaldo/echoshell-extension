/**
 * Side panel tests
 */

// Mock the storage module
jest.mock('../../src/utils/storage.js', () => ({
  getHistory: jest.fn().mockResolvedValue([]),
  clearHistory: jest.fn().mockResolvedValue(undefined)
}));

// Mock the export module
jest.mock('../../src/utils/export.js', () => ({
  exportSession: jest.fn().mockReturnValue(new Blob([''], { type: 'text/plain' }))
}));

describe('sidepanel', () => {
  let messageHandlers;

  beforeEach(() => {
    messageHandlers = [];
    chrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      messageHandlers.push(handler);
    });

    // Set up DOM
    document.body.innerHTML = `
      <div class="panel-container">
        <header class="panel-header">
          <h1 class="panel-title">EchoShell</h1>
          <div class="header-actions">
            <button id="history-btn">📋</button>
            <button id="export-btn">⬇</button>
            <button id="settings-btn">⚙</button>
            <button id="clear-btn">🗑</button>
          </div>
        </header>
        <div id="transcript-view" class="view active">
          <div id="transcript-list" class="transcript-list">
            <div class="empty-state">
              <p>No transcript yet.</p>
              <p class="hint">Click the extension icon to start capturing.</p>
            </div>
          </div>
        </div>
        <div id="history-view" class="view">
          <div class="view-header">
            <button id="back-btn">← Back</button>
            <h2>History</h2>
          </div>
          <div id="history-list" class="history-list"></div>
        </div>
        <div id="export-dialog" style="display:none;">
          <div class="dialog-content">
            <h3>Export Transcript</h3>
            <div class="export-options">
              <label><input type="radio" name="export-format" value="txt" checked> .txt</label>
              <label><input type="radio" name="export-format" value="md"> .md</label>
              <label><input type="radio" name="export-format" value="srt"> .srt</label>
            </div>
            <div class="dialog-actions">
              <button id="export-confirm-btn">Export</button>
              <button id="export-cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    jest.resetModules();
  });

  async function loadSidepanel() {
    await import('../../src/sidepanel/sidepanel.js');
    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));
    return messageHandlers[messageHandlers.length - 1];
  }

  test('registers onMessage listener', async () => {
    await loadSidepanel();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  test('renders transcript segment with timestamp and text', async () => {
    const handler = await loadSidepanel();

    handler({
      type: 'TRANSCRIPT_CHUNK',
      text: 'Hello world transcript',
      timestamp: 5000,
      source: 'asr'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const list = document.getElementById('transcript-list');
    const segment = list.querySelector('.transcript-segment');
    expect(segment).not.toBeNull();
    expect(segment.querySelector('.segment-text').textContent).toBe('Hello world transcript');
    expect(segment.querySelector('.segment-timestamp')).not.toBeNull();
  });

  test('new segments are appended, not replacing all content', async () => {
    const handler = await loadSidepanel();

    handler({ type: 'TRANSCRIPT_CHUNK', text: 'First', timestamp: 0 });
    handler({ type: 'TRANSCRIPT_CHUNK', text: 'Second', timestamp: 5000 });

    await new Promise(resolve => setTimeout(resolve, 50));

    const list = document.getElementById('transcript-list');
    const segments = list.querySelectorAll('.transcript-segment');
    expect(segments.length).toBe(2);
  });

  test('clicking timestamp fires SEEK_VIDEO message', async () => {
    const handler = await loadSidepanel();

    handler({
      type: 'TRANSCRIPT_CHUNK',
      text: 'Click me',
      timestamp: 30000, // 30 seconds
      source: 'asr'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const ts = document.querySelector('.segment-timestamp');
    ts.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SEEK_VIDEO',
        offset: 30 // seconds
      })
    );
  });

  test('OCR_CHUNK also appends a segment', async () => {
    const handler = await loadSidepanel();

    handler({
      type: 'OCR_CHUNK',
      text: 'OCR subtitle text',
      timestamp: 1000,
      source: 'ocr'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const segments = document.querySelectorAll('.transcript-segment');
    expect(segments.length).toBe(1);
    expect(segments[0].querySelector('.segment-text').textContent).toBe('OCR subtitle text');
  });

  test('export button shows export dialog', async () => {
    const handler = await loadSidepanel();

    // Add a segment first so export is available
    handler({ type: 'TRANSCRIPT_CHUNK', text: 'Some text', timestamp: 0 });
    await new Promise(resolve => setTimeout(resolve, 50));

    document.getElementById('export-btn').click();

    const dialog = document.getElementById('export-dialog');
    expect(dialog.style.display).toBe('flex');
  });

  test('export cancel button closes dialog', async () => {
    await loadSidepanel();

    const dialog = document.getElementById('export-dialog');
    dialog.style.display = 'flex';

    document.getElementById('export-cancel-btn').click();
    expect(dialog.style.display).toBe('none');
  });

  test('settings button opens options page', async () => {
    await loadSidepanel();

    document.getElementById('settings-btn').click();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
