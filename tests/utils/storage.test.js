import {
  getSettings,
  setSettings,
  getSetting,
  getHistory,
  saveSession,
  saveSegment,
  clearHistory,
  deleteSession,
  generateId
} from '../../src/utils/storage.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../src/utils/constants.js';

describe('storage.js', () => {
  describe('getSettings()', () => {
    test('returns default values when storage is empty', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      const settings = await getSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    test('merges stored values with defaults', async () => {
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.SETTINGS]: {
          asr: { provider: 'deepgram', apiKey: 'test-key' }
        }
      });
      const settings = await getSettings();
      expect(settings.asr.provider).toBe('deepgram');
      expect(settings.asr.apiKey).toBe('test-key');
      // Default values for untouched fields should be preserved
      expect(settings.asr.model).toBe(DEFAULT_SETTINGS.asr.model);
      expect(settings.ocr).toMatchObject(DEFAULT_SETTINGS.ocr);
    });

    test('throws error with context on storage failure', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('quota exceeded'));
      await expect(getSettings()).rejects.toThrow('Storage read error');
    });
  });

  describe('setSettings()', () => {
    test('calls chrome.storage.local.set with correct key', async () => {
      const settings = { ...DEFAULT_SETTINGS };
      await setSettings(settings);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.SETTINGS]: settings
      });
    });

    test('throws on storage write failure', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('disk full'));
      await expect(setSettings({})).rejects.toThrow('Storage write error');
    });
  });

  describe('getSetting()', () => {
    test('resolves nested dot-path settings', async () => {
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.SETTINGS]: { asr: { apiKey: 'my-key' } }
      });
      const key = await getSetting('asr.apiKey');
      expect(key).toBe('my-key');
    });

    test('returns undefined for missing nested path', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      const val = await getSetting('nonexistent.path');
      expect(val).toBeUndefined();
    });
  });

  describe('getHistory()', () => {
    test('returns empty array when no history exists', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      const history = await getHistory();
      expect(history).toEqual([]);
    });

    test('returns paginated results', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i}`, title: `Session ${i}`, segments: []
      }));
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.HISTORY]: sessions
      });
      const page = await getHistory(3, 2);
      expect(page).toHaveLength(3);
      expect(page[0].id).toBe('session-2');
    });
  });

  describe('saveSession()', () => {
    test('prepends session to history (newest first)', async () => {
      const existingHistory = [{ id: 'old', title: 'Old', segments: [] }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.HISTORY]: existingHistory
      });
      const newSession = { id: 'new', title: 'New', segments: [] };
      await saveSession(newSession);

      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall[STORAGE_KEYS.HISTORY][0].id).toBe('new');
      expect(setCall[STORAGE_KEYS.HISTORY][1].id).toBe('old');
    });

    test('trims history to 100 most recent sessions', async () => {
      const existing = Array.from({ length: 100 }, (_, i) => ({
        id: `s-${i}`, title: `S${i}`, segments: []
      }));
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.HISTORY]: existing
      });
      await saveSession({ id: 'newest', title: 'Newest', segments: [] });

      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall[STORAGE_KEYS.HISTORY]).toHaveLength(100);
      expect(setCall[STORAGE_KEYS.HISTORY][0].id).toBe('newest');
    });
  });

  describe('saveSegment()', () => {
    test('appends segment to matching session', async () => {
      const history = [{ id: 'sess-1', title: 'T', segments: [] }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.HISTORY]: history
      });
      await saveSegment('sess-1', { text: 'hello', timestamp: 1000 });

      const setCall = chrome.storage.local.set.mock.calls[0][0];
      const session = setCall[STORAGE_KEYS.HISTORY].find(s => s.id === 'sess-1');
      expect(session.segments).toHaveLength(1);
      expect(session.segments[0].text).toBe('hello');
    });
  });

  describe('clearHistory()', () => {
    test('sets history to empty array', async () => {
      await clearHistory();
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.HISTORY]: []
      });
    });
  });

  describe('deleteSession()', () => {
    test('removes session with matching ID', async () => {
      const history = [
        { id: 'keep', title: 'Keep', segments: [] },
        { id: 'delete', title: 'Delete', segments: [] }
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.HISTORY]: history
      });
      await deleteSession('delete');

      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall[STORAGE_KEYS.HISTORY]).toHaveLength(1);
      expect(setCall[STORAGE_KEYS.HISTORY][0].id).toBe('keep');
    });
  });

  describe('generateId()', () => {
    test('returns a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    test('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, generateId));
      expect(ids.size).toBe(100);
    });
  });
});
