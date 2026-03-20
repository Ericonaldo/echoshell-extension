import { MSG } from '../utils/constants.js';
import './content.css';

let subtitleOverlay = null;
let floatingEnabled = true;

/**
 * Detect video player element on the page
 */
function findVideoPlayer() {
  // YouTube
  const ytPlayer = document.querySelector('#movie_player video, ytd-player video');
  if (ytPlayer) return ytPlayer;

  // Bilibili
  const biliPlayer = document.querySelector('.bpx-player-video-wrap video');
  if (biliPlayer) return biliPlayer;

  // Generic HTML5 video
  const videos = document.querySelectorAll('video');
  if (videos.length > 0) {
    // Return the largest/most likely main video
    return Array.from(videos).sort((a, b) =>
      (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight)
    )[0];
  }

  return null;
}

/**
 * Create the floating subtitle overlay
 */
function createSubtitleOverlay() {
  if (subtitleOverlay) return subtitleOverlay;
  // Reuse existing DOM element in case of double-injection
  const existing = document.getElementById('echoshell-subtitle-overlay');
  if (existing) { subtitleOverlay = existing; return existing; }

  const overlay = document.createElement('div');
  overlay.id = 'echoshell-subtitle-overlay';
  overlay.className = 'echoshell-subtitle';
  overlay.setAttribute('data-echoshell', 'true');
  document.body.appendChild(overlay);
  subtitleOverlay = overlay;
  return overlay;
}

/**
 * Position the overlay — now uses CSS fixed positioning, no-op
 */
function positionOverlay() {
  // Overlay is position:fixed via CSS; no dynamic positioning needed
}

/**
 * Show subtitle text
 */
function showSubtitle(text, source) {
  if (!floatingEnabled) return;

  const overlay = createSubtitleOverlay();
  overlay.textContent = text;
  overlay.setAttribute('data-source', source === 'ocr' ? 'OCR' : 'ASR');
  overlay.classList.add('visible');
  positionOverlay();

  // Auto-hide after 8 seconds
  clearTimeout(overlay._hideTimer);
  overlay._hideTimer = setTimeout(() => {
    overlay.classList.remove('visible');
  }, 8000);
}

/**
 * Hide subtitle overlay
 */
function hideSubtitle() {
  if (subtitleOverlay) {
    subtitleOverlay.classList.remove('visible');
  }
}

/**
 * Remove subtitle overlay completely
 */
function removeSubtitleOverlay() {
  if (subtitleOverlay) {
    subtitleOverlay.remove();
    subtitleOverlay = null;
  }
}

// Handle window resize/scroll to reposition
window.addEventListener('resize', positionOverlay);
window.addEventListener('scroll', positionOverlay);

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MSG.SHOW_SUBTITLE:
      showSubtitle(message.text, message.source);
      sendResponse({ received: true });
      return false;

    case MSG.HIDE_SUBTITLE:
      hideSubtitle();
      sendResponse({ received: true });
      return false;

    case MSG.STOP_CAPTURE:
      removeSubtitleOverlay();
      sendResponse({ received: true });
      return false;

    case MSG.SETTINGS_UPDATE:
      if (message.settings?.ui) {
        floatingEnabled = message.settings.ui.floatingSubtitles !== false;
        if (!floatingEnabled) hideSubtitle();
      }
      sendResponse({ received: true });
      return false;

    default:
      return false;
  }
});
