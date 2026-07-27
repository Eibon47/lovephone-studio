import test from 'node:test';
import assert from 'node:assert/strict';

import {
  anniversaryMetrics,
  primaryAnniversary,
  syncAnniversaryReminders,
  upcomingAnniversaries
} from '../src/services/anniversaryService.js';
import {
  removeItemWithUndo,
  restoreItemFromUndo
} from '../src/services/listUndo.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { localDateKey } from '../src/apps/appData.js';

test('anniversary metrics handle yearly recurrence and one-time dates', () => {
  const today = new Date(2026, 6, 24);
  const yearly = anniversaryMetrics({ date: '2020-07-26', yearly: true }, today);
  assert.equal(yearly.daysSince, 2189);
  assert.equal(yearly.daysUntil, 2);
  assert.equal(yearly.nextDate, '2026-07-26');

  const oneTimePast = anniversaryMetrics({ date: '2026-07-20', yearly: false }, today);
  assert.equal(oneTimePast.daysUntil, -4);
  assert.equal(upcomingAnniversaries([
    { id: 'past', date: '2026-07-20', yearly: false }
  ], today, 7).length, 0);
});

test('upcoming and primary anniversaries prefer the nearest valid date', () => {
  const today = new Date(2026, 6, 24);
  const events = [
    { id: 'later', title: '稍后', date: '2020-07-30', yearly: true },
    { id: 'soon', title: '最近', date: '2020-07-25', yearly: true }
  ];
  assert.equal(upcomingAnniversaries(events, today, 3)[0].event.id, 'soon');
  assert.equal(primaryAnniversary(events, today).event.id, 'soon');
});

test('anniversary notification is sent once and persisted for deduplication', () => {
  const today = new Date(2026, 6, 24);
  const config = cloneConfig(defaultConfig);
  config.apps.anniversary.enabled = true;
  config.apps.anniversary.reminders = true;
  config.apps.anniversary.reminderDays = 3;
  config.apps.anniversary.events = [{
    id: 'today-event',
    title: '相遇纪念日',
    date: localDateKey(today),
    yearly: true
  }];
  const notifications = [];
  const previousNotification = globalThis.Notification;
  globalThis.Notification = class {
    static permission = 'granted';
    constructor(title, options) {
      notifications.push({ title, ...options });
    }
  };
  const handlers = {
    updatePath(path, value) {
      assert.equal(path, 'apps.anniversary.sentReminders');
      config.apps.anniversary.sentReminders = value;
    }
  };
  try {
    syncAnniversaryReminders(config, handlers, today);
    syncAnniversaryReminders(config, handlers, today);
  } finally {
    globalThis.Notification = previousNotification;
  }
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].body, /今天是“相遇纪念日”/);
  assert.equal(config.apps.anniversary.sentReminders.length, 1);
});

test('delete undo restores the original list position and ignores duplicates', () => {
  const items = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  const result = removeItemWithUndo(items, 'two');
  assert.deepEqual(result.next.map(item => item.id), ['one', 'three']);
  const restored = restoreItemFromUndo(result.next, result.undo);
  assert.deepEqual(restored.map(item => item.id), ['one', 'two', 'three']);
  assert.equal(restoreItemFromUndo(restored, result.undo), restored);
});
