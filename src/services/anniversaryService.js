import { localDateKey } from '../apps/appData.js?v=app-config-40';

const MS_PER_DAY = 86400000;

function localMidnight(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateForYear(source, year) {
  const month = source.getMonth();
  const day = source.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function anniversaryMetrics(entry, todayValue = new Date()) {
  const source = localMidnight(entry?.date);
  const today = localMidnight(todayValue);
  if (!source || !today) return null;
  const daysSince = Math.round((today - source) / MS_PER_DAY);

  if (entry.yearly !== false) {
    let occurrence = dateForYear(source, today.getFullYear());
    if (occurrence < today) occurrence = dateForYear(source, today.getFullYear() + 1);
    return {
      daysSince,
      daysUntil: Math.round((occurrence - today) / MS_PER_DAY),
      nextDate: localDateKey(occurrence),
      passed: daysSince >= 0
    };
  }

  return {
    daysSince,
    daysUntil: Math.round((source - today) / MS_PER_DAY),
    nextDate: entry.date,
    passed: daysSince >= 0
  };
}

export function upcomingAnniversaries(events, today = new Date(), daysAhead = 3) {
  const range = Math.max(0, Math.min(30, Number(daysAhead) || 0));
  return (events || [])
    .map(event => ({ event, metrics: anniversaryMetrics(event, today) }))
    .filter(item => item.metrics && item.metrics.daysUntil >= 0 && item.metrics.daysUntil <= range)
    .sort((a, b) => a.metrics.daysUntil - b.metrics.daysUntil);
}

export function primaryAnniversary(events, today = new Date()) {
  return (events || [])
    .map(event => ({ event, metrics: anniversaryMetrics(event, today) }))
    .filter(item => item.metrics)
    .sort((a, b) => {
      const aUpcoming = a.metrics.daysUntil >= 0 ? a.metrics.daysUntil : Number.MAX_SAFE_INTEGER;
      const bUpcoming = b.metrics.daysUntil >= 0 ? b.metrics.daysUntil : Number.MAX_SAFE_INTEGER;
      return aUpcoming - bUpcoming;
    })[0] || null;
}

export function anniversaryReminderKey(event, metrics, today = new Date()) {
  return `${localDateKey(today)}:${event.id}:${metrics.nextDate}`;
}

function notificationBody(item) {
  return item.metrics.daysUntil === 0
    ? `今天是“${item.event.title}”。`
    : `${item.metrics.daysUntil} 天后是“${item.event.title}”。`;
}

export function syncAnniversaryReminders(config, handlers, date = new Date()) {
  const app = config.apps?.anniversary;
  if (
    !app?.enabled
    || !app.reminders
    || typeof Notification === 'undefined'
    || Notification.permission !== 'granted'
  ) return;

  const upcoming = upcomingAnniversaries(app.events, date, app.reminderDays);
  if (!upcoming.length) return;
  const sent = Array.isArray(app.sentReminders) ? app.sentReminders : [];
  const sentKeys = new Set(sent.map(item => item.key));
  const unsent = upcoming.filter(item => !sentKeys.has(anniversaryReminderKey(item.event, item.metrics, date)));
  if (!unsent.length) return;

  const records = [];
  unsent.forEach(item => {
    const key = anniversaryReminderKey(item.event, item.metrics, date);
    try {
      new Notification('纪念日提醒', {
        body: notificationBody(item),
        tag: key
      });
      records.push({
        key,
        eventId: item.event.id,
        notifiedAt: new Date().toISOString()
      });
    } catch {
      // Keep the reminder unsent so it can be retried later.
    }
  });
  if (records.length) {
    handlers.updatePath?.(
      'apps.anniversary.sentReminders',
      [...records, ...sent].slice(0, 180),
      { keepPhone: true }
    );
  }
}
