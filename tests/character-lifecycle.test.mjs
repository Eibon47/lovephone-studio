import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultConfig } from '../src/config/defaultConfig.js';
import { purgeCharacterData } from '../src/services/characterDataService.js';
import {
  enqueueAiProfileDelete,
  flushAiProfileDeletes
} from '../src/services/aiProfileCleanup.js';

test('deleting a character purges every role-scoped data collection', () => {
  const config = structuredClone(defaultConfig);
  const removedId = 'character-second';
  const keptId = config.character.id;
  config.apps.chat.sessions = [
    { id: 'session-kept', characterId: keptId },
    { id: 'session-removed', characterId: removedId }
  ];
  config.apps.chat.activeSessionIds = {
    [keptId]: 'session-kept',
    [removedId]: 'session-removed'
  };
  config.apps.chat.messages = [
    { id: 'kept-chat', characterId: keptId },
    { id: 'removed-chat', characterId: removedId }
  ];
  config.apps.chat.drafts = {
    'session-kept': '保留草稿',
    'session-removed': '删除草稿'
  };
  for (const appId of ['memory', 'diary']) {
    config.apps[appId].entries = [
      { id: `kept-${appId}`, characterId: keptId },
      { id: `removed-${appId}`, characterId: removedId }
    ];
  }
  config.apps.goodnight.entries = [
    { id: 'kept-night', characterId: keptId },
    { id: 'removed-night', characterId: removedId }
  ];
  config.apps.goodnight.greetings = [
    { id: 'kept-greeting', characterId: keptId },
    { id: 'removed-greeting', characterId: removedId }
  ];

  const next = purgeCharacterData(config, removedId);
  assert.deepEqual(next.apps.chat.sessions.map(item => item.id), ['session-kept']);
  assert.deepEqual(next.apps.chat.messages.map(item => item.id), ['kept-chat']);
  assert.equal(next.apps.chat.activeSessionIds[removedId], undefined);
  assert.deepEqual(next.apps.chat.drafts, { 'session-kept': '保留草稿' });
  assert.deepEqual(next.apps.memory.entries.map(item => item.id), ['kept-memory']);
  assert.deepEqual(next.apps.diary.entries.map(item => item.id), ['kept-diary']);
  assert.deepEqual(next.apps.goodnight.entries.map(item => item.id), ['kept-night']);
  assert.deepEqual(next.apps.goodnight.greetings.map(item => item.id), ['kept-greeting']);
});

test('failed AI profile deletion stays queued and retries without a secret', async () => {
  let config = enqueueAiProfileDelete(structuredClone(defaultConfig), 'role-character-second');
  assert.deepEqual(config.aiProviders.pendingProfileDeletes, ['role-character-second']);
  assert.doesNotMatch(JSON.stringify(config), /"apiKey"\s*:/);

  config = await flushAiProfileDeletes(config, async () => {
    throw new Error('bridge offline');
  });
  assert.deepEqual(config.aiProviders.pendingProfileDeletes, ['role-character-second']);

  const removed = [];
  config = await flushAiProfileDeletes(config, async profileId => {
    removed.push(profileId);
  });
  assert.deepEqual(removed, ['role-character-second']);
  assert.deepEqual(config.aiProviders.pendingProfileDeletes, []);
});
