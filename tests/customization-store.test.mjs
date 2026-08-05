import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCustomizationStore,
  createMemoryCustomizationAdapter
} from '../src/storage/customizationStore.js';

function createStore() {
  return createCustomizationStore({
    adapter: createMemoryCustomizationAdapter(),
    now: () => '2026-07-29T10:00:00.000Z'
  });
}

test('package and assets are stored separately with usage accounting', async () => {
  const store = createStore();
  await store.savePackage({
    id: 'soft-green',
    name: 'Soft green',
    type: 'phone',
    customization: { tokens: { accent: '#7fb59a' } }
  });
  await store.saveAsset('soft-green', {
    id: 'chat-icon',
    name: 'chat.png',
    mediaType: 'image/png',
    data: new Uint8Array([1, 2, 3, 4])
  });

  assert.equal((await store.listPackages()).length, 1);
  assert.equal((await store.listAssets('soft-green')).length, 1);
  assert.deepEqual((await store.getAsset('soft-green', 'chat-icon')).data, new Uint8Array([1, 2, 3, 4]));
  assert.deepEqual(await store.getUsage(), {
    packageCount: 1,
    assetCount: 1,
    sizeBytes: 39
  });
});

test('duplicate package IDs require explicit replacement', async () => {
  const store = createStore();
  await store.savePackage({ id: 'same-id', name: 'First' });
  await assert.rejects(
    () => store.savePackage({ id: 'same-id', name: 'Second' }),
    error => error.code === 'DUPLICATE_PACKAGE'
  );
  const replaced = await store.savePackage({ id: 'same-id', name: 'Second' }, { replace: true });
  assert.equal(replaced.name, 'Second');
});

test('removing a package also removes its assets', async () => {
  const store = createStore();
  await store.savePackage({ id: 'to-remove' });
  await store.saveAsset('to-remove', { id: 'asset-one', data: 'hello' });
  await store.removePackage('to-remove');
  assert.equal(await store.getPackage('to-remove'), undefined);
  assert.equal((await store.listAssets('to-remove')).length, 0);
});

test('unsafe IDs are rejected before touching storage', async () => {
  const store = createStore();
  await assert.rejects(() => store.savePackage({ id: '../escape' }), /invalid/);
  await assert.rejects(() => store.saveAsset('safe', { id: 'bad/name' }), /invalid/);
});
