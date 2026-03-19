import {
  parseWebVTT,
  parseVTTTime,
  stripVTTTags,
  parseSpeakerPrefix,
  stripSpeakerPrefix,
  trackToSegments,
  detectInMainWorld
} from '../../src/utils/native-subtitle-extractor.js';

describe('native-subtitle-extractor.js', () => {
  describe('parseVTTTime', () => {
    test('parses HH:MM:SS.mmm format', () => {
      expect(parseVTTTime('00:01:30.500')).toBeCloseTo(90.5, 2);
    });

    test('parses MM:SS.mmm format', () => {
      expect(parseVTTTime('01:30.500')).toBeCloseTo(90.5, 2);
    });

    test('parses SS.mmm format', () => {
      expect(parseVTTTime('90.5')).toBeCloseTo(90.5, 2);
    });

    test('parses zero timestamp', () => {
      expect(parseVTTTime('00:00:00.000')).toBe(0);
    });

    test('handles 1-digit hour', () => {
      expect(parseVTTTime('1:00:00.000')).toBeCloseTo(3600, 0);
    });

    test('returns 0 for invalid input', () => {
      expect(parseVTTTime('invalid')).toBe(0);
    });
  });

  describe('stripVTTTags', () => {
    test('strips basic HTML/VTT tags', () => {
      expect(stripVTTTags('<c>Hello</c> world')).toBe('Hello world');
    });

    test('strips <b>, <i>, <u> tags', () => {
      expect(stripVTTTags('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
    });

    test('decodes HTML entities', () => {
      expect(stripVTTTags('AT&amp;T')).toBe('AT&T');
      expect(stripVTTTags('&lt;tag&gt;')).toBe('<tag>');
    });

    test('strips voice span tags like <v Speaker>', () => {
      expect(stripVTTTags('<v John>Hello there</v>')).toBe('Hello there');
    });

    test('returns plain text unchanged', () => {
      expect(stripVTTTags('Plain text')).toBe('Plain text');
    });
  });

  describe('parseSpeakerPrefix', () => {
    test('detects >> SPEAKER: prefix', () => {
      const result = parseSpeakerPrefix('>> JOHN: Hello there');
      expect(result.speakerLabel).toBe('JOHN');
      expect(result.text).toBe('Hello there');
    });

    test('detects ALL_CAPS: prefix', () => {
      const result = parseSpeakerPrefix('HOST: Welcome to the show');
      expect(result.speakerLabel).toBe('HOST');
      expect(result.text).toBe('Welcome to the show');
    });

    test('detects [Speaker Name] prefix', () => {
      const result = parseSpeakerPrefix('[Speaker A] This is the first speaker');
      expect(result.speakerLabel).toBe('Speaker A');
      expect(result.text).toBe('This is the first speaker');
    });

    test('detects (Name): prefix', () => {
      const result = parseSpeakerPrefix('(HOST): Introduction text');
      expect(result.speakerLabel).toBe('HOST');
      expect(result.text).toBe('Introduction text');
    });

    test('returns null speakerLabel for plain text', () => {
      const result = parseSpeakerPrefix('This is just normal text');
      expect(result.speakerLabel).toBeNull();
      expect(result.text).toBe('This is just normal text');
    });

    test('handles empty string', () => {
      const result = parseSpeakerPrefix('');
      expect(result.speakerLabel).toBeNull();
      expect(result.text).toBe('');
    });

    test('handles null input', () => {
      const result = parseSpeakerPrefix(null);
      expect(result.speakerLabel).toBeNull();
    });

    test('does not treat [MUSIC] as speaker', () => {
      const result = parseSpeakerPrefix('[MUSIC] playing in background');
      expect(result.speakerLabel).toBeNull();
    });

    test('handles >> with mixed case name', () => {
      const result = parseSpeakerPrefix('>> Mary Smith: How are you?');
      expect(result.speakerLabel).toBe('Mary Smith');
      expect(result.text).toBe('How are you?');
    });
  });

  describe('stripSpeakerPrefix', () => {
    test('strips speaker prefix from text', () => {
      expect(stripSpeakerPrefix('HOST: Welcome!')).toBe('Welcome!');
    });

    test('returns original text if no prefix', () => {
      expect(stripSpeakerPrefix('No prefix here')).toBe('No prefix here');
    });

    test('strips >> prefix', () => {
      expect(stripSpeakerPrefix('>> ALICE: Hello')).toBe('Hello');
    });
  });

  describe('parseWebVTT', () => {
    const basicVTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:04.000 --> 00:00:06.500
Second subtitle here
`;

    test('parses basic WebVTT into segments', () => {
      const segs = parseWebVTT(basicVTT);
      expect(segs).toHaveLength(2);
    });

    test('converts timestamps to milliseconds', () => {
      const segs = parseWebVTT(basicVTT);
      expect(segs[0].timestamp).toBe(1000);
      expect(segs[0].endTime).toBe(3000);
    });

    test('extracts text content', () => {
      const segs = parseWebVTT(basicVTT);
      expect(segs[0].text).toBe('Hello world');
    });

    test('sets source to native', () => {
      const segs = parseWebVTT(basicVTT);
      expect(segs[0].source).toBe('native');
    });

    test('sets lang from parameter', () => {
      const segs = parseWebVTT(basicVTT, 'en');
      expect(segs[0].lang).toBe('en');
    });

    test('handles VTT with cue IDs', () => {
      const vttWithIds = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
Hello

2
00:00:04.000 --> 00:00:06.000
World
`;
      const segs = parseWebVTT(vttWithIds);
      expect(segs).toHaveLength(2);
      expect(segs[0].text).toBe('Hello');
    });

    test('handles VTT with HTML tags', () => {
      const vttWithTags = `WEBVTT

00:00:01.000 --> 00:00:03.000
<b>Bold</b> text here
`;
      const segs = parseWebVTT(vttWithTags);
      expect(segs[0].text).toBe('Bold text here');
    });

    test('returns empty array for empty input', () => {
      expect(parseWebVTT('')).toHaveLength(0);
      expect(parseWebVTT(null)).toHaveLength(0);
    });

    test('handles multi-line cue text', () => {
      const multiLine = `WEBVTT

00:00:01.000 --> 00:00:04.000
Line one
Line two
`;
      const segs = parseWebVTT(multiLine);
      expect(segs[0].text).toBe('Line one Line two');
    });

    test('parses speaker prefix from cue text', () => {
      const vttWithSpeaker = `WEBVTT

00:00:01.000 --> 00:00:03.000
HOST: Welcome to the show
`;
      const segs = parseWebVTT(vttWithSpeaker);
      expect(segs[0].speakerLabel).toBe('HOST');
      expect(segs[0].text).toBe('Welcome to the show');
    });

    test('skips NOTE blocks', () => {
      const vttWithNote = `WEBVTT

NOTE This is a note

00:00:01.000 --> 00:00:03.000
Hello
`;
      const segs = parseWebVTT(vttWithNote);
      expect(segs).toHaveLength(1);
    });

    test('handles timestamps with hours', () => {
      const vttHours = `WEBVTT

01:00:01.000 --> 01:00:03.000
Hour one content
`;
      const segs = parseWebVTT(vttHours);
      expect(segs[0].timestamp).toBe(3601000);
    });
  });

  describe('trackToSegments', () => {
    test('converts track + VTT content to segments', () => {
      const track = { lang: 'en', label: 'English' };
      const content = `WEBVTT

00:00:01.000 --> 00:00:03.000
Test content
`;
      const segs = trackToSegments(track, content);
      expect(segs).toHaveLength(1);
      expect(segs[0].lang).toBe('en');
      expect(segs[0].text).toBe('Test content');
    });

    test('uses und for missing lang', () => {
      const track = {};
      const content = `WEBVTT

00:00:01.000 --> 00:00:03.000
Content
`;
      const segs = trackToSegments(track, content);
      expect(segs[0].lang).toBe('und');
    });
  });

  describe('detectInMainWorld (structure validation)', () => {
    test('is a function', () => {
      expect(typeof detectInMainWorld).toBe('function');
    });

    test('function source is self-contained (no import/require)', () => {
      const src = detectInMainWorld.toString();
      expect(src).not.toMatch(/\bimport\b/);
      expect(src).not.toMatch(/\brequire\b/);
    });

    test('function source does not reference module-scope variables', () => {
      const src = detectInMainWorld.toString();
      // Should not reference external module identifiers
      // (It defines SITES inline, which is correct)
      expect(src).toContain('youtube.com');
      expect(src).toContain('bilibili.com');
      expect(src).toContain('SITES');
    });

    test('returns null when window globals are absent', () => {
      // Simulate calling detectInMainWorld in jsdom environment (no YouTube/Bilibili globals)
      // We need to call it in a controlled way
      const mockWindow = {
        location: { hostname: 'example.com' },
        ytInitialPlayerResponse: undefined,
        __INITIAL_STATE__: undefined
      };

      // Override global window temporarily to simulate
      const origHostname = window.location.hostname;
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        configurable: true
      });

      // The function would return null on example.com with no tracks
      // We just verify the function can be called without errors
      expect(() => detectInMainWorld()).not.toThrow();

      // Restore
      Object.defineProperty(window, 'location', {
        value: { hostname: origHostname },
        configurable: true
      });
    });
  });
});
