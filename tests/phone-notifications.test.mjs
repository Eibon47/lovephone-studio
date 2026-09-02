import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import {
  collectPhoneNotifications,
  unreadNotificationsForApp,
  unreadPhoneNotificationCount
} from '../src/services/phoneNotificationService.js';
import { renderHomeScreen } from '../src/system/HomeScreen.js';

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

test('persistent proactive notifications expose unread counts and direct chat targets', () => {
  const config = cloneConfig(defaultConfig);
  config.companion.notifications = [{
    id: 'proactive:task-one',
    taskId: 'task-one',
    characterId: config.character.id,
    appId: 'chat',
    title: '小满发来主动消息',
    body: '我来看看你。',
    createdAt: '2026-08-26T09:00:00.000Z',
    readAt: ''
  }];
  assert.equal(unreadPhoneNotificationCount(config), 1);
  assert.equal(unreadNotificationsForApp(config, 'chat'), 1);
  assert.equal(collectPhoneNotifications(config)[0].id, 'proactive:task-one');
  const html = renderHomeScreen(config, { currentApp: 'home', notificationCenterOpen: true });
  assert.match(html, /phone-app-badge/);
  assert.match(html, /data-phone-notice-id="proactive:task-one"/);
  assert.match(html, /aria-label="新消息"/);
  assert.doesNotMatch(html, /全部已读/);
  assert.doesNotMatch(renderHomeScreen(config, { currentApp: 'home', notificationCenterOpen: false }), /aria-label="新消息"/);
});
