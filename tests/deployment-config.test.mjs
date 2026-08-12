import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const privateAddressPatterns = [
  /https:\/\/[a-z0-9-]+\.service\.tcloudbase\.com\/(?:api-ai|music-gateway)/i,
  /https:\/\/[a-z0-9-]+-\d+\.tcloudbaseapp\.com/i
];

test('public runtime config contains no maintainer gateway', async () => {
  const source = await readFile(new URL('../runtime-config.js', import.meta.url), 'utf8');
  assert.match(source, /aiGatewayUrl:\s*''/);
  assert.match(source, /musicGatewayUrl:\s*''/);
});

test('tracked application and documentation contain no maintainer deployment address', async () => {
  const files = [
    '../runtime-config.js',
    '../src/services/aiService.js',
    '../src/services/musicService.js',
    '../cloudbaserc.example.json',
    '../docs/CLOUDBASE_DEPLOY.md'
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const pattern of privateAddressPatterns) assert.equal(pattern.test(source), false, `${file} contains a private deployment address`);
  }
});
