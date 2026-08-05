import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, unzipSync, zipSync } from '../assets/vendor/fflate/fflate.js';
import { createThemePackage, inspectThemePackage } from '../src/services/themePackageService.js';

const basePackage = {
  id: 'my-soft-theme',
  name: 'My soft theme',
  author: 'Xiaoye',
  type: 'phone',
  customization: {
    tokens: { accent: '#338866' },
    appThemes: {
      chat: {
        enabled: true,
        media: {
          backgroundImage: 'data:image/png;base64,AAAA',
          primaryButtonImage: 'data:image/webp;base64,AAAA',
          backButtonImage: 'data:image/png;base64,AAAA'
        }
      }
    },
    widgets: [{ id: 'my-clock', dataSource: 'time', action: 'openApp', actionTarget: 'chat' }]
  },
  css: '.home-screen { color: #123456; }',
  assets: [{ name: 'chat.png', data: new Uint8Array([1, 2, 3]) }]
};

test('theme packages round trip with hashes and a safe preview summary', async () => {
  const archive = await createThemePackage(basePackage);
  const result = await inspectThemePackage(archive);
  assert.equal(result.manifest.id, 'my-soft-theme');
  assert.equal(result.customization.tokens.accent, '#338866');
  assert.equal(result.customization.appThemes.chat.media.backgroundImage, 'data:image/png;base64,AAAA');
  assert.equal(result.customization.appThemes.chat.media.primaryButtonImage, 'data:image/webp;base64,AAAA');
  assert.equal(result.customization.appThemes.chat.media.backButtonImage, 'data:image/png;base64,AAAA');
  assert.equal(result.css, '.home-screen { color: #123456; }');
  assert.equal(result.assets[0].name, 'chat.png');
  assert.equal(result.summary.externalResources, false);
  assert.equal(result.summary.fileCount, 4);
});

test('forbidden files and path traversal are rejected', async () => {
  const archive = zipSync({
    'manifest.json': strToU8('{}'),
    'customization.json': strToU8('{}'),
    '../evil.js': strToU8('alert(1)')
  });
  await assert.rejects(() => inspectThemePackage(archive), error => error.code === 'FORBIDDEN_FILE');
});

test('customization and CSS cannot reference external resources', async () => {
  await assert.rejects(
    () => createThemePackage({
      ...basePackage,
      customization: { appThemes: { chat: { icon: 'https://example.com/a.png' } } }
    }),
    /external network resource/
  );
  await assert.rejects(
    () => createThemePackage({
      ...basePackage,
      css: '.x { background: url(https://example.com/a.png); }'
    }),
    /External or embedded URLs/
  );
});

test('modified package files fail hash verification', async () => {
  const archive = await createThemePackage(basePackage);
  const files = unzipSync(archive);
  files['customization.json'] = strToU8('{"tokens":{"accent":"#ffffff"}}');
  const tampered = zipSync(files);
  await assert.rejects(() => inspectThemePackage(tampered), error => error.code === 'HASH_MISMATCH');
});

test('app packages require a safe target App ID', async () => {
  await assert.rejects(
    () => createThemePackage({ ...basePackage, type: 'app', targetAppId: '../chat' }),
    /App ID is invalid/
  );
});

test('declared uncompressed file limits are checked before package extraction', async () => {
  const archive = zipSync({
    'manifest.json': strToU8('{}'),
    'customization.json': new Uint8Array(5 * 1024 * 1024 + 1)
  }, { level: 9 });
  await assert.rejects(
    () => inspectThemePackage(archive),
    error => error.code === 'FILE_TOO_LARGE'
  );
});
