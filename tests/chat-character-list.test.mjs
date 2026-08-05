import test from 'node:test';
import assert from 'node:assert/strict';

import { ChatApp, resolveChatCharacter } from '../src/apps/ChatApp.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';

function makeConfig() {
  const source = cloneConfig(defaultConfig);
  source.character = {
    ...source.character,
    id: 'character-main',
    name: '主角色'
  };
  source.characters = [{
    ...source.character,
    id: 'character-second',
    name: '第二角色',
    greeting: '第二角色的开场白'
  }];
  source.apps.character.activeCharacterId = 'character-main';
  return normalizeConfig(source);
}

const chatApp = { id: 'chat', name: '聊天' };

test('opening chat renders a character list before any conversation', () => {
  const config = makeConfig();
  const html = ChatApp.render(chatApp, config, { chatView: 'list' });

  assert.match(html, /data-chat-character="character-main"/);
  assert.match(html, /data-chat-character="character-second"/);
  assert.match(html, /主角色/);
  assert.match(html, /第二角色/);
  assert.doesNotMatch(html, /data-chat-form/);
});

test('chat character selection is independent from the Character App selection', () => {
  const config = makeConfig();
  config.apps.character.activeCharacterId = 'character-main';

  const selected = resolveChatCharacter(config, {
    selectedCharacterId: 'character-main',
    chatCharacterId: 'character-second'
  });

  assert.equal(selected.id, 'character-second');
});

test('selecting a character renders that character conversation', () => {
  const config = makeConfig();
  const html = ChatApp.render(chatApp, config, {
    chatView: 'conversation',
    chatCharacterId: 'character-second'
  });

  assert.match(html, /第二角色/);
  assert.match(html, /第二角色的开场白/);
  assert.match(html, /data-chat-form/);
  assert.doesNotMatch(html, /data-chat-character="character-main"/);
});

test('chat appearance preview includes both incoming and outgoing sample bubbles', () => {
  const config = makeConfig();
  const html = ChatApp.render(chatApp, config, {
    chatView: 'conversation',
    chatCharacterId: 'character-main',
    chatAppearancePreviewMode: true
  });

  assert.match(html, /chat-message-row is-character/);
  assert.match(html, /chat-message-row is-user/);
  assert.match(html, /今天想和你待一会儿/);
  assert.doesNotMatch(html, /data-chat-delete="appearance-preview/);
});
