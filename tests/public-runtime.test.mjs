import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig } from '../src/config/defaultConfig.js';
import { getEnabledApps } from '../src/system/appRegistry.js';

test('public runtime keeps browser-native music available', () => {
  const config = cloneConfig();
  const publicApps = getEnabledApps(config, { experimentalMusic: false });
  const developmentApps = getEnabledApps(config, { experimentalMusic: true });

  assert.equal(publicApps.some(app => app.id === 'music'), true);
  assert.equal(developmentApps.some(app => app.id === 'music'), true);
});
