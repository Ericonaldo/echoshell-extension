/**
 * Service worker tests
 * Since service-worker.js uses top-level addListener calls, we test the logic functions
 * by importing the module in a controlled environment.
 */

// We need to set up chrome mocks before importing the module
// The setup.js file handles global chrome mocks

describe('service-worker message handling', () => {
  let messageHandlers;

  beforeEach(() => {
    // Capture message listeners registered by the module
    messageHandlers = [];
    chrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      messageHandlers.push(handler);
    });
    chrome.action.onClicked.addListener.mockImplementation(jest.fn());
    chrome.runtime.onInstalled.addListener.mockImplementation(jest.fn());

    // Reset storage mock
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue(undefined);
    chrome.storage.session.get.mockResolvedValue({ captureActive: false });
    chrome.storage.session.set.mockResolvedValue(undefined);

    // Re-import the module to register fresh handlers
    jest.resetModules();
  });

  test('onMessage listener is registered during module load', async () => {
    await import('../../src/background/service-worker.js');
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  test('START_CAPTURE creates offscreen document if none exists', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(false);
    chrome.tabCapture.getMediaStreamId.mockResolvedValue('stream-123');
    chrome.storage.local.get.mockResolvedValue({
      settings: {
        captureMode: 'audio',
        asr: { provider: 'openai', apiKey: 'sk-key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1', language: 'en' }
      }
    });

    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];

    const sendResponse = jest.fn();
    const returnValue = handler(
      { type: 'START_CAPTURE', tabId: 1, url: 'https://example.com', title: 'Test' },
      { tab: { id: 1 } },
      sendResponse
    );

    // Should return true (async)
    expect(returnValue).toBe(true);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(chrome.offscreen.createDocument).toHaveBeenCalled();
  });

  test('START_CAPTURE skips offscreen creation if already exists', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(true);
    chrome.tabCapture.getMediaStreamId.mockResolvedValue('stream-456');
    chrome.storage.local.get.mockResolvedValue({
      settings: {
        captureMode: 'audio',
        asr: { provider: 'openai', apiKey: 'sk-key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1', language: 'en' }
      }
    });

    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    handler(
      { type: 'START_CAPTURE', tabId: 1 },
      { tab: { id: 1 } },
      sendResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
  });

  test('STOP_CAPTURE calls offscreen.closeDocument()', async () => {
    chrome.offscreen.hasDocument.mockResolvedValue(true);

    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    handler({ type: 'STOP_CAPTURE' }, {}, sendResponse);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(chrome.offscreen.closeDocument).toHaveBeenCalled();
  });

  test('TRANSCRIPT_CHUNK message is forwarded to sidepanel', async () => {
    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    handler(
      { type: 'TRANSCRIPT_CHUNK', text: 'test transcript', timestamp: 1000 },
      {},
      sendResponse
    );

    await new Promise(resolve => setTimeout(resolve, 50));
    // sendMessage is called to forward to sidepanel
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TRANSCRIPT_CHUNK', text: 'test transcript' })
    );
  });

  test('SETTINGS_UPDATE saves to storage and broadcasts', async () => {
    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    const newSettings = { ui: { floatingSubtitles: false } };
    handler({ type: 'SETTINGS_UPDATE', settings: newSettings }, {}, sendResponse);

    await new Promise(resolve => setTimeout(resolve, 50));
    // Should broadcast to content scripts
    expect(chrome.tabs.query).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ received: true });
  });

  test('CAPTURE_STATUS reads from storage and replies', async () => {
    chrome.storage.session.get.mockResolvedValue({
      captureActive: true,
      sessionId: 'sess-123'
    });

    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    const returnValue = handler({ type: 'CAPTURE_STATUS' }, {}, sendResponse);
    expect(returnValue).toBe(true); // async

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sendResponse).toHaveBeenCalledWith({
      captureActive: true,
      sessionId: 'sess-123'
    });
  });

  test('unknown message type is silently ignored', async () => {
    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    // Should not throw
    expect(() => {
      handler({ type: 'UNKNOWN_MESSAGE_TYPE' }, {}, sendResponse);
    }).not.toThrow();
  });

  test('onInstalled listener is registered', async () => {
    await import('../../src/background/service-worker.js');
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
  });

  test('TRANSCRIPT_CHUNK also notifies content scripts via tabs.sendMessage', async () => {
    const mockTabs = [{ id: 1 }, { id: 2 }];
    chrome.tabs.query.mockResolvedValue(mockTabs);

    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    handler(
      { type: 'TRANSCRIPT_CHUNK', text: 'subtitle text', timestamp: 5000 },
      {},
      sendResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    // Should call tabs.sendMessage for content scripts
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ type: 'SHOW_SUBTITLE' })
    );
  });

  test('HISTORY_REQUEST responds with received:true', async () => {
    await import('../../src/background/service-worker.js');
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();

    handler({ type: 'HISTORY_REQUEST' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ received: true });
  });
});
