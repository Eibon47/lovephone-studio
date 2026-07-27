import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGreetingRequest,
  findGreeting,
  generateAndStoreGreeting,
  greetingKey,
  greetingPeriodFor,
  greetingProviderId,
  localGreeting
} from '../src/services/greetingService.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';

test('greeting periods use explicit morning and night boundaries', () => {
  const at = hour => new Date(2026, 6, 24, hour, 0, 0);
  assert.equal(greetingPeriodFor(at(4)), null);
  assert.equal(greetingPeriodFor(at(5)), 'morning');
  assert.equal(greetingPeriodFor(at(11)), 'morning');
  assert.equal(greetingPeriodFor(at(12)), null);
  assert.equal(greetingPeriodFor(at(19)), null);
  assert.equal(greetingPeriodFor(at(20)), 'night');
  assert.equal(greetingPeriodFor(at(2)), 'night');
  assert.equal(greetingPeriodFor(at(3)), null);
});

test('greetings are keyed and found independently for each character', () => {
  const config = cloneConfig(defaultConfig);
  config.apps.goodnight.greetings = [{
    key: greetingKey('2026-07-24', 'morning', 'character-main'),
    date: '2026-07-24',
    period: 'morning',
    characterId: 'character-main',
    message: '主角色早安'
  }, {
    key: greetingKey('2026-07-24', 'morning', 'character-second'),
    date: '2026-07-24',
    period: 'morning',
    characterId: 'character-second',
    message: '第二角色早安'
  }];

  assert.equal(findGreeting(config, {
    date: '2026-07-24',
    period: 'morning',
    characterId: 'character-main'
  }).message, '主角色早安');
  assert.equal(findGreeting(config, {
    date: '2026-07-24',
    period: 'morning',
    characterId: 'character-second'
  }).message, '第二角色早安');
});

test('AI greeting follows the character provider and includes only that role memories', () => {
  const config = cloneConfig(defaultConfig);
  config.apps.settings.perRoleApi = true;
  config.aiProviders.activeId = 'deepseek';
  config.character.aiProviderId = 'volcengine';
  config.apps.memory.entries = [{
    characterId: 'character-main',
    title: '早餐偏好',
    content: '用户喜欢豆浆'
  }, {
    characterId: 'character-second',
    title: '不应出现',
    content: '另一角色的记忆'
  }];

  assert.equal(greetingProviderId(config, config.character), 'volcengine');
  const request = buildGreetingRequest(config, {
    character: config.character,
    period: 'morning',
    date: '2026-07-24'
  });
  assert.equal(request.providerId, 'volcengine');
  assert.equal(request.profileId, 'role-character-main');
  assert.match(request.system, /用户喜欢豆浆/);
  assert.doesNotMatch(request.system, /另一角色的记忆/);
  assert.equal(JSON.stringify(request).includes('apiKey'), false);
  assert.match(localGreeting(config.character, 'night'), /晚安/);
});

test('new greeting configuration survives normalization', () => {
  const config = normalizeConfig({
    ...cloneConfig(defaultConfig),
    apps: {
      ...cloneConfig(defaultConfig).apps,
      goodnight: {
        ...cloneConfig(defaultConfig).apps.goodnight,
        notifications: true,
        greetings: [{ key: 'saved-greeting', message: '已保存' }]
      }
    }
  });
  assert.equal(config.apps.goodnight.notifications, true);
  assert.equal(config.apps.goodnight.greetings[0].message, '已保存');
});

test('local scheduled greeting stores once and reuses the same daily role entry', async () => {
  let config = cloneConfig(defaultConfig);
  config.apps.goodnight.enabled = true;
  config.apps.goodnight.goodMorning = true;
  config.apps.goodnight.aiGenerated = false;
  const handlers = {
    getConfig: () => config,
    updatePhoneState: () => {},
    updatePath: (path, value) => {
      assert.equal(path, 'apps.goodnight.greetings');
      config.apps.goodnight.greetings = value;
    }
  };

  const first = await generateAndStoreGreeting(config, handlers, {}, { period: 'morning' });
  const second = await generateAndStoreGreeting(config, handlers, {}, { period: 'morning' });
  assert.equal(config.apps.goodnight.greetings.length, 1);
  assert.equal(first.id, second.id);
  assert.equal(first.characterId, 'character-main');
  assert.equal(first.source, 'local');
});
