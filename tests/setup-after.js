// Reset mocks before each test (runs after jest globals are available)
beforeEach(() => {
  jest.clearAllMocks();

  // Re-set default implementations
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set.mockResolvedValue(undefined);
  chrome.offscreen.hasDocument.mockResolvedValue(false);
  chrome.offscreen.createDocument.mockResolvedValue(undefined);
  chrome.offscreen.closeDocument.mockResolvedValue(undefined);
  chrome.runtime.sendMessage.mockResolvedValue({});
  chrome.tabs.query.mockResolvedValue([]);
  global.fetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ text: '' }),
    text: jest.fn().mockResolvedValue('')
  });
});
