import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../netlify/functions/ai.mjs';

test('Netlify AI function answers health checks without accepting a key', async () => {
  const response = await handler(new Request('https://example.netlify.app/.netlify/functions/ai', {
    method: 'POST',
    body: JSON.stringify({ action: 'health' })
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('Netlify AI function rejects a custom non-HTTPS provider URL', async () => {
  const response = await handler(new Request('https://example.netlify.app/.netlify/functions/ai', {
    method: 'POST',
    body: JSON.stringify({
      action: 'configure', providerId: 'custom', apiKey: 'test-key', model: 'test-model', baseUrl: 'http://example.test/v1'
    })
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /HTTPS/);
});
