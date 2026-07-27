import test from 'node:test';
import assert from 'node:assert/strict';

import { friendlyAiError } from '../src/services/aiErrors.js';
import { buildChatRequest, buildChatSystemPrompt } from '../src/apps/ChatApp.js';
import { activeCharacter } from '../src/apps/appData.js';
import {
  isDuplicateMemory,
  parseMemoryCandidate
} from '../src/services/autoMemoryService.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';

test('AI errors are translated into actionable Chinese messages', () => {
  assert.match(friendlyAiError(new Error('401 invalid api key')), /API Key 无效/);
  assert.match(friendlyAiError(new Error('insufficient_quota')), /余额不足/);
  assert.match(friendlyAiError(new Error('model not found')), /没有找到这个模型/);
  assert.equal(friendlyAiError(new DOMException('cancelled', 'AbortError')), '已停止生成。');
});

test('legacy character-index messages migrate to stable character IDs', () => {
  const config = normalizeConfig({
    ...cloneConfig(defaultConfig),
    characters: [{ name: '第二个角色' }],
    apps: {
      ...cloneConfig(defaultConfig).apps,
      chat: {
        ...cloneConfig(defaultConfig).apps.chat,
        messages: [
          { id: 'one', characterId: 'character-0', from: 'user', text: '主角色' },
          { id: 'two', characterId: 'character-1', from: 'user', text: '第二角色' }
        ]
      }
    }
  });

  assert.equal(config.apps.chat.messages[0].characterId, config.character.id);
  assert.equal(config.apps.chat.messages[1].characterId, config.characters[0].id);
  assert.notEqual(config.character.id, config.characters[0].id);
});

test('chat request uses the character provider and never contains an API key', () => {
  const config = cloneConfig(defaultConfig);
  config.aiProviders.activeId = 'deepseek';
  config.character.aiProviderId = 'volcengine';
  config.apps.settings.perRoleApi = true;
  const messages = Array.from({ length: 24 }, (_, index) => ({
    from: index % 2 ? 'character' : 'user',
    text: `消息 ${index}`
  }));

  const request = buildChatRequest(config, config.character, messages);
  assert.equal(request.providerId, 'volcengine');
  assert.equal(request.profileId, 'role-character-main');
  assert.equal(request.messages.length, 20);
  assert.equal(JSON.stringify(request).includes('apiKey'), false);
  assert.match(request.system, new RegExp(config.character.name));
});

test('active character and memories stay isolated by stable character ID', () => {
  const config = normalizeConfig({
    ...cloneConfig(defaultConfig),
    characters: [{
      ...cloneConfig(defaultConfig).character,
      id: 'character-second',
      name: '第二角色',
      aiProviderId: 'volcengine'
    }],
    apps: {
      ...cloneConfig(defaultConfig).apps,
      character: {
        ...cloneConfig(defaultConfig).apps.character,
        activeCharacterId: 'character-second'
      },
      memory: {
        ...cloneConfig(defaultConfig).apps.memory,
        enabled: true,
        longTerm: true,
        entries: [
          { id: 'main-memory', title: '主角色记忆', content: '只给主角色', type: 'event' },
          {
            id: 'second-memory',
            characterId: 'character-second',
            title: '第二角色记忆',
            content: '只给第二角色',
            type: 'event'
          }
        ]
      }
    }
  });

  const second = activeCharacter(config);
  assert.equal(second.id, 'character-second');
  assert.equal(config.apps.memory.entries[0].characterId, config.character.id);
  assert.match(buildChatSystemPrompt(config, second), /只给第二角色/);
  assert.doesNotMatch(buildChatSystemPrompt(config, second), /只给主角色/);
  assert.match(buildChatSystemPrompt(config, config.character), /只给主角色/);
  assert.doesNotMatch(buildChatSystemPrompt(config, config.character), /只给第二角色/);
});

test('automatic memory accepts valid JSON, rejects noise, and deduplicates per character', () => {
  const candidate = parseMemoryCandidate('```json\n{"shouldSave":true,"type":"preferences","title":"饮品偏好","content":"用户喜欢无糖拿铁"}\n```');
  assert.deepEqual(candidate, {
    type: 'preferences',
    title: '饮品偏好',
    content: '用户喜欢无糖拿铁'
  });
  assert.equal(parseMemoryCandidate('{"shouldSave":false}'), null);
  assert.equal(parseMemoryCandidate('这不是 JSON'), null);

  const entries = [{
    characterId: 'character-main',
    type: 'preferences',
    title: '饮品偏好',
    content: '用户喜欢无糖拿铁'
  }];
  assert.equal(isDuplicateMemory(entries, candidate, 'character-main'), true);
  assert.equal(isDuplicateMemory(entries, candidate, 'character-second'), false);
});
