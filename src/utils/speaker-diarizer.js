/**
 * Speaker Diarizer
 * Assigns Speaker A/B/C labels to transcript segments.
 * Handles Deepgram numeric IDs and parsed name patterns from subtitle text.
 */

/**
 * Map numeric speaker ID to label letter
 * 0 -> 'A', 1 -> 'B', 2 -> 'C', etc.
 * @param {number|string} speakerId
 * @returns {string}
 */
function speakerIdToLabel(speakerId) {
  const id = typeof speakerId === 'string' ? parseInt(speakerId, 10) : speakerId;
  if (isNaN(id) || id < 0) return 'Speaker A';
  const letter = String.fromCharCode(65 + (id % 26));
  return `Speaker ${letter}`;
}

/**
 * Parse Deepgram diarized response into segments with speaker labels
 * @param {Object} deepgramResponse - Full Deepgram API response object
 * @returns {Array<{timestamp: number, endTime: number, text: string, speakerLabel: string, source: string}>}
 */
export function parseDeepgramDiarized(deepgramResponse) {
  const words = deepgramResponse?.results?.channels?.[0]?.alternatives?.[0]?.words;
  if (!words || words.length === 0) return [];

  const segments = [];
  let currentSpeaker = null;
  let currentWords = [];
  let segmentStart = null;
  let segmentEnd = null;

  for (const word of words) {
    const speakerId = word.speaker !== undefined ? word.speaker : null;

    if (speakerId !== currentSpeaker) {
      // Save previous segment
      if (currentWords.length > 0) {
        segments.push({
          timestamp: Math.round(segmentStart * 1000),
          endTime: Math.round(segmentEnd * 1000),
          text: currentWords.join(' '),
          speakerLabel: speakerIdToLabel(currentSpeaker),
          source: 'asr'
        });
      }
      // Start new segment
      currentSpeaker = speakerId;
      currentWords = [word.punctuated_word || word.word || ''];
      segmentStart = word.start;
      segmentEnd = word.end;
    } else {
      currentWords.push(word.punctuated_word || word.word || '');
      segmentEnd = word.end;
    }
  }

  // Push last segment
  if (currentWords.length > 0) {
    segments.push({
      timestamp: Math.round(segmentStart * 1000),
      endTime: Math.round(segmentEnd * 1000),
      text: currentWords.join(' '),
      speakerLabel: speakerIdToLabel(currentSpeaker),
      source: 'asr'
    });
  }

  return segments;
}

/**
 * Assign speaker labels to an array of segments.
 * If segments already have speakerLabel set, those are preserved.
 * If speakerLabel is a numeric string like "0", "1", it's converted to "Speaker A", "Speaker B".
 * If no speakerLabel, tries to parse from segment text using parseSpeakerPrefix patterns.
 * @param {Array<Object>} segments - Array of segment objects
 * @returns {Array<Object>} Segments with speakerLabel set
 */
export function assignSpeakerLabels(segments) {
  if (!segments || segments.length === 0) return [];

  return segments.map(seg => {
    const s = { ...seg };

    // If already has a numeric speaker ID, convert to label
    if (s.speakerLabel !== null && s.speakerLabel !== undefined) {
      const label = String(s.speakerLabel).trim();
      // Numeric ID like "0", "1", "2"
      if (/^\d+$/.test(label)) {
        s.speakerLabel = speakerIdToLabel(parseInt(label, 10));
      } else {
        // Keep as-is (already a human-readable name)
        s.speakerLabel = label;
      }
      return s;
    }

    // Try to extract speaker from text
    const parsed = parseSpeakerFromText(s.text || '');
    if (parsed.speakerLabel) {
      s.speakerLabel = parsed.speakerLabel;
      // Optionally strip the prefix from text
      s.text = parsed.text;
    } else {
      s.speakerLabel = null;
    }

    return s;
  });
}

/**
 * Parse speaker label from text using common patterns
 * @param {string} text
 * @returns {{ speakerLabel: string|null, text: string }}
 */
function parseSpeakerFromText(text) {
  if (!text) return { speakerLabel: null, text: '' };

  // ">> SPEAKER_NAME: text"
  const arrowMatch = text.match(/^>>\s*([A-Za-z][A-Za-z0-9 _'-]{0,30}):\s*(.*)/s);
  if (arrowMatch) {
    return { speakerLabel: arrowMatch[1].trim(), text: arrowMatch[2] };
  }

  // "SPEAKER_NAME: text" (ALL_CAPS speaker)
  const capsMatch = text.match(/^([A-Z][A-Z0-9 _'-]{1,29}):\s*(.*)/s);
  if (capsMatch) {
    return { speakerLabel: capsMatch[1].trim(), text: capsMatch[2] };
  }

  // "[Speaker Name] text"
  const bracketMatch = text.match(/^\[([^\]]{1,30})\]\s*(.*)/s);
  if (bracketMatch) {
    const candidate = bracketMatch[1].trim();
    if (/^[A-Z][a-z]/.test(candidate) || /^Speaker/i.test(candidate)) {
      return { speakerLabel: candidate, text: bracketMatch[2] };
    }
  }

  return { speakerLabel: null, text };
}

/**
 * Group consecutive segments by same speaker
 * Useful for merging short consecutive same-speaker segments
 * @param {Array<Object>} segments
 * @returns {Array<Object>}
 */
export function mergeConsecutiveSpeakerSegments(segments) {
  if (!segments || segments.length === 0) return [];

  const merged = [];
  let current = null;

  for (const seg of segments) {
    if (current === null) {
      current = { ...seg };
    } else if (current.speakerLabel === seg.speakerLabel) {
      // Merge into current
      current.text = current.text + ' ' + seg.text;
      current.endTime = seg.endTime;
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }

  if (current) merged.push(current);
  return merged;
}
