import {
  buildWavHeader,
  encodePCM,
  computeRMS,
  concatenateBuffers,
  buildWavFile
} from '../../src/utils/audio-utils.js';

describe('audio-utils.js', () => {
  describe('buildWavHeader()', () => {
    test('produces exactly 44 bytes', () => {
      const header = buildWavHeader(44100, 1, 1000);
      expect(header.byteLength).toBe(44);
    });

    test('starts with RIFF magic bytes', () => {
      const header = buildWavHeader(44100, 1, 1000);
      const view = new DataView(header);
      const riff = String.fromCharCode(
        view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
      );
      expect(riff).toBe('RIFF');
    });

    test('contains WAVE identifier at offset 8', () => {
      const header = buildWavHeader(44100, 1, 1000);
      const view = new DataView(header);
      const wave = String.fromCharCode(
        view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
      );
      expect(wave).toBe('WAVE');
    });

    test('encodes sample rate correctly at offset 24', () => {
      const header = buildWavHeader(48000, 1, 1000);
      const view = new DataView(header);
      expect(view.getUint32(24, true)).toBe(48000);
    });

    test('encodes channel count at offset 22', () => {
      const header = buildWavHeader(44100, 2, 1000);
      const view = new DataView(header);
      expect(view.getUint16(22, true)).toBe(2);
    });
  });

  describe('encodePCM()', () => {
    test('converts Float32Array to Int16Array', () => {
      const float = new Float32Array([0, 0.5, 1.0, -1.0]);
      const pcm = encodePCM(float);
      expect(pcm).toBeInstanceOf(Int16Array);
      expect(pcm.length).toBe(4);
    });

    test('correctly maps 0 to 0', () => {
      const float = new Float32Array([0]);
      const pcm = encodePCM(float);
      expect(pcm[0]).toBe(0);
    });

    test('clips values above 1.0 to 32767', () => {
      const float = new Float32Array([2.0]);
      const pcm = encodePCM(float);
      expect(pcm[0]).toBe(32767);
    });

    test('clips values below -1.0 to -32768', () => {
      const float = new Float32Array([-2.0]);
      const pcm = encodePCM(float);
      expect(pcm[0]).toBe(-32768);
    });

    test('maps positive max (1.0) to 32767', () => {
      const float = new Float32Array([1.0]);
      const pcm = encodePCM(float);
      expect(pcm[0]).toBe(32767);
    });
  });

  describe('computeRMS()', () => {
    test('returns 0 for silence (all zeros)', () => {
      const silence = new Float32Array(1000);
      expect(computeRMS(silence)).toBe(0);
    });

    test('returns 0 for empty array', () => {
      expect(computeRMS(new Float32Array(0))).toBe(0);
    });

    test('returns correct RMS for constant signal', () => {
      // RMS of constant value 0.5 is 0.5
      const constant = new Float32Array(100).fill(0.5);
      expect(computeRMS(constant)).toBeCloseTo(0.5, 5);
    });

    test('returns positive value for non-silent audio', () => {
      const noisy = new Float32Array(100).fill(0.1);
      expect(computeRMS(noisy)).toBeGreaterThan(0);
    });
  });

  describe('concatenateBuffers()', () => {
    test('concatenates two buffers correctly', () => {
      const a = new Uint8Array([1, 2, 3]).buffer;
      const b = new Uint8Array([4, 5, 6]).buffer;
      const result = concatenateBuffers([a, b]);
      const view = new Uint8Array(result);
      expect(Array.from(view)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('total byteLength equals sum of input buffers', () => {
      const buffers = [
        new Uint8Array(10).buffer,
        new Uint8Array(20).buffer,
        new Uint8Array(30).buffer
      ];
      const result = concatenateBuffers(buffers);
      expect(result.byteLength).toBe(60);
    });

    test('handles empty array', () => {
      const result = concatenateBuffers([]);
      expect(result.byteLength).toBe(0);
    });
  });

  describe('buildWavFile()', () => {
    test('produces a buffer larger than 44 bytes', () => {
      const audio = new Float32Array(1000).fill(0.1);
      const wavFile = buildWavFile(audio, 44100);
      expect(wavFile.byteLength).toBeGreaterThan(44);
    });

    test('starts with RIFF header', () => {
      const audio = new Float32Array(100);
      const wavFile = buildWavFile(audio, 44100);
      const view = new DataView(wavFile);
      const riff = String.fromCharCode(
        view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
      );
      expect(riff).toBe('RIFF');
    });
  });
});
