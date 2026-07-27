import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultConfig } from '../src/config/defaultConfig.js';
import { getAppIcon } from '../src/system/appAppearance.js';
import {
  getCharacterAvatar,
  iconMap,
  safeUploadedImage
} from '../src/system/icons.js';

test('uploaded image sources accept generated bitmap data and reject attribute injection', () => {
  const safe = 'data:image/webp;base64,UklGRg==';
  const malicious = 'data:image/" onerror="globalThis.pwned=true';
  assert.equal(safeUploadedImage(safe), safe);
  assert.equal(safeUploadedImage(malicious), '');
  assert.equal(safeUploadedImage('data:image/svg+xml;base64,PHN2Zz4='), '');
});

test('imported malicious avatar and app icon values fall back to bundled images', () => {
  const config = structuredClone(defaultConfig);
  config.character.avatar = {
    type: 'upload',
    value: 'data:image/" onerror="alert(1)'
  };
  config.theme.appLooks.chat = {
    icon: {
      mode: 'upload',
      value: 'data:image/svg+xml;base64,PHN2Zz4='
    }
  };
  assert.equal(getCharacterAvatar(config.character), iconMap.heart);
  assert.equal(getAppIcon(config, { id: 'chat', icon: 'chat' }), iconMap.chat);
});
