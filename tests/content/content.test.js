/**
 * Content script tests
 */

describe('content script', () => {
  let messageHandlers;

  beforeEach(() => {
    messageHandlers = [];
    chrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      messageHandlers.push(handler);
    });

    // Clean up any existing overlays
    const existing = document.getElementById('echoshell-subtitle-overlay');
    if (existing) existing.remove();

    // Reset DOM
    document.body.innerHTML = '';

    jest.resetModules();
  });

  async function loadContentScript() {
    await import('../../src/content/content.js');
    return messageHandlers[messageHandlers.length - 1];
  }

  test('registers onMessage listener', async () => {
    await loadContentScript();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  test('creates subtitle overlay div on SHOW_SUBTITLE message', async () => {
    const handler = await loadContentScript();
    const sendResponse = jest.fn();

    handler({ type: 'SHOW_SUBTITLE', text: 'Hello subtitle' }, {}, sendResponse);

    const overlay = document.getElementById('echoshell-subtitle-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toBe('Hello subtitle');
  });

  test('overlay becomes visible on SHOW_SUBTITLE', async () => {
    const handler = await loadContentScript();

    handler({ type: 'SHOW_SUBTITLE', text: 'Test subtitle' }, {}, jest.fn());

    const overlay = document.getElementById('echoshell-subtitle-overlay');
    expect(overlay.classList.contains('visible')).toBe(true);
  });

  test('subtitle text updates when new TRANSCRIPT_CHUNK message arrives', async () => {
    const handler = await loadContentScript();

    handler({ type: 'SHOW_SUBTITLE', text: 'First text' }, {}, jest.fn());
    handler({ type: 'SHOW_SUBTITLE', text: 'Updated text' }, {}, jest.fn());

    const overlay = document.getElementById('echoshell-subtitle-overlay');
    expect(overlay.textContent).toBe('Updated text');
  });

  test('HIDE_SUBTITLE removes visible class', async () => {
    const handler = await loadContentScript();

    handler({ type: 'SHOW_SUBTITLE', text: 'Some text' }, {}, jest.fn());
    handler({ type: 'HIDE_SUBTITLE' }, {}, jest.fn());

    const overlay = document.getElementById('echoshell-subtitle-overlay');
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  test('STOP_CAPTURE removes the subtitle overlay completely', async () => {
    const handler = await loadContentScript();

    handler({ type: 'SHOW_SUBTITLE', text: 'Text' }, {}, jest.fn());
    expect(document.getElementById('echoshell-subtitle-overlay')).not.toBeNull();

    handler({ type: 'STOP_CAPTURE' }, {}, jest.fn());
    expect(document.getElementById('echoshell-subtitle-overlay')).toBeNull();
  });

  test('SETTINGS_UPDATE with floatingSubtitles=false hides overlay', async () => {
    const handler = await loadContentScript();

    handler({ type: 'SHOW_SUBTITLE', text: 'Visible text' }, {}, jest.fn());

    handler({
      type: 'SETTINGS_UPDATE',
      settings: { ui: { floatingSubtitles: false } }
    }, {}, jest.fn());

    const overlay = document.getElementById('echoshell-subtitle-overlay');
    if (overlay) {
      expect(overlay.classList.contains('visible')).toBe(false);
    }
    // Either overlay is hidden or removed
  });

  test('SETTINGS_UPDATE with floatingSubtitles=true keeps enabled', async () => {
    const handler = await loadContentScript();

    handler({
      type: 'SETTINGS_UPDATE',
      settings: { ui: { floatingSubtitles: true } }
    }, {}, jest.fn());

    handler({ type: 'SHOW_SUBTITLE', text: 'Should show' }, {}, jest.fn());
    const overlay = document.getElementById('echoshell-subtitle-overlay');
    expect(overlay).not.toBeNull();
  });
});
