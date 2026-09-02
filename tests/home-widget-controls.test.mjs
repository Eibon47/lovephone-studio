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

test('role widgets keep mood content scoped to the active character', () => {
  const config = cloneConfig();
  config.characters = [{ ...config.character, id: 'character-second', name: 'Second role' }];
  config.apps.character.activeCharacterId = 'character-second';
  config.theme.widgets.mood.enabled = true;
  config.apps.diary.entries = [
    { characterId: config.character.id, moodScore: 90 },
    { characterId: 'character-second', moodScore: 20 }
  ];

  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.match(html, /--mood:20%/);
  assert.doesNotMatch(html, /--mood:90%/);
});

test('removed daily note widget never returns from legacy configuration', () => {
  const config = cloneConfig();
  config.theme.widgets.dailyNote = {
    enabled: true,
    text: 'legacy companion note',
    layout: { x: 0, y: 0, w: 4, h: 2 }
  };
  config.theme.customization.widgets.push({
    id: 'builtin-dailyNote',
    kind: 'composition',
    name: '今日陪伴语',
    elements: []
  });

  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.doesNotMatch(html, /legacy companion note|builtin-dailyNote|今日陪伴语/);
});

test('uploaded App icons are marked for shape clipping while preset icons keep their inset', () => {
  const config = cloneConfig();
  config.theme.appLooks.chat = {
    uiTheme: 'lovephone',
    icon: { mode: 'upload', value: 'data:image/png;base64,Y3VzdG9tLWljb24=' }
  };

  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.match(html, /phone-app-icon is-uploaded/);
  assert.match(html, /phone-app-icon"><img src="assets\/theme-fantasy/);
});

test('dock Apps are not duplicated in the desktop grid', () => {
  const config = cloneConfig();
  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.doesNotMatch(html, /data-app-layout-id="chat"/);
  assert.match(html, /class="phone-dock"/);
  assert.match(html, /data-open-app="chat"/);
});

test('widgets that do not fit are moved to a second fixed desktop page', () => {
  const config = cloneConfig();
  config.theme.customization.widgets = [
    {
      id: 'page-one-widget',
      enabled: true,
      kind: 'composition',
      name: '第一页',
      layout: { x: 0, y: 0, w: 12, h: 20 },
      canvas: {},
      elements: []
    },
    {
      id: 'page-two-widget',
      enabled: true,
      kind: 'composition',
      name: '第二页',
      layout: { x: 0, y: 20, w: 12, h: 20 },
      canvas: {},
      elements: []
    },
    {
      id: 'page-three-widget',
      enabled: true,
      kind: 'composition',
      name: '溢出组件',
      layout: { x: 0, y: 40, w: 12, h: 20 },
      canvas: {},
      elements: []
    }
  ];

  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.match(html, /data-desktop-widget-page="0"/);
  assert.match(html, /data-desktop-widget-page="1"/);
  assert.match(html, /data-desktop-page-dot="1"/);
});

test('non-dock App icons can be placed and restored on the second desktop page', () => {
  const config = cloneConfig();
  config.apps.diary.enabled = true;
  config.theme.appLayouts.diary = { x: 0, y: 52, w: 3, h: 6 };

  const html = renderHomeScreen(config, { currentApp: 'home' });
  assert.match(html, /data-desktop-widget-page="1"[\s\S]*data-app-layout-id="diary"/);
});
