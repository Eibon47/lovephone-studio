import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearMusicSession,
  musicFetchJson,
  musicPostJson,
  normalizeMusicApiUrl
} from '../src/services/musicService.js';

test('compatible music API requests do not create a local bridge session or attach credentials', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ state: { status: 'playing' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    clearMusicSession();
    const result = await musicPostJson('https://music.example.test', '/control', {
      action: 'resume'
    });
    assert.equal(result.state.status, 'playing');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://music.example.test/control');
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[0].options.headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('music API configuration accepts HTTPS and rejects arbitrary insecure endpoints', () => {
  assert.equal(normalizeMusicApiUrl('https://music.example.test/'), 'https://music.example.test');
  assert.equal(normalizeMusicApiUrl('http://music.example.test'), '');
  assert.equal(normalizeMusicApiUrl('javascript:alert(1)'), '');
  assert.equal(normalizeMusicApiUrl('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000');
});
