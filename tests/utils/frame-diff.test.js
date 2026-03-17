import {
  computeFrameDiff,
  cropBottomPercent,
  hasSignificantChange
} from '../../src/utils/frame-diff.js';

function createImageData(width, height, fillValue = 128) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;     // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255;       // A
  }
  return new ImageData(data, width, height);
}

describe('frame-diff.js', () => {
  describe('computeFrameDiff()', () => {
    test('returns 0 for identical frames', () => {
      const frame = createImageData(10, 10, 128);
      const diff = computeFrameDiff(frame, frame);
      expect(diff).toBe(0);
    });

    test('returns 0 for two identical frame copies', () => {
      const frameA = createImageData(10, 10, 100);
      const frameB = createImageData(10, 10, 100);
      const diff = computeFrameDiff(frameA, frameB);
      expect(diff).toBe(0);
    });

    test('returns a positive value for different frames', () => {
      const frameA = createImageData(10, 10, 0);    // all black
      const frameB = createImageData(10, 10, 255);  // all white
      const diff = computeFrameDiff(frameA, frameB);
      expect(diff).toBeGreaterThan(0);
    });

    test('returns Infinity for null inputs', () => {
      expect(computeFrameDiff(null, createImageData(5, 5))).toBe(Infinity);
      expect(computeFrameDiff(createImageData(5, 5), null)).toBe(Infinity);
    });

    test('returns Infinity when dimensions differ', () => {
      const frameA = createImageData(10, 10);
      const frameB = createImageData(20, 20);
      expect(computeFrameDiff(frameA, frameB)).toBe(Infinity);
    });

    test('small change produces smaller diff than large change', () => {
      const frameA = createImageData(10, 10, 100);
      const frameSmallChange = createImageData(10, 10, 101);
      const frameLargeChange = createImageData(10, 10, 200);
      const smallDiff = computeFrameDiff(frameA, frameSmallChange);
      const largeDiff = computeFrameDiff(frameA, frameLargeChange);
      expect(smallDiff).toBeLessThan(largeDiff);
    });
  });

  describe('cropBottomPercent()', () => {
    test('crops bottom 20% correctly', () => {
      const source = createImageData(100, 100);
      const cropped = cropBottomPercent(source, 0.2);
      expect(cropped.height).toBe(20);
      expect(cropped.width).toBe(100);
    });

    test('cropped data has correct size', () => {
      const source = createImageData(80, 60);
      const cropped = cropBottomPercent(source, 0.25);
      expect(cropped.height).toBe(15);
      expect(cropped.width).toBe(80);
      expect(cropped.data.length).toBe(80 * 15 * 4);
    });

    test('crops 100% returns full height', () => {
      const source = createImageData(50, 40);
      const cropped = cropBottomPercent(source, 1.0);
      expect(cropped.height).toBe(40);
    });

    test('crops 0% returns 0 height', () => {
      const source = createImageData(50, 40);
      const cropped = cropBottomPercent(source, 0);
      expect(cropped.height).toBe(0);
    });
  });

  describe('hasSignificantChange()', () => {
    test('returns false for identical frames', () => {
      const frame = createImageData(10, 10, 128);
      expect(hasSignificantChange(frame, frame, 10)).toBe(false);
    });

    test('returns true for significantly different frames', () => {
      const frameA = createImageData(10, 10, 0);
      const frameB = createImageData(10, 10, 255);
      expect(hasSignificantChange(frameA, frameB, 10)).toBe(true);
    });

    test('uses custom threshold correctly', () => {
      const frameA = createImageData(10, 10, 100);
      const frameB = createImageData(10, 10, 110);
      const diff = computeFrameDiff(frameA, frameB);
      // Should be significant with low threshold, not significant with high threshold
      const highThreshold = diff + 1;
      const lowThreshold = diff - 1;
      expect(hasSignificantChange(frameA, frameB, highThreshold)).toBe(false);
      expect(hasSignificantChange(frameA, frameB, lowThreshold)).toBe(true);
    });
  });
});
