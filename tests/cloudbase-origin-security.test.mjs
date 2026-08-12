import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const aiGateway = require('../cloudbase/functions/ai-gateway/index.js');
const musicGateway = require('../cloudbase/functions/wangyiyun66-gateway/index.js');
const allowed = 'https://preview.example';

async function withAllowedOrigin(run) {
  const original = process.env.LOVEPHONE_ALLOWED_ORIGINS;
  process.env.LOVEPHONE_ALLOWED_ORIGINS = allowed;
  try {
    await run();
  } finally {
    if (original === undefined) delete process.env.LOVEPHONE_ALLOWED_ORIGINS;
    else process.env.LOVEPHONE_ALLOWED_ORIGINS = original;
  }
}

test('CloudBase gateways allow the configured site origin', async () => withAllowedOrigin(async () => {
  const ai = await aiGateway.main({ httpMethod: 'POST', headers: { origin: allowed }, body: JSON.stringify({ action: 'health' }) });
  const music = await musicGateway.main({ httpMethod: 'POST', headers: { origin: allowed }, body: JSON.stringify({ path: '/health' }) });
  assert.equal(ai.statusCode, 200);
  assert.equal(music.statusCode, 200);
  assert.equal(ai.headers['access-control-allow-origin'], allowed);
  assert.equal(music.headers['access-control-allow-origin'], allowed);
}));

test('CloudBase gateways reject another site even when it knows the endpoint', async () => withAllowedOrigin(async () => {
  const event = { httpMethod: 'POST', headers: { origin: 'https://untrusted.example' }, body: '{}' };
  const ai = await aiGateway.main(event);
  const music = await musicGateway.main(event);
  assert.equal(ai.statusCode, 403);
  assert.equal(music.statusCode, 403);
  assert.equal(ai.headers['access-control-allow-origin'], undefined);
  assert.equal(music.headers['access-control-allow-origin'], undefined);
}));
