import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig } from '../src/config/schema.js';
import { summarizeImportedConfig } from '../src/storage/localConfigStore.js';
import { CUSTOMIZATION_VERSION } from '../src/services/customizationModel.js';

test('schema upgrades preserve user app choices and content', () => {
  const migrated = normalizeConfig({
    version: 1,
    meta: {
      templateId: 'legacy-template',
      appFlowVersion: 1
    },
    components: {
      memory: true,
      diary: true,
      anniversary: false
    },
    apps: {
      memory: {
        enabled: true,
        entries: [{ id: 'memory-1', content: '不要忘记这条记忆' }]
      },
      diary: {
        enabled: true,
        entries: [{ id: 'diary-1', title: '旧日记' }]
      },
      anniversary: {
        enabled: false
      }
    }
  });

  assert.equal(migrated.version, 6);
  assert.equal(migrated.apps.memory.enabled, true);
  assert.equal(migrated.apps.diary.enabled, true);
  assert.equal(migrated.apps.anniversary.enabled, false);
  assert.equal(migrated.apps.memory.entries[0].content, '不要忘记这条记忆');
  assert.equal(migrated.apps.diary.entries[0].title, '旧日记');
  assert.equal(migrated.theme.customization.version, CUSTOMIZATION_VERSION);
  assert.equal(migrated.theme.customization.desktop.columns, 4);
  assert.equal(migrated.theme.customization.version, 3);
});

test('import summary reports content before an overwrite is confirmed', () => {
  const config = normalizeConfig({
    meta: { title: 'Archive phone' },
    characters: [{ id: 'character-second', name: 'Second' }],
    apps: {
      chat: { messages: [{ id: 'm1' }] },
      memory: { entries: [{ id: 'memory-1' }] },
      diary: { entries: [{ id: 'diary-1' }] }
    }
  });
  assert.deepEqual(summarizeImportedConfig(config), {
    title: 'Archive phone',
    characters: 2,
    enabledApps: 4,
    messages: 1,
    memories: 1,
    diaries: 1
  });
});

test('desktop App icons cannot be pushed below the dock safe area', () => {
  const config = normalizeConfig({
    version: 6,
    theme: { appLayouts: { chat: { x: 99, y: 200, w: 12, h: 40 } } }
  });
  assert.deepEqual(config.theme.appLayouts.chat, { x: 9, y: 200, w: 3, h: 6 });
});
