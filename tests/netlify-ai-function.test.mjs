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

test('Netlify AI function blocks secrets in text attachments before contacting a model', async () => {
  const response = await handler(new Request('https://example.netlify.app/.netlify/functions/ai', {
    method: 'POST',
    body: JSON.stringify({
      action: 'chat', providerId: 'deepseek', apiKey: 'test-key', model: 'test-model',
      system: '只做测试', messages: [{ role: 'user', content: '检查附件' }],
      attachments: [{ name: 'secret.txt', type: 'text/plain', text: 'password=very-secret-password' }]
    })
  }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /密钥、密码或登录凭证/);
  assert.doesNotMatch(body.error, /very-secret-password/);
});
