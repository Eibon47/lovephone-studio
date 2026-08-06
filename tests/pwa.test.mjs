import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPwaInstallHelp,
  getStandaloneUrl,
  isPhoneMode
} from '../src/services/pwaService.js';

test('phone mode is enabled by URL or installed display mode', () => {
  assert.equal(isPhoneMode('?mode=phone', false), true);
  assert.equal(isPhoneMode('?mode=studio', false), false);
  assert.equal(isPhoneMode('', true), true);
});

test('PWA install help distinguishes iOS from desktop browsers', () => {
  assert.match(getPwaInstallHelp('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), /Safari/);
  assert.match(getPwaInstallHelp('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'), /Chrome/);
});

test('standalone URL keeps the deployment path and removes editor parameters', () => {
  const href = getStandaloneUrl({
    href: 'https://example.com/lovephone/index.html?flow=apps-v7#preview'
  });
  assert.equal(href, 'https://example.com/lovephone/index.html?mode=phone');
});
