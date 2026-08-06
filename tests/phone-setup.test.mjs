import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import {
  normalizePhoneSetup,
  phoneSetupProgress,
  shouldShowPhoneSetup
} from '../src/services/phoneSetupService.js';

test('phone setup has stable defaults for old configurations', () => {
  assert.deepEqual(normalizePhoneSetup(), {
    dismissed: false,
    completed: { character: false, ai: false, backup: false }
  });
});

test('phone setup requires a real AI connection instead of only a model name', () => {
  const config = cloneConfig(defaultConfig);
  config.aiProviders.profiles.deepseek.model = 'deepseek-chat';
  const progress = phoneSetupProgress(config, { storageStatus: { backupCount: 1 } });

  assert.equal(progress.completed.ai, false);
  assert.equal(progress.completed.backup, true);
  assert.equal(progress.completedCount, 1);
  assert.equal(shouldShowPhoneSetup(config, { storageStatus: { backupCount: 1 } }), true);

  const connected = phoneSetupProgress(config, {
    storageStatus: { backupCount: 1 },
    aiProviderStatuses: { deepseek: { configured: true } }
  });
  assert.equal(connected.completed.ai, true);
});

test('dismissed or fully completed setup no longer appears', () => {
  const config = cloneConfig(defaultConfig);
  config.meta.phoneSetup.dismissed = true;
  assert.equal(shouldShowPhoneSetup(config), false);

  config.meta.phoneSetup.dismissed = false;
  config.meta.phoneSetup.completed = { character: true, ai: true, backup: true };
  assert.equal(shouldShowPhoneSetup(config), false);
});
