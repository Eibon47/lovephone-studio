import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { collectPhoneNotifications } from '../src/services/phoneNotificationService.js';

test('notification center combines only existing daily companion events', () => {
  const config = cloneConfig(defaultConfig);
  const date = new Date(2026, 7, 6);
  config.apps.goodnight.greetings = [{
    id: 'greeting-1', date: '2026-08-06', characterId: config.character.id,
    characterName: config.character.name, message: '早上好', createdAt: '2026-08-06T08:00:00'
  }];
  config.apps.diary.entries = [{ id: 'diary-1', date: '2026-08-06', title: '今天散步' }];
  const notices = collectPhoneNotifications(config, date);
  assert.equal(notices.length, 2);
  assert.deepEqual(notices.map(item => item.appId).sort(), ['chat', 'diary']);
});
