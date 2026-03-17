import {
  exportAsTxt,
  exportAsMd,
  exportAsSrt,
  formatSRTTimestamp,
  formatTime,
  wrapText,
  sanitizeFilename,
  downloadFile,
  exportSession
} from '../../src/utils/export.js';

const sampleSegments = [
  { timestamp: 0, text: 'Hello world', source: 'asr' },
  { timestamp: 5, text: 'This is a test', source: 'asr' },
  { timestamp: 10.5, text: 'Third segment here', source: 'ocr' }
];

describe('export.js', () => {
  describe('formatSRTTimestamp()', () => {
    test('formats 0 seconds correctly', () => {
      expect(formatSRTTimestamp(0)).toBe('00:00:00,000');
    });

    test('formats seconds with milliseconds', () => {
      expect(formatSRTTimestamp(1.5)).toBe('00:00:01,500');
    });

    test('formats minutes correctly', () => {
      expect(formatSRTTimestamp(90)).toBe('00:01:30,000');
    });

    test('formats hours correctly', () => {
      expect(formatSRTTimestamp(3661)).toBe('01:01:01,000');
    });

    test('handles hours rollover at 3600', () => {
      expect(formatSRTTimestamp(7200)).toBe('02:00:00,000');
    });
  });

  describe('exportAsTxt()', () => {
    test('joins segments with newlines', () => {
      const result = exportAsTxt(sampleSegments);
      expect(result).toBe('Hello world\nThis is a test\nThird segment here');
    });

    test('returns empty string for empty segments', () => {
      expect(exportAsTxt([])).toBe('');
      expect(exportAsTxt(null)).toBe('');
    });
  });

  describe('exportAsMd()', () => {
    test('adds title heading', () => {
      const result = exportAsMd(sampleSegments, 'My Podcast');
      expect(result).toContain('# My Podcast');
    });

    test('adds timestamp headings for each segment', () => {
      const result = exportAsMd(sampleSegments);
      expect(result).toContain('## [0:00]');
      expect(result).toContain('## [0:05]');
    });

    test('includes segment text', () => {
      const result = exportAsMd(sampleSegments);
      expect(result).toContain('Hello world');
      expect(result).toContain('This is a test');
    });

    test('returns empty string for no segments', () => {
      expect(exportAsMd([])).toBe('');
    });
  });

  describe('wrapText()', () => {
    test('wraps long text at 42 chars by default', () => {
      const longText = 'This is a very long subtitle text that should be wrapped into multiple lines here';
      const result = wrapText(longText, 42);
      const lines = result.split('\n');
      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(42);
      });
    });

    test('does not wrap short text', () => {
      const shortText = 'Short text';
      expect(wrapText(shortText)).toBe('Short text');
    });
  });

  describe('exportAsSrt()', () => {
    test('produces correct sequence numbers starting at 1', () => {
      const result = exportAsSrt(sampleSegments);
      expect(result).toMatch(/^1\n/);
      expect(result).toContain('\n2\n');
      expect(result).toContain('\n3\n');
    });

    test('uses correct SRT timestamp format', () => {
      const result = exportAsSrt(sampleSegments);
      // Check first segment timestamp
      expect(result).toContain('00:00:00,000 --> 00:00:05,000');
    });

    test('returns empty string for empty segments', () => {
      expect(exportAsSrt([])).toBe('');
    });

    test('includes segment text in output', () => {
      const result = exportAsSrt(sampleSegments);
      expect(result).toContain('Hello world');
      expect(result).toContain('This is a test');
    });

    test('separates entries with blank lines', () => {
      const result = exportAsSrt(sampleSegments);
      expect(result).toContain('\n\n');
    });
  });

  describe('sanitizeFilename()', () => {
    test('replaces special characters with underscores', () => {
      const dirty = 'My Podcast: Episode 1/2 <Special>';
      const clean = sanitizeFilename(dirty);
      expect(clean).not.toMatch(/[<>:"/\\|?*]/);
    });

    test('preserves normal characters', () => {
      expect(sanitizeFilename('Normal Podcast Name')).toBe('Normal Podcast Name');
    });

    test('returns "transcript" for empty string', () => {
      expect(sanitizeFilename('')).toBe('transcript');
    });
  });

  describe('downloadFile()', () => {
    test('creates Blob with correct MIME type', () => {
      const blob = downloadFile('content', 'test.txt', 'text/plain');
      expect(blob.type).toBe('text/plain');
    });

    test('triggers URL.createObjectURL', () => {
      downloadFile('content', 'test.txt', 'text/plain');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('calls URL.revokeObjectURL after download', () => {
      downloadFile('content', 'test.txt', 'text/plain');
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportSession()', () => {
    test('exports as txt format correctly', () => {
      const session = { title: 'Test', segments: sampleSegments };
      const blob = exportSession(session, 'txt');
      expect(blob.type).toBe('text/plain');
    });

    test('exports as md format correctly', () => {
      const session = { title: 'Test', segments: sampleSegments };
      const blob = exportSession(session, 'md');
      expect(blob.type).toBe('text/markdown');
    });

    test('exports as srt format correctly', () => {
      const session = { title: 'Test', segments: sampleSegments };
      const blob = exportSession(session, 'srt');
      expect(blob.type).toBe('text/srt');
    });
  });
});
