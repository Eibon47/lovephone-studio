import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig } from '../src/config/schema.js';
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

  assert.equal(migrated.version, 4);
  assert.equal(migrated.apps.memory.enabled, true);
  assert.equal(migrated.apps.diary.enabled, true);
  assert.equal(migrated.apps.anniversary.enabled, false);
  assert.equal(migrated.apps.memory.entries[0].content, '不要忘记这条记忆');
  assert.equal(migrated.apps.diary.entries[0].title, '旧日记');
  assert.equal(migrated.theme.customization.version, CUSTOMIZATION_VERSION);
  assert.equal(migrated.theme.customization.desktop.columns, 4);
});
