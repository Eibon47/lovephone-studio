import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('service worker only removes LovePhone caches', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(source, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(source, /keys\.filter\(key => key !== CACHE_NAME\)/);
});

test('service worker refreshes modules when hosted below a path', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(source, /pathname\.includes\('\/src\/'\)/);
});
