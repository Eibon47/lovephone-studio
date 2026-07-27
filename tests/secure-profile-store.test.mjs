import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createSecureProfileStore } from '../server/secure-profile-store.mjs';

test('Windows DPAPI store round-trips profiles without plaintext secrets on disk', {
  skip: process.platform !== 'win32'
}, async () => {
  const secretFile = path.join(
    os.tmpdir(),
    `lovephone-ai-profile-${process.pid}-${Date.now()}.dpapi`
  );
  const store = createSecureProfileStore({ secretFile });
  const entries = [[
    'role-character-main',
    {
      providerId: 'deepseek',
      apiKey: 'sk-test-secret-value',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com'
    }
  ]];

  try {
    await store.save(entries);
    const encrypted = await readFile(secretFile, 'utf8');
    assert.doesNotMatch(encrypted, /sk-test-secret-value/);
    assert.deepEqual(await store.load(), entries);
    assert.equal(store.kind, 'windows-dpapi');
  } finally {
    await unlink(secretFile).catch(() => {});
  }
});
