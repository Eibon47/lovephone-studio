import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../netlify/functions/music.mjs';

test('Netlify music function exposes a same-origin health check without loading music modules', async () => {
  const response = await handler(new Request('https://example.netlify.app/.netlify/functions/music', {
    method: 'POST', body: JSON.stringify({ path: '/health' })
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).service, 'LovePhone Music Gateway');
});

test('Netlify music function rejects arbitrary upstream paths and non-POST requests', async () => {
  const blocked = await handler(new Request('https://example.netlify.app/.netlify/functions/music', {
    method: 'POST', body: JSON.stringify({ path: '/admin/delete', params: {} })
  }));
  assert.equal(blocked.status, 403);
  const method = await handler(new Request('https://example.netlify.app/.netlify/functions/music'));
  assert.equal(method.status, 405);
});
