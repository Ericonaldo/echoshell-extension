/**
 * Compute mean squared error between two ImageData objects (Y-channel only)
 * Returns a value between 0 (identical) and ~65025 (max difference)
 */
export function computeFrameDiff(prev, curr) {
  if (!prev || !curr) return Infinity;
  if (prev.data.length !== curr.data.length) return Infinity;

  let sumSquaredDiff = 0;
  const pixelCount = prev.data.length / 4;

  for (let i = 0; i < prev.data.length; i += 4) {
    // Compute luminance (Y channel) using BT.601 coefficients
    const prevY = 0.299 * prev.data[i] + 0.587 * prev.data[i + 1] + 0.114 * prev.data[i + 2];
    const currY = 0.299 * curr.data[i] + 0.587 * curr.data[i + 1] + 0.114 * curr.data[i + 2];
    const diff = prevY - currY;
    sumSquaredDiff += diff * diff;
  }

  return sumSquaredDiff / pixelCount;
}

/**
 * Crop the bottom percentage of an ImageData object
 * @param {ImageData} imageData - Source image data
 * @param {number} percent - Fraction to crop from bottom (0-1)
 * @returns {ImageData} Cropped image data
 */
export function cropBottomPercent(imageData, percent) {
  const { width, height } = imageData;
  const cropHeight = Math.floor(height * percent);
  const startY = height - cropHeight;

  const croppedData = new Uint8ClampedArray(width * cropHeight * 4);

  for (let y = 0; y < cropHeight; y++) {
    const srcOffset = ((startY + y) * width) * 4;
    const dstOffset = y * width * 4;
    croppedData.set(imageData.data.slice(srcOffset, srcOffset + width * 4), dstOffset);
  }

  return new ImageData(croppedData, width, cropHeight);
}

/**
 * Convert ImageData to base64 PNG data URL via canvas
 */
export function imageDataToBase64(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * Check if frame difference exceeds threshold
 */
export function hasSignificantChange(prev, curr, threshold = 10) {
  const diff = computeFrameDiff(prev, curr);
  return diff > threshold;
}
