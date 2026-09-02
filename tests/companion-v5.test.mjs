import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';
import { markChatSessionRead, unreadCountForSession, pagedSessionMessages } from '../src/services/chatSessionService.js';
import { processDueProactiveTasks } from '../src/services/proactiveCompanionService.js';
import { recordCompanionEvent } from '../src/services/companionEventService.js';
import { retrieveRelevantMemories } from '../src/services/memoryRetrievalService.js';
import { createCharacterPackage, importCharacterPackage, parseCharacterPackage } from '../src/services/characterPackageService.js';

function config() {
  return normalizeConfig(cloneConfig(defaultConfig));
}

test('v6 defaults keep every cross-App integration off', () => {
  const phone = config();
  assert.equal(phone.version, 6);
  assert.deepEqual(phone.companion.integrations, {
    musicContext: false,
    diaryCompanion: false,
    anniversaryCompanion: false,
    moodAwareGreetings: false,
    relationshipDesktop: false
  });
});

test('duplicate role IDs are repaired without copying the first role data', () => {
  const phone = normalizeConfig({
    character: { id: 'same-role', name: '一号' },
    characters: [{ id: 'same-role', name: '二号' }],
    apps: { chat: { messages: [{ id: 'm1', characterId: 'same-role', from: 'user', text: '私密消息' }] } }
  });
  assert.equal(phone.character.id, 'same-role');
  assert.notEqual(phone.characters[0].id, 'same-role');
  assert.equal(phone.apps.chat.messages[0].characterId, 'same-role');
  assert.equal(phone.apps.chat.messages.some(item => item.characterId === phone.characters[0].id), false);
  assert.equal(phone.meta.characterIdRepairs.length, 1);
});

test('chat unread state and 50-message pagination stay session scoped', () => {
  const phone = config();
  const session = phone.apps.chat.sessions[0];
  phone.apps.chat.messages = Array.from({ length: 120 }, (_, index) => ({
    id: `m-${index}`, characterId: phone.character.id, sessionId: session.id,
    from: index % 2 ? 'character' : 'user', text: String(index), createdAt: new Date(1700000000000 + index * 1000).toISOString()
  }));
  phone.apps.chat.sessions[0].lastReadAt = new Date(1700000000000).toISOString();
  assert.equal(unreadCountForSession(phone.apps.chat, session.id), 60);
  assert.equal(pagedSessionMessages(phone.apps.chat, phone.character.id, session.id, 1).messages.length, 50);
  assert.equal(pagedSessionMessages(phone.apps.chat, phone.character.id, session.id, 2).messages.length, 100);
  const read = markChatSessionRead(phone.apps.chat, session.id, new Date(1800000000000).toISOString());
  assert.equal(unreadCountForSession(read, session.id), 0);
});

test('quiet hours defer proactive work and expired tasks never send', () => {
  const phone = config();
  phone.companion.proactive.defaults.quietHours = { enabled: true, start: '23:00', end: '08:00' };
  phone.companion.tasks = [{
    id: 'quiet', characterId: phone.character.id, type: 'emotion-follow-up', status: 'pending',
    dueAt: '2026-08-26T15:10:00.000Z', createdAt: '2026-08-26T15:00:00.000Z', expiresAt: '2026-08-27T03:00:00.000Z', payload: {}
  }, {
    id: 'expired', characterId: phone.character.id, type: 'emotion-follow-up', status: 'pending',
    dueAt: '2026-08-25T01:00:00.000Z', createdAt: '2026-08-25T00:00:00.000Z', expiresAt: '2026-08-25T12:00:00.000Z', payload: {}
  }];
  const result = processDueProactiveTasks(phone, '2026-08-26T16:00:00.000Z');
  assert.equal(result.config.companion.tasks.find(item => item.id === 'quiet').status, 'pending');
  assert.equal(result.config.companion.tasks.find(item => item.id === 'expired').status, 'expired');
  assert.equal(result.executed.length, 0);
});

test('unanswered proactive messages suppress ordinary follow-ups but not anniversary reminders', () => {
  const phone = config();
  const session = phone.apps.chat.sessions[0];
  phone.apps.chat.messages = [{ id: 'old-proactive', characterId: phone.character.id, sessionId: session.id, from: 'character', text: '在吗', proactive: true, createdAt: '2026-08-26T08:00:00.000Z' }];
  phone.companion.tasks = [{ id: 'ordinary', characterId: phone.character.id, type: 'emotion-follow-up', status: 'pending', dueAt: '2026-08-26T09:00:00.000Z', createdAt: '2026-08-26T08:30:00.000Z', expiresAt: '2026-08-26T20:00:00.000Z', payload: {} },
    { id: 'date', characterId: phone.character.id, type: 'anniversary-reminder', status: 'pending', dueAt: '2026-08-26T09:00:00.000Z', createdAt: '2026-08-26T08:30:00.000Z', expiresAt: '2026-08-26T15:59:59.999Z', payload: { title: '纪念日', date: '2026-08-26' } }];
  const result = processDueProactiveTasks(phone, '2026-08-26T09:05:00.000Z');
  assert.equal(result.config.companion.tasks.find(item => item.id === 'ordinary').status, 'pending');
  assert.equal(result.config.companion.tasks.find(item => item.id === 'date').status, 'completed');
});

test('local memory retrieval is role scoped, expiry aware and relevance ranked', () => {
  const entries = [
    { id: 'cat', characterId: 'a', title: '喜欢猫咪', content: '最喜欢橘猫', importance: 5, keywords: ['猫咪', '橘猫'] },
    { id: 'expired', characterId: 'a', title: '旧咖啡', content: '喜欢拿铁', importance: 5, expiresAt: '2020-01-01' },
    { id: 'other', characterId: 'b', title: '别人的猫', content: '暹罗猫', importance: 5 }
  ];
  const result = retrieveRelevantMemories(entries, { characterId: 'a', query: '今天看到一只橘猫', now: '2026-08-26' });
  assert.deepEqual(result.map(item => item.id), ['cat']);
});

test('unauthorized diary events create no companion data', () => {
  const phone = config();
  phone.apps.diary.enabled = true;
  phone.companion = recordCompanionEvent(phone, { type: 'diary.entry.saved', characterId: phone.character.id, sourceApp: 'diary', sourceId: 'd1', payload: { title: '日记', content: '内容' } });
  assert.equal(phone.companion.events.length, 0);
  phone.companion.integrations.diaryCompanion = true;
  phone.companion = recordCompanionEvent(phone, { type: 'diary.entry.saved', characterId: phone.character.id, sourceApp: 'diary', sourceId: 'd1', payload: { title: '日记', content: '内容' } });
  assert.equal(phone.companion.events.length, 1);
});

test('role packages exclude credentials and import conflicts as a new role', () => {
  const phone = config();
  phone.character.aiProfiles.deepseek = { model: 'deepseek-chat', baseUrl: 'https://example.com', apiKey: 'secret' };
  const payload = createCharacterPackage(phone, phone.character.id, { chat: true });
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('secret'), false);
  const parsed = parseCharacterPackage(serialized);
  const imported = importCharacterPackage(phone, parsed);
  assert.notEqual(imported.characters.at(-1).id, phone.character.id);
  assert.equal(imported.characters.at(-1).name, phone.character.name);
});
