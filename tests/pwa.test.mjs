import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getStandaloneUrl,
  isPhoneMode
} from '../src/services/pwaService.js';

test('phone mode is enabled by URL or installed display mode', () => {
  assert.equal(isPhoneMode('?mode=phone', false), true);
  assert.equal(isPhoneMode('?mode=studio', false), false);
  assert.equal(isPhoneMode('', true), true);
});

test('standalone URL keeps the deployment path and removes editor parameters', () => {
  const href = getStandaloneUrl({
    href: 'https://example.com/lovephone/index.html?flow=apps-v7#preview'
  });
  assert.equal(href, 'https://example.com/lovephone/index.html?mode=phone');
});
