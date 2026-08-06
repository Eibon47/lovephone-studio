import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearAiSession,
  configureAiProvider,
  getAiBridgeHealth
} from '../src/services/aiService.js';

const config = {
  aiProviders: {
    bridgeUrl: 'http://127.0.0.1:5189'
  }
};

test('local AI requests establish a credentialed session without exposing a token', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/session')) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    clearAiSession(config);
    const result = await getAiBridgeHealth(config);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://127.0.0.1:5189/session');
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('expired local AI sessions pair again and retry once', async () => {
  const originalFetch = globalThis.fetch;
  let sessionCount = 0;
  let healthCount = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/session')) {
      sessionCount += 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    healthCount += 1;
    return new Response(JSON.stringify(healthCount === 1
      ? { error: '会话过期' }
      : { ok: true }), {
      status: healthCount === 1 ? 401 : 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    clearAiSession(config);
    const result = await getAiBridgeHealth(config);
    assert.equal(result.ok, true);
    assert.equal(sessionCount, 2);
    assert.equal(healthCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deployed AI gateway keeps the user key in the browser session and sends it only to the gateway', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  const originalSessionStorage = globalThis.sessionStorage;
  const calls = [];
  const storage = new Map();
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { hostname: 'lovephone.netlify.app', href: 'https://lovephone.netlify.app/' } });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }
  });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: JSON.parse(options.body || '{}') });
    return new Response(JSON.stringify({ ok: true, answer: '连接成功' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const deployed = { aiProviders: { bridgeUrl: '' } };

  try {
    await configureAiProvider(deployed, {
      profileId: 'role-web', providerId: 'deepseek', apiKey: 'secret-key', model: 'deepseek-chat', baseUrl: ''
    });
    assert.equal(calls[0].url, '/.netlify/functions/ai');
    assert.equal(calls[0].body.apiKey, 'secret-key');
    assert.match(storage.get('lovephone-ai-session-profiles-v1'), /secret-key/);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: originalSessionStorage });
  }
});
