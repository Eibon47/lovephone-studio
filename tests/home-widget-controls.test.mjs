import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig } from '../src/config/defaultConfig.js';
import { renderHomeScreen } from '../src/system/HomeScreen.js';

test('vinyl widget exposes a close control only when experimental music is available', () => {
  const config = cloneConfig();
  config.theme.widgets.vinyl.enabled = true;

  const development = renderHomeScreen(config, {
    currentApp: 'home',
    runtimeCapabilities: { experimentalMusic: true }
  });
  const publicBuild = renderHomeScreen(config, {
    currentApp: 'home',
    runtimeCapabilities: { experimentalMusic: false }
  });

  assert.match(development, /data-widget-dismiss="vinyl"/);
  assert.doesNotMatch(publicBuild, /desktop-widget-vinyl/);
});
