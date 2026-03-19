import { MSG, STORAGE_KEYS, DEFAULT_SETTINGS } from '../utils/constants.js';
import { getSettings, saveSession, generateId } from '../utils/storage.js';
import { detectInMainWorld, fetchSubtitleContent } from '../utils/native-subtitle-extractor.js';

// Track if capture is in progress (using storage.session for persistence across SW restarts)
let creatingOffscreen = false;

/**
 * Ensure the offscreen document exists
 */
async function ensureOffscreen() {
  const hasDoc = await chrome.offscreen.hasDocument();
  if (hasDoc) return;

  if (creatingOffscreen) return;
  creatingOffscreen = true;

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Audio capture and processing for transcription'
    });
  } finally {
    creatingOffscreen = false;
  }
}

/**
 * Close offscreen document if it exists
 */
async function closeOffscreen() {
  const hasDoc = await chrome.offscreen.hasDocument();
  if (hasDoc) {
    await chrome.offscreen.closeDocument();
  }
}

/**
 * Send a message to the side panel
 */
async function sendToSidePanel(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch (_) {
    // Side panel may not be open; that's OK
  }
}

/**
 * Send a message to all content scripts
 */
async function broadcastToContentScripts(message) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (_) {
      // Tab may not have content script; ignore
    }
  }
}

// Store active session ID in memory (re-read from storage on SW restart)
let activeSessionId = null;

/**
 * Handle START_CAPTURE message
 */
async function handleStartCapture(request, sender) {
  try {
    const settings = await getSettings();

    // Create a new session
    activeSessionId = generateId();
    const session = {
      id: activeSessionId,
      url: request.url || '',
      title: request.title || 'Untitled',
      createdAt: Date.now(),
      segments: []
    };
    await saveSession(session);

    await ensureOffscreen();

    // Get tab stream ID for audio capture
    if (settings.captureMode === 'audio' || settings.captureMode === 'both') {
      const tabId = request.tabId || sender?.tab?.id;
      if (tabId) {
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        await chrome.runtime.sendMessage({
          type: MSG.START_AUDIO,
          streamId,
          sessionId: activeSessionId,
          settings: settings.asr
        });
      }
    }

    // Store session state
    await chrome.storage.session.set({
      captureActive: true,
      sessionId: activeSessionId,
      captureMode: settings.captureMode
    });

    return { success: true, sessionId: activeSessionId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Handle STOP_CAPTURE message
 */
async function handleStopCapture() {
  try {
    await chrome.runtime.sendMessage({ type: MSG.STOP_AUDIO });
    await closeOffscreen();
    await chrome.storage.session.set({ captureActive: false });
    activeSessionId = null;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Handle DETECT_NATIVE_SUBTITLES message
 * Uses chrome.scripting.executeScript with MAIN world to detect subtitles,
 * then fetches subtitle content in the service worker.
 */
async function handleDetectNativeSubtitles(request, sender) {
  try {
    const tabId = request.tabId;
    if (!tabId) {
      return { success: false, error: 'No tabId provided', found: false };
    }

    // Inject detectInMainWorld function into MAIN world
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: detectInMainWorld
    });

    const trackInfo = results?.[0]?.result;
    if (!trackInfo) {
      return { success: true, found: false, site: null, tracks: [] };
    }

    // Fetch subtitle content (first track by default)
    const trackIndex = request.trackIndex || 0;
    const { tracks, segments } = await fetchSubtitleContent(trackInfo, trackIndex);

    return {
      success: true,
      found: true,
      site: trackInfo.site,
      method: trackInfo.method,
      tracks,
      segments
    };
  } catch (err) {
    return { success: false, error: err.message, found: false };
  }
}

/**
 * Main message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message;

  switch (type) {
    case MSG.START_CAPTURE:
      handleStartCapture(message, sender).then(sendResponse);
      return true; // async response

    case MSG.STOP_CAPTURE:
      handleStopCapture().then(sendResponse);
      // Notify content scripts
      broadcastToContentScripts({ type: MSG.HIDE_SUBTITLE });
      return true;

    case MSG.TRANSCRIPT_CHUNK:
      // Forward to side panel and content scripts for floating subtitles
      sendToSidePanel(message);
      if (message.text) {
        broadcastToContentScripts({
          type: MSG.SHOW_SUBTITLE,
          text: message.text,
          source: message.source || 'asr'
        });
      }
      sendResponse({ received: true });
      return false;

    case MSG.OCR_CHUNK:
      // Forward to side panel and content scripts
      sendToSidePanel(message);
      if (message.text) {
        broadcastToContentScripts({
          type: MSG.SHOW_SUBTITLE,
          text: message.text,
          source: 'ocr'
        });
      }
      sendResponse({ received: true });
      return false;

    case MSG.SETTINGS_UPDATE:
      // Broadcast settings change to all components
      broadcastToContentScripts({ type: MSG.SETTINGS_UPDATE, settings: message.settings });
      sendResponse({ received: true });
      return false;

    case MSG.HISTORY_REQUEST:
      // Handled by storage directly in sidepanel; this is a pass-through
      sendResponse({ received: true });
      return false;

    case MSG.CAPTURE_STATUS:
      chrome.storage.session.get(['captureActive', 'sessionId']).then(data => {
        sendResponse(data);
      });
      return true;

    case MSG.DETECT_NATIVE_SUBTITLES:
      handleDetectNativeSubtitles(message, sender).then(sendResponse);
      return true;

    default:
      // Unknown message type - silently ignore
      return false;
  }
});

/**
 * On install: set default settings
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
  }
});

/**
 * Enable side panel on click
 */
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});
