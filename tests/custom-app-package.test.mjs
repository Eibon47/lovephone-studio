import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from '../assets/vendor/fflate/fflate.js';
import { inspectCustomAppPackage } from '../src/services/customAppPackageService.js';

function archive(overrides = {}) {
  const manifest = {
    format: 'lovephone-app', formatVersion: 1, id: 'hello-tool', name: 'Hello tool', version: '1.0.0',
    entry: 'app.html', pages: ['app.html'], styles: ['styles/app.css'], scripts: ['scripts/app.js'],
    permissions: ['storage', 'character.read']
  };
  return zipSync({
    'manifest.json': strToU8(JSON.stringify({ ...manifest, ...(overrides.manifest || {}) })),
    'app.html': strToU8(overrides.html || '<main>Hello</main>'),
    'styles/app.css': strToU8('body{color:#234;}'),
    'scripts/app.js': strToU8('console.log("hello")'),
    ...(overrides.files || {})
  });
}

test('custom App package validates and exposes a useful installation summary', async () => {
  const result = await inspectCustomAppPackage(archive());
  assert.equal(result.manifest.id, 'hello-tool');
  assert.equal(result.summary.pageCount, 1);
  assert.deepEqual(result.manifest.permissions, ['storage', 'character.read']);
});

test('custom App package rejects traversal, missing entry and remote resources', async () => {
  await assert.rejects(() => inspectCustomAppPackage(archive({ files: { '../escape.js': strToU8('x') } })), error => error.code === 'FORBIDDEN_FILE');
  await assert.rejects(() => inspectCustomAppPackage(archive({ manifest: { entry: 'pages/missing.html', pages: ['pages/missing.html'] } })), error => error.code === 'MISSING_FILE');
  await assert.rejects(() => inspectCustomAppPackage(archive({ html: '<script src="https://example.com/app.js"></script>' })), error => error.code === 'EXTERNAL_RESOURCE');
});

test('custom App package only accepts declared HTTPS network origins', async () => {
  const result = await inspectCustomAppPackage(archive({ manifest: { permissions: ['network'], networkOrigins: ['https://api.example.com'] } }));
  assert.deepEqual(result.manifest.networkOrigins, ['https://api.example.com']);
  await assert.rejects(() => inspectCustomAppPackage(archive({ manifest: { permissions: ['network'], networkOrigins: ['http://api.example.com'] } })), /HTTPS/);
});
