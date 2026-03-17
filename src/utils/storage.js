import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Get settings from storage, merged with defaults
 */
export async function getSettings() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = data[STORAGE_KEYS.SETTINGS] || {};
    return deepMerge(DEFAULT_SETTINGS, stored);
  } catch (err) {
    throw new Error(`Storage read error: ${err.message}`);
  }
}

/**
 * Save settings to storage
 */
export async function setSettings(settings) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  } catch (err) {
    throw new Error(`Storage write error: ${err.message}`);
  }
}

/**
 * Get a specific nested setting by dot-path (e.g., 'asr.apiKey')
 */
export async function getSetting(path) {
  const settings = await getSettings();
  const parts = path.split('.');
  let current = settings;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Get history from storage
 */
export async function getHistory(limit = 50, offset = 0) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = data[STORAGE_KEYS.HISTORY] || [];
    return history.slice(offset, offset + limit);
  } catch (err) {
    throw new Error(`Storage read error: ${err.message}`);
  }
}

/**
 * Save a new history session
 */
export async function saveSession(session) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = data[STORAGE_KEYS.HISTORY] || [];
    history.unshift(session); // newest first
    // Keep only last 100 sessions
    const trimmed = history.slice(0, 100);
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: trimmed });
  } catch (err) {
    throw new Error(`Storage write error: ${err.message}`);
  }
}

/**
 * Append a segment to the current active session in storage
 */
export async function saveSegment(sessionId, segment) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = data[STORAGE_KEYS.HISTORY] || [];
    const sessionIndex = history.findIndex(s => s.id === sessionId);
    if (sessionIndex >= 0) {
      history[sessionIndex].segments.push(segment);
      await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
    }
  } catch (err) {
    throw new Error(`Storage write error: ${err.message}`);
  }
}

/**
 * Clear all history
 */
export async function clearHistory() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
  } catch (err) {
    throw new Error(`Storage write error: ${err.message}`);
  }
}

/**
 * Delete a specific history session
 */
export async function deleteSession(sessionId) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = (data[STORAGE_KEYS.HISTORY] || []).filter(s => s.id !== sessionId);
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
  } catch (err) {
    throw new Error(`Storage write error: ${err.message}`);
  }
}

/**
 * Generate a simple unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
