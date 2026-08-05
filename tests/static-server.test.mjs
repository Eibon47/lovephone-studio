import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { startStaticServer } from '../server/static-server.mjs';

test('desktop static server serves the app with security headers and blocks traversal', async () => {
  const server = await startStaticServer({
    root: path.resolve('.'),
    port: 0,
    runtimeToken: 'test-runtime-token',
    experimentalMusic: false
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const index = await fetch(`${base}/index.html`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(index.headers.get('content-security-policy'), /nonce-lovephone-widget-sandbox/);
    assert.equal(index.headers.get('x-frame-options'), 'DENY');
    assert.match(await index.text(), /LovePhone Studio/);

    const method = await fetch(`${base}/index.html`, { method: 'POST' });
    assert.equal(method.status, 405);

    const missing = await fetch(`${base}/not-found.txt`);
    assert.equal(missing.status, 404);

    const dependency = await fetch(`${base}/node_modules/gridstack/package.json`);
    assert.equal(dependency.status, 403);

    const runtime = await fetch(`${base}/__lovephone_runtime`);
    assert.equal(runtime.status, 200);
    assert.deepEqual(await runtime.json(), {
      desktop: true,
      instance: '7268834abc98ce207e4fdeb7b7189e365f62f4b6b85ce2739750a8c3bda0438a',
      experimentalMusic: false
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
