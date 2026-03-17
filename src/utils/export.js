/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
export function formatSRTTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds to readable time: [HH:]MM:SS
 */
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Export segments as plain text
 */
export function exportAsTxt(segments) {
  if (!segments || segments.length === 0) return '';
  return segments.map(seg => seg.text).join('\n');
}

/**
 * Export segments as Markdown with timestamps
 */
export function exportAsMd(segments, title = 'Transcript') {
  if (!segments || segments.length === 0) return '';
  const lines = [`# ${title}`, ''];
  for (const seg of segments) {
    const time = formatTime(seg.timestamp || 0);
    lines.push(`## [${time}]`);
    lines.push(seg.text);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Wrap text at specified character width
 */
export function wrapText(text, maxWidth = 42) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 <= maxWidth) {
      current = current ? `${current} ${word}` : word;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

/**
 * Export segments as SRT subtitle file
 */
export function exportAsSrt(segments) {
  if (!segments || segments.length === 0) return '';

  const entries = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startTime = seg.timestamp || 0;
    // End time is next segment start, or start + 5s
    const endTime = (segments[i + 1]?.timestamp) || (startTime + 5);

    const startTs = formatSRTTimestamp(startTime);
    const endTs = formatSRTTimestamp(endTime);
    const wrappedText = wrapText(seg.text, 42);

    entries.push(`${i + 1}\n${startTs} --> ${endTs}\n${wrappedText}`);
  }

  return entries.join('\n\n') + '\n';
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'transcript';
}

/**
 * Create and trigger a browser download
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return blob;
}

/**
 * Export a session in the specified format
 * @param {Object} session - Session with title and segments
 * @param {'txt'|'md'|'srt'} format - Export format
 */
export function exportSession(session, format = 'txt') {
  const title = session.title || 'Transcript';
  const segments = session.segments || [];
  const safeName = sanitizeFilename(title);

  let content;
  let mimeType;
  let ext;

  switch (format) {
    case 'md':
      content = exportAsMd(segments, title);
      mimeType = 'text/markdown';
      ext = 'md';
      break;
    case 'srt':
      content = exportAsSrt(segments);
      mimeType = 'text/srt';
      ext = 'srt';
      break;
    case 'txt':
    default:
      content = exportAsTxt(segments);
      mimeType = 'text/plain';
      ext = 'txt';
  }

  return downloadFile(content, `${safeName}.${ext}`, mimeType);
}
