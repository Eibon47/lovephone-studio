import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';
import {
  recordCompanionEvent,
  removeCompanionSource,
  resolveMemoryCandidate
} from '../src/services/companionEventService.js';
import { purgeCharacterData } from '../src/services/characterDataService.js';
import { MemoryApp } from '../src/apps/MemoryApp.js';
import { buildChatSystemPrompt } from '../src/apps/ChatApp.js';
import {
  markAllCompanionNotificationsRead,
  markCompanionNotificationRead,
  processDueProactiveTasks
} from '../src/services/proactiveCompanionService.js';

function phone() {
  const config = cloneConfig(defaultConfig);
  config.characters = [{ ...config.character, id: 'character-two', name: '小秋' }];
  const normalized = normalizeConfig(config);
  normalized.companion.integrations = {
    musicContext: true,
    diaryCompanion: true,
    anniversaryCompanion: true,
    moodAwareGreetings: true,
    relationshipDesktop: true
  };
  normalized.apps.diary.enabled = true;
  normalized.apps.anniversary.enabled = true;
  normalized.apps.music.enabled = true;
  return normalized;
}

test('old phones gain an empty unified companion event state', () => {
  const config = normalizeConfig({ character: { id: 'character-main' } });
  assert.deepEqual(config.companion.events, []);
  assert.deepEqual(config.companion.memoryCandidates, []);
  assert.deepEqual(config.companion.relationshipSignals, {});
  assert.deepEqual(config.companion.tasks, []);
  assert.deepEqual(config.companion.notifications, []);
});

test('diary events are deduplicated and projected for only one character', () => {
  const config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'diary.entry.saved', characterId: 'character-two', sourceApp: 'diary',
    sourceId: 'diary-1', dedupeKey: 'diary:character-two:diary-1',
    payload: { title: '第一版', content: '今天下雨了。' }
  });
  config.companion = recordCompanionEvent(config, {
    type: 'diary.entry.saved', characterId: 'character-two', sourceApp: 'diary',
    sourceId: 'diary-1', dedupeKey: 'diary:character-two:diary-1',
    payload: { title: '修改后', content: '今天下雨了，但心情不错。' }
  });
  assert.equal(config.companion.events.length, 1);
  assert.equal(config.companion.timeline.length, 1);
  assert.equal(config.companion.timeline[0].characterId, 'character-two');
  assert.match(config.companion.timeline[0].title, /修改后/);
  assert.equal(config.companion.memoryCandidates[0].characterId, 'character-two');
});

test('an emotional chat creates a follow-up and the next reply addresses it', () => {
  const config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'chat.user_message.sent', characterId: 'character-main', sourceApp: 'chat',
    sourceId: 'message-1', payload: { text: '今天真的很累，还有一点焦虑。' }
  });
  assert.equal(config.companion.followUps.length, 1);
  assert.equal(config.companion.tasks.length, 1);
  assert.equal(config.companion.tasks[0].type, 'emotion-follow-up');
  assert.equal(config.companion.followUps[0].addressedAt, '');
  assert.match(buildChatSystemPrompt(config, config.character), /近期|最近|延续关心/);
  config.companion = recordCompanionEvent(config, {
    type: 'chat.character_message.completed', characterId: 'character-main', sourceApp: 'chat',
    sourceId: 'message-2', payload: { text: '先休息一下，我在。' }
  });
  assert.ok(config.companion.followUps[0].addressedAt);
  assert.equal(config.companion.relationshipSignals['character-main'].interactionCount, 2);
});

test('history-off chat never creates a proactive task', () => {
  const config = phone();
  config.apps.chat.history = false;
  config.companion = recordCompanionEvent(config, {
    type: 'chat.user_message.sent', characterId: 'character-main', sourceApp: 'chat',
    sourceId: 'private-message', payload: { text: '今天很难过，但不要保存。' }
  });
  assert.equal(config.companion.tasks.length, 0);
});

test('a due proactive task writes one role-scoped message and one unread notification', () => {
  let config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'chat.user_message.sent', characterId: 'character-two', sourceApp: 'chat',
    sourceId: 'message-due', occurredAt: '2026-08-26T08:00:00.000Z',
    payload: { text: '今天特别累，想先安静一下。' }
  });
  const result = processDueProactiveTasks(config, '2026-08-26T09:00:00.000Z');
  config = result.config;
  assert.equal(result.executed.length, 1);
  assert.equal(config.companion.tasks[0].status, 'completed');
  assert.equal(config.companion.notifications.length, 1);
  assert.equal(config.companion.notifications[0].readAt, '');
  const message = config.apps.chat.messages.find(item => item.taskId === config.companion.tasks[0].id);
  assert.equal(message.characterId, 'character-two');
  assert.match(message.text, /累|看看你/);

  const repeated = processDueProactiveTasks(config, '2026-08-26T10:00:00.000Z');
  assert.equal(repeated.changed, false);
  assert.equal(repeated.config.apps.chat.messages.filter(item => item.proactive).length, 1);
});

test('AI-generated proactive messages keep an AI source while local fallbacks remain retryable', () => {
  let config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'diary.entry.saved', characterId: 'character-main', sourceApp: 'diary',
    sourceId: 'diary-ai', occurredAt: '2026-08-26T08:00:00.000Z',
    payload: { title: '今天', content: '写了一点事情。' }
  });
  const taskId = config.companion.tasks[0].id;
  config = processDueProactiveTasks(config, '2026-08-26T09:00:00.000Z', {
    messageOverrides: { [taskId]: '这是模型生成的主动回应。' }
  }).config;
  const message = config.apps.chat.messages.find(item => item.taskId === taskId);
  assert.equal(message.providerId, 'ai-proactive');
  assert.equal(message.text, '这是模型生成的主动回应。');
});

test('scheduled greeting preserves its original provider without another model call', () => {
  let config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'greeting.generated', characterId: 'character-main', sourceApp: 'goodnight',
    sourceId: 'greeting-one', occurredAt: '2026-08-26T08:00:00.000Z',
    payload: { period: 'morning', message: '早上好，今天慢慢来。', providerId: 'deepseek' }
  });
  config = processDueProactiveTasks(config, '2026-08-26T08:01:00.000Z').config;
  const message = config.apps.chat.messages.find(item => item.proactiveType === 'morning-greeting');
  assert.equal(message.providerId, 'deepseek');
  assert.equal(message.text, '早上好，今天慢慢来。');
});

test('turning chat history off cancels pending proactive work without writing messages', () => {
  let config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'chat.user_message.sent', characterId: 'character-main', sourceApp: 'chat',
    sourceId: 'cancel-me', occurredAt: '2026-08-26T08:00:00.000Z',
    payload: { text: '今天有点难过。' }
  });
  config.apps.chat.history = false;
  const result = processDueProactiveTasks(config, '2026-08-26T09:00:00.000Z');
  assert.equal(result.config.companion.tasks[0].status, 'cancelled');
  assert.equal(result.config.apps.chat.messages.length, 0);
  assert.equal(result.config.companion.notifications.length, 0);
});

test('proactive notifications can be read individually or all at once', () => {
  let config = phone();
  config.companion.notifications = [
    { id: 'notice-one', characterId: 'character-main', appId: 'chat', title: '一', body: '一', createdAt: '2026-08-26T08:00:00.000Z', readAt: '' },
    { id: 'notice-two', characterId: 'character-two', appId: 'chat', title: '二', body: '二', createdAt: '2026-08-26T08:01:00.000Z', readAt: '' }
  ];
  config = markCompanionNotificationRead(config, 'notice-one', '2026-08-26T09:00:00.000Z');
  assert.ok(config.companion.notifications[0].readAt);
  assert.equal(config.companion.notifications[1].readAt, '');
  config = markAllCompanionNotificationsRead(config, '2026-08-26T09:01:00.000Z');
  assert.ok(config.companion.notifications.every(item => item.readAt));
});

test('memory App shows pending suggestions and the role relationship timeline', () => {
  const config = phone();
  config.apps.memory.enabled = true;
  config.companion = recordCompanionEvent(config, {
    type: 'diary.entry.saved', characterId: 'character-main', sourceApp: 'diary',
    sourceId: 'diary-visible', payload: { title: '海边散步', content: '今天一起看了很久的海。' }
  });
  const html = MemoryApp.render({ name: '记忆' }, config, {});
  assert.match(html, /待确认记忆/);
  assert.match(html, /海边散步/);
  assert.match(html, /最近经历/);
  assert.match(html, /data-memory-candidate-accept/);
});

test('memory candidates require an explicit accept and cannot be accepted twice', () => {
  const config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'anniversary.event.saved', characterId: 'character-main', sourceApp: 'anniversary',
    sourceId: 'date-1', payload: { title: '第一次见面', date: '2026-08-20', yearly: true }
  });
  const candidate = config.companion.memoryCandidates[0];
  const accepted = resolveMemoryCandidate(config, candidate.id, 'accepted');
  config.companion = accepted.companion;
  assert.equal(accepted.memoryEntry.characterId, 'character-main');
  assert.equal(config.companion.memoryCandidates[0].status, 'accepted');
  assert.equal(resolveMemoryCandidate(config, candidate.id, 'accepted').memoryEntry, null);
});

test('deleting a source removes its event and every derived projection', () => {
  const config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'diary.entry.saved', characterId: 'character-main', sourceApp: 'diary',
    sourceId: 'diary-delete', payload: { title: '要删除', content: '这条会被清理。' }
  });
  config.companion = removeCompanionSource(config, 'diary', 'diary-delete');
  assert.equal(config.companion.events.length, 0);
  assert.equal(config.companion.timeline.length, 0);
  assert.equal(config.companion.memoryCandidates.length, 0);
});

test('deleting a character removes its events, timeline, candidates and relationship signal', () => {
  const config = phone();
  config.companion = recordCompanionEvent(config, {
    type: 'music.track.started', characterId: 'character-two', sourceApp: 'music',
    sourceId: 'song-1', payload: { name: '晚风', artist: '测试歌手' }
  });
  const next = purgeCharacterData(config, 'character-two');
  assert.equal(next.companion.events.length, 0);
  assert.equal(next.companion.timeline.length, 0);
  assert.equal(next.companion.relationshipSignals['character-two'], undefined);
});
