import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyChatMessageUpdate,
  activeChatSession,
  defaultChatSessionId,
  ensureCharacterChatSession,
  messagesForSession,
  normalizeChatSessionData,
  replaceSessionMessages
} from '../src/services/chatSessionService.js';

test('a newly created character receives a usable default chat session immediately', () => {
  const chat = ensureCharacterChatSession({
    sessions: [],
    activeSessionIds: {},
    messages: []
  }, 'character-new', '2026-07-24T10:00:00.000Z');
  assert.equal(chat.sessions.length, 1);
  assert.equal(chat.sessions[0].characterId, 'character-new');
  assert.equal(chat.activeSessionIds['character-new'], chat.sessions[0].id);
  assert.equal(activeChatSession(chat, 'character-new')?.id, chat.sessions[0].id);
});

test('legacy messages migrate into one stable default session per character', () => {
  const migrated = normalizeChatSessionData({
    messages: [
      { id: 'one', characterId: 'character-main', text: '主角色' },
      { id: 'two', characterId: 'character-second', text: '第二角色' }
    ]
  }, ['character-main', 'character-second'], '2026-07-24T00:00:00.000Z');

  assert.equal(migrated.sessions.length, 2);
  assert.equal(migrated.messages[0].sessionId, defaultChatSessionId('character-main'));
  assert.equal(migrated.messages[1].sessionId, defaultChatSessionId('character-second'));
  assert.equal(activeChatSession(migrated, 'character-second').characterId, 'character-second');
});

test('history-off messages stay ephemeral and never enter persisted chat data', () => {
  const chat = normalizeChatSessionData({}, ['character-main'], '2026-07-24T00:00:00.000Z');
  const sessionId = activeChatSession(chat, 'character-main').id;
  const update = applyChatMessageUpdate(chat, {
    characterId: 'character-main',
    sessionId,
    messages: [{ id: 'private', from: 'user', text: '不要保存' }],
    persist: false
  });

  assert.equal(update.persisted, false);
  assert.equal(update.chat.messages.length, 0);
  assert.equal(update.ephemeralMessages[sessionId][0].text, '不要保存');
});

test('history-on messages persist only to the selected session and name it', () => {
  const chat = normalizeChatSessionData({}, ['character-main'], '2026-07-24T00:00:00.000Z');
  const sessionId = activeChatSession(chat, 'character-main').id;
  const update = applyChatMessageUpdate(chat, {
    characterId: 'character-main',
    sessionId,
    messages: [{ id: 'saved', from: 'user', text: '这是新的会话标题和消息' }],
    persist: true,
    now: '2026-07-24T01:00:00.000Z'
  });

  assert.equal(update.persisted, true);
  assert.equal(update.chat.messages[0].sessionId, sessionId);
  assert.equal(update.chat.sessions[0].title, '这是新的会话标题和消息'.slice(0, 18));
});

test('chat drafts survive normalization because they belong to the user, not the model', async () => {
  const { normalizeConfig } = await import('../src/config/schema.js');
  const { cloneConfig, defaultConfig } = await import('../src/config/defaultConfig.js');
  const source = cloneConfig(defaultConfig);
  source.apps.chat.drafts = { 'session-character-main-main': '还没发出去的话' };
  const normalized = normalizeConfig(source);
  assert.equal(normalized.apps.chat.drafts['session-character-main-main'], '还没发出去的话');
});

test('session message replacement never touches another role or conversation', () => {
  const chat = normalizeChatSessionData({
    sessions: [
      { id: 'session-main-one', characterId: 'character-main', title: '一' },
      { id: 'session-main-two', characterId: 'character-main', title: '二' }
    ],
    activeSessionIds: { 'character-main': 'session-main-one' },
    messages: [
      { id: 'one', characterId: 'character-main', sessionId: 'session-main-one', text: '旧消息' },
      { id: 'two', characterId: 'character-main', sessionId: 'session-main-two', text: '保留消息' }
    ]
  }, ['character-main'], '2026-07-24T00:00:00.000Z');

  const messages = replaceSessionMessages(
    chat,
    'character-main',
    'session-main-one',
    [{ id: 'three', text: '新消息' }]
  );
  assert.deepEqual(
    messagesForSession({ ...chat, messages }, 'character-main', 'session-main-one').map(item => item.id),
    ['three']
  );
  assert.deepEqual(
    messagesForSession({ ...chat, messages }, 'character-main', 'session-main-two').map(item => item.id),
    ['two']
  );
});
