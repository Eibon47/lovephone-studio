import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDiarySummaryRequest,
  diaryProviderId
} from '../src/services/diarySummaryService.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';

test('diary summary follows the active character provider when per-role API is enabled', () => {
  const config = cloneConfig(defaultConfig);
  config.aiProviders.activeId = 'deepseek';
  config.apps.settings.perRoleApi = true;
  const character = {
    ...config.character,
    aiProviderId: 'volcengine'
  };

  assert.equal(diaryProviderId(config, character), 'volcengine');

  const request = buildDiarySummaryRequest(config, {
    character,
    date: '2026-07-24',
    moodLabel: '很好',
    title: '完成了小手机',
    content: '今天把日记功能接上了，虽然有点累，但很开心。'
  });

  assert.equal(request.providerId, 'volcengine');
  assert.equal(request.profileId, 'role-character-main');
  assert.match(request.system, /一到两句话/);
  assert.match(request.messages[0].content, /完成了小手机/);
  assert.match(request.messages[0].content, /有点累，但很开心/);
  assert.equal(JSON.stringify(request).includes('apiKey'), false);
});

test('diary summary falls back to the global provider', () => {
  const config = cloneConfig(defaultConfig);
  config.aiProviders.activeId = 'qwen';
  config.apps.settings.perRoleApi = false;
  const character = {
    ...config.character,
    aiProviderId: 'volcengine'
  };

  assert.equal(diaryProviderId(config, character), 'qwen');
});
