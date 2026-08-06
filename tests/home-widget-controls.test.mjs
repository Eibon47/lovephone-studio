import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig } from '../src/config/defaultConfig.js';
import { renderHomeScreen } from '../src/system/HomeScreen.js';

test('vinyl widget remains available in the mobile-ready music runtime', () => {
  const config = cloneConfig();
  config.theme.widgets.vinyl.enabled = true;

  const phoneRuntime = renderHomeScreen(config, {
    currentApp: 'home',
    runtimeCapabilities: { experimentalMusic: true }
  });
  const desktopRuntime = renderHomeScreen(config, {
    currentApp: 'home',
    runtimeCapabilities: { experimentalMusic: false }
  });

  assert.match(phoneRuntime, /data-widget-dismiss="vinyl"/);
  assert.match(desktopRuntime, /desktop-widget-vinyl/);
});

test('role widgets keep companion content scoped to the active character', () => {
  const config = cloneConfig();
  config.characters = [{ ...config.character, id: 'character-second', name: 'Second role' }];
  config.apps.character.activeCharacterId = 'character-second';
  config.theme.widgets.dailyNote.enabled = true;
  config.theme.widgets.mood.enabled = true;
  config.apps.goodnight.entries = [
    { characterId: config.character.id, message: 'main role note' },
    { characterId: 'character-second', message: 'second role note' }
  ];
  config.apps.diary.entries = [
    { characterId: config.character.id, moodScore: 90 },
    { characterId: 'character-second', moodScore: 20 }
  ];

  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.match(html, /second role note/);
  assert.doesNotMatch(html, /main role note/);
  assert.match(html, /--mood:20%/);
  assert.doesNotMatch(html, /--mood:90%/);
});
