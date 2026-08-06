import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import {
  characterPresence,
  latestCharacterGreeting
} from '../src/services/characterPresenceService.js';

test('character presence uses only the active role greeting for today', () => {
  const config = cloneConfig(defaultConfig);
  config.apps.goodnight.greetings = [{
    id: 'morning-main',
    date: new Date().toISOString().slice(0, 10),
    characterId: config.character.id,
    message: '今天也会陪着你。',
    createdAt: new Date().toISOString()
  }];

  assert.equal(latestCharacterGreeting(config, config.character.id)?.message, '今天也会陪着你。');
  assert.equal(characterPresence(config, config.character).label, '给你留了问候');
});

test('current conversation takes precedence over passive presence', () => {
  const config = cloneConfig(defaultConfig);
  const presence = characterPresence(config, config.character, {
    chatView: 'conversation',
    chatCharacterId: config.character.id
  });
  assert.equal(presence.label, '正在和你聊天');
});
