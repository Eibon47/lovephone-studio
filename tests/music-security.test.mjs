import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearMusicSession,
  musicFetchJson,
  musicPostJson
} from '../src/services/musicService.js';

test('local music requests establish a credentialed session without storing a token', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith('/session')) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ state: { status: 'playing' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    clearMusicSession('http://127.0.0.1:5188');
    const result = await musicPostJson('http://127.0.0.1:5188', '/control', {
      action: 'resume'
    });
    assert.equal(result.state.status, 'playing');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://127.0.0.1:5188/session');
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('expired local music sessions pair once again and retry the request', async () => {
  const originalFetch = globalThis.fetch;
  let sessionCount = 0;
  let stateCount = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/session')) {
      sessionCount += 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    stateCount += 1;
    return new Response(JSON.stringify(stateCount === 1
      ? { error: '会话过期' }
      : { state: { status: 'paused' } }), {
      status: stateCount === 1 ? 401 : 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    clearMusicSession('http://localhost:5188');
    const result = await musicFetchJson('http://localhost:5188/state');
    assert.equal(result.state.status, 'paused');
    assert.equal(sessionCount, 2);
    assert.equal(stateCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
