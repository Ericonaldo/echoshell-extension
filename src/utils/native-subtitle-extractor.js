/**
 * Native Subtitle Extractor
 * Detects and fetches native subtitles from YouTube, Bilibili, TED, Coursera, and HTML5 <track> elements.
 * Detection runs via chrome.scripting.executeScript (MAIN world), fetching in SW.
 */

/**
 * Parse WebVTT subtitle text into segments
 * @param {string} vttText - Raw WebVTT text
 * @param {string} [lang='und'] - Language code
 * @returns {Array<{timestamp: number, endTime: number, text: string, lang: string, speakerLabel: string|null}>}
 */
export function parseWebVTT(vttText, lang = 'und') {
  const segments = [];
  if (!vttText) return segments;

  // Split into cue blocks (separated by blank lines)
  const blocks = vttText.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;

    // Skip WEBVTT header line
    if (lines[0].startsWith('WEBVTT')) continue;
    // Skip NOTE blocks
    if (lines[0].startsWith('NOTE')) continue;
    // Skip STYLE blocks
    if (lines[0].startsWith('STYLE')) continue;

    // Find the timing line (contains -->)
    let timingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timingIdx = i;
        break;
      }
    }
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx];
    const timingMatch = timingLine.match(/(\d{1,2}:[\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!timingMatch) continue;

    const startSec = parseVTTTime(timingMatch[1]);
    const endSec = parseVTTTime(timingMatch[2]);

    // Gather text lines after timing
    const textLines = lines.slice(timingIdx + 1);
    if (textLines.length === 0) continue;

    // Join text and strip HTML tags
    const rawText = textLines.join(' ');
    const cleanText = stripVTTTags(rawText);
    if (!cleanText.trim()) continue;

    // Extract speaker label if present
    const { speakerLabel, text } = parseSpeakerPrefix(cleanText);

    segments.push({
      timestamp: Math.round(startSec * 1000),
      endTime: Math.round(endSec * 1000),
      text: text.trim(),
      lang,
      speakerLabel: speakerLabel || null,
      source: 'native'
    });
  }

  return segments;
}

/**
 * Parse VTT timestamp string to seconds
 * Supports HH:MM:SS.mmm and MM:SS.mmm and SS.mmm formats
 * @param {string} timeStr
 * @returns {number}
 */
export function parseVTTTime(timeStr) {
  const parts = timeStr.trim().split(':');
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds = parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  } else {
    seconds = parseFloat(parts[0]);
  }
  return isNaN(seconds) ? 0 : seconds;
}

/**
 * Strip VTT/HTML tags from text
 * @param {string} text
 * @returns {string}
 */
export function stripVTTTags(text) {
  // Remove VTT cue tags like <c>, <b>, <i>, <u>, <ruby>, <rt>, <v>, <lang>, timestamps
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Parse speaker prefix from subtitle text
 * Handles patterns like "JOHN:", ">> Mary:", "[Speaker A]", "(HOST)"
 * @param {string} text
 * @returns {{ speakerLabel: string|null, text: string }}
 */
export function parseSpeakerPrefix(text) {
  if (!text) return { speakerLabel: null, text: text || '' };

  // Pattern: ">> SPEAKER_NAME: text" or ">> SPEAKER:"
  const arrowMatch = text.match(/^>>\s*([A-Za-z][A-Za-z0-9 _'-]{0,30}):\s*(.*)/s);
  if (arrowMatch) {
    return { speakerLabel: arrowMatch[1].trim(), text: arrowMatch[2] };
  }

  // Pattern: "SPEAKER_NAME: text" where speaker is ALL_CAPS (at least 2 chars)
  const capsMatch = text.match(/^([A-Z][A-Z0-9 _'-]{1,29}):\s*(.*)/s);
  if (capsMatch) {
    return { speakerLabel: capsMatch[1].trim(), text: capsMatch[2] };
  }

  // Pattern: "[Speaker Name]" at start
  const bracketMatch = text.match(/^\[([^\]]{1,30})\]\s*(.*)/s);
  if (bracketMatch) {
    const candidate = bracketMatch[1].trim();
    // Only treat as speaker if it looks like a name (not a description like "[MUSIC]")
    if (/^[A-Z][a-z]/.test(candidate) || /^Speaker/i.test(candidate)) {
      return { speakerLabel: candidate, text: bracketMatch[2] };
    }
  }

  // Pattern: "(Speaker Name):" at start
  const parenMatch = text.match(/^\(([^)]{1,30})\):\s*(.*)/s);
  if (parenMatch) {
    return { speakerLabel: parenMatch[1].trim(), text: parenMatch[2] };
  }

  return { speakerLabel: null, text };
}

/**
 * Strip speaker prefix from text (returns just the text portion)
 * @param {string} text
 * @returns {string}
 */
export function stripSpeakerPrefix(text) {
  return parseSpeakerPrefix(text).text;
}

/**
 * Convert a track element descriptor to segments array
 * @param {Object} track - Track descriptor with label, lang, src (or content)
 * @param {string} content - VTT content string
 * @returns {Array} segments
 */
export function trackToSegments(track, content) {
  return parseWebVTT(content, track.lang || 'und');
}

/**
 * Self-contained function to run in MAIN world via chrome.scripting.executeScript
 * Detects native subtitles on YouTube, Bilibili, and HTML5 pages
 * IMPORTANT: This function has NO imports and NO closures over module-scope variables.
 */
export function detectInMainWorld() {
  const host = window.location.hostname;

  // YouTube
  if (host.includes('youtube.com')) {
    const tracks = window.ytInitialPlayerResponse
      ?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (tracks?.length) {
      return {
        method: 'youtube',
        site: 'YouTube',
        data: tracks.map(t => ({
          label: t.name?.simpleText || t.languageCode,
          lang: t.languageCode,
          url: t.baseUrl,
          isAuto: t.kind === 'asr',
        })),
      };
    }
  }

  // Bilibili
  if (host.includes('bilibili.com')) {
    const state = window.__INITIAL_STATE__;
    const aid = state?.aid || state?.videoData?.aid;
    const cid = state?.videoData?.cid || state?.epInfo?.cid || state?.cid;
    if (aid && cid) return { method: 'bilibili', site: 'Bilibili', data: { aid, cid } };
  }

  // HTML5 tracks
  const trackEls = Array.from(document.querySelectorAll(
    'video track[kind="subtitles"], video track[kind="captions"]'
  ));
  if (trackEls.length) {
    const SITES = {
      'www.ted.com': 'TED',
      'www.coursera.org': 'Coursera',
      'open.spotify.com': 'Spotify',
      'podcasts.apple.com': 'Apple Podcasts',
      'www.stitcher.com': 'Stitcher',
      'www.buzzsprout.com': 'Buzzsprout',
      'www.podbean.com': 'Podbean',
      'pca.st': 'Pocket Casts',
      'www.overcast.fm': 'Overcast',
    };
    return {
      method: 'html5',
      site: SITES[host] || host,
      data: trackEls
        .map(el => ({
          label: el.label || el.srclang || 'Subtitles',
          lang: el.srclang || 'und',
          src: el.src
        }))
        .filter(t => t.src),
    };
  }

  return null;
}

/**
 * Fetch subtitle content for a given track descriptor
 * Should run in Service Worker context
 * @param {Object} trackInfo - Result from detectInMainWorld
 * @param {number} [trackIndex=0] - Index of track to fetch (for youtube/html5)
 * @returns {Promise<{tracks: Array, segments: Array}>}
 */
export async function fetchSubtitleContent(trackInfo, trackIndex = 0) {
  if (!trackInfo) return { tracks: [], segments: [] };

  const { method, data } = trackInfo;

  if (method === 'youtube') {
    const tracks = data;
    const track = tracks[trackIndex] || tracks[0];
    if (!track?.url) return { tracks, segments: [] };

    const content = await fetchText(track.url);
    const segments = parseWebVTT(content, track.lang);
    return { tracks, segments };
  }

  if (method === 'html5') {
    const tracks = data;
    const track = tracks[trackIndex] || tracks[0];
    if (!track?.src) return { tracks, segments: [] };

    const content = await fetchText(track.src);
    const segments = parseWebVTT(content, track.lang);
    return { tracks, segments };
  }

  if (method === 'bilibili') {
    // Bilibili subtitle API requires additional auth tokens, return empty
    // but expose track descriptor with aid/cid for future use
    return {
      tracks: [{ label: 'Bilibili', lang: 'zh-CN', bilibili: true }],
      segments: []
    };
  }

  return { tracks: [], segments: [] };
}

/**
 * Fetch plain text from a URL
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch subtitle: ${response.status}`);
  }
  return response.text();
}
