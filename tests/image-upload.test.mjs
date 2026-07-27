import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSquareCrop,
  scaledImageDimensions,
  validateImageFile
} from '../src/services/imageUploadService.js';

test('image upload validates format and source size', () => {
  assert.doesNotThrow(() => validateImageFile({
    type: 'image/png',
    size: 1024
  }));
  assert.throws(
    () => validateImageFile({ type: 'image/svg+xml', size: 100 }),
    /仅支持/
  );
  assert.throws(
    () => validateImageFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }),
    /5MB/
  );
});

test('square crop centers landscape and portrait images', () => {
  assert.deepEqual(computeSquareCrop(1200, 800), {
    sourceX: 200,
    sourceY: 0,
    sourceSize: 800
  });
  assert.deepEqual(computeSquareCrop(600, 1000), {
    sourceX: 0,
    sourceY: 200,
    sourceSize: 600
  });
});

test('large widget photos preserve aspect ratio while fitting the size limit', () => {
  assert.deepEqual(scaledImageDimensions(4000, 2000, 1000), {
    width: 1000,
    height: 500
  });
  assert.deepEqual(scaledImageDimensions(600, 900, 1200), {
    width: 600,
    height: 900
  });
});
