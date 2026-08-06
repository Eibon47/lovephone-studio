import test from 'node:test';
import assert from 'node:assert/strict';

import { strFromU8, strToU8 } from '../assets/vendor/fflate/fflate.js';
import { cloneConfig } from '../src/config/defaultConfig.js';
import { standalonePhoneExportFilesForTest } from '../src/services/standalonePhoneExportService.js';

test('standalone HTML export embeds the phone configuration and starts in phone mode', () => {
  const config = cloneConfig();
  config.meta.title = '小满的本地小手机';
  const files = standalonePhoneExportFilesForTest(config, {
    'index.html': strToU8('<html><head><title>LovePhone Studio</title></head><body><script type="module" src="src/main.js?v=1"></script></body></html>'),
    'manifest.webmanifest': strToU8('{}'),
    'sw.js': strToU8("const APP_SHELL = [\n  './index.html'\n];")
  }, 'phone-test-id');

  assert.match(strFromU8(files['index.html']), /lovephone\.config\.js/);
  assert.match(strFromU8(files['lovephone.config.js']), /phone-test-id/);
  assert.match(strFromU8(files['lovephone.config.js']), /小满的本地小手机/);
  assert.match(strFromU8(files['sw.js']), /lovephone\.config\.js/);
  assert.match(strFromU8(files['README-本地小手机.md']), /纯 HTML 小手机/);
});
