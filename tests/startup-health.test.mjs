import test from 'node:test';
import assert from 'node:assert/strict';

import { checkStartupHealth } from '../src/services/startupHealthService.js';

const config = {
  apps: {
    music: { enabled: true }
  }
};

test('startup health reports available local services and storage', async () => {
  const health = await checkStartupHealth(config, { state: 'saved' }, {
    online: true,
    checkAi: async () => ({ providers: [] }),
    checkMusic: async () => ({ authenticated: true })
  });

  assert.equal(health.storage.status, 'ok');
  assert.equal(health.network.status, 'ok');
  assert.equal(health.ai.status, 'ok');
  assert.equal(health.music.status, 'ok');
});

test('startup health exposes problems independently', async () => {
  const health = await checkStartupHealth(config, {
    state: 'error',
    message: '保存失败'
  }, {
    online: false,
    checkAi: async () => {
      throw new Error('offline');
    },
    checkMusic: async () => ({ authenticated: false })
  });

  assert.equal(health.storage.status, 'error');
  assert.equal(health.network.status, 'error');
  assert.equal(health.ai.status, 'error');
  assert.equal(health.music.status, 'warning');
});
