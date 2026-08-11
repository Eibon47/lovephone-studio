import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomAppStore, createMemoryCustomAppAdapter } from '../src/storage/customAppStore.js';

function info(version = '1.0.0') {
  return { archive: new Uint8Array([1, 2, 3]), summary: { archiveBytes: 3 }, manifest: { id: 'hello-tool', name: 'Hello', version, permissions: ['storage'], networkOrigins: [] } };
}
function store() { return createCustomAppStore({ adapter: createMemoryCustomAppAdapter(), now: () => '2026-08-11T00:00:00.000Z' }); }

test('custom Apps preserve private data when the same App ID is updated', async () => {
  const target = store();
  await target.install(info());
  await target.setData('hello-tool', 'count', 2);
  await target.install(info('2.0.0'), { replace: true });
  assert.equal(await target.getData('hello-tool', 'count'), 2);
  assert.equal((await target.getApp('hello-tool')).manifest.version, '2.0.0');
});

test('custom App removal clears private data and duplicate install requires confirmation path', async () => {
  const target = store();
  await target.install(info());
  await assert.rejects(() => target.install(info()), error => error.code === 'DUPLICATE_APP');
  await target.setData('hello-tool', 'private', { yes: true });
  await target.remove('hello-tool');
  assert.equal(await target.getApp('hello-tool'), undefined);
  assert.equal(await target.getData('hello-tool', 'private'), undefined);
});
