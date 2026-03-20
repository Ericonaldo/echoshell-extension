/**
 * Forum integration client for EchoShell.
 * Communicates with the EchoShell podcast transcript forum API.
 */

import { fullPolishText } from './llm-client.js';

function msToTimestamp(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function extractSourceName(url) {
  if (!url) return 'Unknown Podcast';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'YouTube';
    if (u.hostname.includes('bilibili.com')) return 'Bilibili';
    if (u.hostname.includes('ted.com')) return 'TED';
    if (u.hostname.includes('coursera.org')) return 'Coursera';
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown Podcast';
  }
}

/**
 * Check if a transcript already exists in the forum for the given URL.
 * @param {string} tabUrl - The current tab URL to check
 * @param {string} forumUrl - The forum base URL
 * @returns {Promise<{found: boolean, episodeId?: number, podcastId?: number, episodeTitle?: string, podcastName?: string}|null>}
 */
export async function checkForumTranscript(tabUrl, forumUrl) {
  if (!forumUrl || !tabUrl) return null;
  try {
    const encoded = encodeURIComponent(tabUrl);
    const resp = await fetch(`${forumUrl}/api/check?url=${encoded}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Upload a completed session (segments) to the forum anonymously.
 * If LLM config is provided, post-processes transcript with punctuation + speaker diarization.
 * @param {Object} session - { id, title, url, createdAt, segments: [{ timestamp, text, source }] }
 * @param {string} forumUrl - The forum base URL
 * @param {string} [language] - Transcript language code
 * @param {Object} [llmConfig] - LLM configuration for post-processing { enabled, provider, apiKey, endpoint, model }
 * @returns {Promise<{success: boolean, episodeId?: number, podcastId?: number}|null>}
 */
export async function uploadToForum(session, forumUrl, language = 'zh', llmConfig = null, onProgress = null) {
  if (!forumUrl || !session || !session.segments || session.segments.length === 0) return null;

  try {
    // Build plain-text transcript with timestamps
    let content = session.segments
      .map(seg => {
        const ts = msToTimestamp(seg.timestamp);
        const speaker = seg.speakerLabel ? `**[${seg.speakerLabel}]** ` : '';
        return `[${ts}] ${speaker}${seg.text}`;
      })
      .join('\n');

    // LLM post-processing: add punctuation + speaker diarization
    if (llmConfig && llmConfig.enabled && llmConfig.apiKey) {
      try {
        content = await fullPolishText(content, llmConfig, onProgress);
      } catch (e) {
        console.warn('[EchoShell] LLM polish failed, uploading raw transcript:', e.message);
      }
    }

    const podcastName = extractSourceName(session.url);
    const publishedDate = session.createdAt
      ? new Date(session.createdAt).toISOString().split('T')[0]
      : null;

    const body = {
      podcast: {
        name: podcastName,
        category: 'Podcast',
        language
      },
      episode: {
        title: session.title || 'Untitled Episode',
        episode_url: session.url || null,
        published_date: publishedDate
      },
      transcript: {
        content,
        format: 'plain',
        language,
        source: 'asr'
      }
    };

    const resp = await fetch(`${forumUrl}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Build the forum episode URL from base URL and episodeId.
 * @param {string} forumUrl
 * @param {number} episodeId
 * @returns {string}
 */
export function buildForumEpisodeUrl(forumUrl, episodeId) {
  return `${forumUrl}/episode/${episodeId}`;
}
