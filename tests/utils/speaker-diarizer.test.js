import {
  assignSpeakerLabels,
  parseDeepgramDiarized,
  mergeConsecutiveSpeakerSegments
} from '../../src/utils/speaker-diarizer.js';

describe('speaker-diarizer.js', () => {
  describe('assignSpeakerLabels', () => {
    test('converts numeric speaker ID "0" to "Speaker A"', () => {
      const segments = [{ text: 'Hello', timestamp: 0, speakerLabel: '0' }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('Speaker A');
    });

    test('converts numeric speaker ID "1" to "Speaker B"', () => {
      const segments = [{ text: 'World', timestamp: 1000, speakerLabel: '1' }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('Speaker B');
    });

    test('converts numeric speaker ID "2" to "Speaker C"', () => {
      const segments = [{ text: 'Hi', timestamp: 2000, speakerLabel: '2' }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('Speaker C');
    });

    test('preserves non-numeric speaker labels', () => {
      const segments = [{ text: 'Hello', timestamp: 0, speakerLabel: 'John' }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('John');
    });

    test('preserves "Speaker A" label unchanged', () => {
      const segments = [{ text: 'Hi', timestamp: 0, speakerLabel: 'Speaker A' }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('Speaker A');
    });

    test('extracts speaker from >> SPEAKER: text pattern', () => {
      const segments = [{ text: '>> HOST: Welcome', timestamp: 0, speakerLabel: null }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('HOST');
      expect(result[0].text).toBe('Welcome');
    });

    test('extracts speaker from ALL_CAPS: pattern', () => {
      const segments = [{ text: 'ALICE: Good morning', timestamp: 0, speakerLabel: null }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('ALICE');
      expect(result[0].text).toBe('Good morning');
    });

    test('leaves speakerLabel null when no pattern found', () => {
      const segments = [{ text: 'Just plain text', timestamp: 0, speakerLabel: null }];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBeNull();
    });

    test('handles empty array', () => {
      expect(assignSpeakerLabels([])).toEqual([]);
    });

    test('handles null/undefined', () => {
      expect(assignSpeakerLabels(null)).toEqual([]);
      expect(assignSpeakerLabels(undefined)).toEqual([]);
    });

    test('does not mutate original segments', () => {
      const original = [{ text: 'Hello', timestamp: 0, speakerLabel: '0' }];
      const result = assignSpeakerLabels(original);
      expect(original[0].speakerLabel).toBe('0'); // unchanged
      expect(result[0].speakerLabel).toBe('Speaker A'); // converted
    });

    test('handles multiple segments with different speakers', () => {
      const segments = [
        { text: 'Hello', timestamp: 0, speakerLabel: '0' },
        { text: 'World', timestamp: 1000, speakerLabel: '1' },
        { text: 'Again', timestamp: 2000, speakerLabel: '0' }
      ];
      const result = assignSpeakerLabels(segments);
      expect(result[0].speakerLabel).toBe('Speaker A');
      expect(result[1].speakerLabel).toBe('Speaker B');
      expect(result[2].speakerLabel).toBe('Speaker A');
    });
  });

  describe('parseDeepgramDiarized', () => {
    const buildResponse = (words) => ({
      results: {
        channels: [{
          alternatives: [{
            words,
            transcript: words.map(w => w.word).join(' ')
          }]
        }]
      }
    });

    test('returns empty array for empty response', () => {
      expect(parseDeepgramDiarized({})).toEqual([]);
      expect(parseDeepgramDiarized({ results: {} })).toEqual([]);
    });

    test('returns empty array when no words', () => {
      const response = buildResponse([]);
      expect(parseDeepgramDiarized(response)).toEqual([]);
    });

    test('creates segments grouped by speaker', () => {
      const words = [
        { word: 'Hello', start: 0, end: 0.5, speaker: 0 },
        { word: 'world', start: 0.6, end: 1.0, speaker: 0 },
        { word: 'Hi', start: 1.2, end: 1.5, speaker: 1 },
        { word: 'there', start: 1.6, end: 2.0, speaker: 1 },
      ];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello world');
      expect(result[0].speakerLabel).toBe('Speaker A');
      expect(result[1].text).toBe('Hi there');
      expect(result[1].speakerLabel).toBe('Speaker B');
    });

    test('converts timestamps to milliseconds', () => {
      const words = [
        { word: 'Hello', start: 1.5, end: 2.0, speaker: 0 },
      ];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result[0].timestamp).toBe(1500);
      expect(result[0].endTime).toBe(2000);
    });

    test('sets source to asr', () => {
      const words = [{ word: 'Hello', start: 0, end: 1, speaker: 0 }];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result[0].source).toBe('asr');
    });

    test('handles speaker switching multiple times', () => {
      const words = [
        { word: 'A', start: 0, end: 1, speaker: 0 },
        { word: 'B', start: 1, end: 2, speaker: 1 },
        { word: 'C', start: 2, end: 3, speaker: 0 },
        { word: 'D', start: 3, end: 4, speaker: 1 },
      ];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result).toHaveLength(4);
    });

    test('uses punctuated_word when available', () => {
      const words = [
        { word: 'hello', punctuated_word: 'Hello,', start: 0, end: 1, speaker: 0 },
        { word: 'world', punctuated_word: 'world.', start: 1, end: 2, speaker: 0 },
      ];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result[0].text).toBe('Hello, world.');
    });

    test('handles words without speaker field', () => {
      const words = [
        { word: 'Hello', start: 0, end: 1 },
        { word: 'world', start: 1, end: 2 },
      ];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Hello world');
    });

    test('maps speaker 0-25 to labels A-Z', () => {
      const words = [
        { word: 'A', start: 0, end: 1, speaker: 0 },
        { word: 'B', start: 1, end: 2, speaker: 25 },
      ];
      const result = parseDeepgramDiarized(buildResponse(words));
      expect(result[0].speakerLabel).toBe('Speaker A');
      expect(result[1].speakerLabel).toBe('Speaker Z');
    });
  });

  describe('mergeConsecutiveSpeakerSegments', () => {
    test('merges consecutive same-speaker segments', () => {
      const segments = [
        { text: 'Hello', timestamp: 0, endTime: 1000, speakerLabel: 'Speaker A' },
        { text: 'world', timestamp: 1000, endTime: 2000, speakerLabel: 'Speaker A' },
        { text: 'Hi', timestamp: 2000, endTime: 3000, speakerLabel: 'Speaker B' },
      ];
      const result = mergeConsecutiveSpeakerSegments(segments);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello world');
      expect(result[0].endTime).toBe(2000);
      expect(result[1].speakerLabel).toBe('Speaker B');
    });

    test('keeps non-consecutive same-speaker segments separate', () => {
      const segments = [
        { text: 'A', timestamp: 0, endTime: 1000, speakerLabel: 'Speaker A' },
        { text: 'B', timestamp: 1000, endTime: 2000, speakerLabel: 'Speaker B' },
        { text: 'C', timestamp: 2000, endTime: 3000, speakerLabel: 'Speaker A' },
      ];
      const result = mergeConsecutiveSpeakerSegments(segments);
      expect(result).toHaveLength(3);
    });

    test('handles empty array', () => {
      expect(mergeConsecutiveSpeakerSegments([])).toEqual([]);
    });

    test('handles null/undefined', () => {
      expect(mergeConsecutiveSpeakerSegments(null)).toEqual([]);
      expect(mergeConsecutiveSpeakerSegments(undefined)).toEqual([]);
    });

    test('returns single segment unchanged', () => {
      const segments = [{ text: 'Solo', timestamp: 0, endTime: 1000, speakerLabel: 'Speaker A' }];
      const result = mergeConsecutiveSpeakerSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Solo');
    });
  });
});
