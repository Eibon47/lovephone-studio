import { localDateKey } from '../apps/appData.js';
import { upcomingAnniversaries } from './anniversaryService.js';

export function collectPhoneNotifications(config, date = new Date()) {
  const today = localDateKey(date);
  const notices = [];
  const greetings = (config.apps?.goodnight?.greetings || [])
    .filter(item => item?.date === today && item?.message)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
  greetings.forEach(item => notices.push({
    id: `greeting:${item.id}`,
    appId: 'chat',
    characterId: item.characterId,
    title: `${item.characterName || '角色'}给你留了问候`,
    body: item.message,
    createdAt: item.createdAt || `${today}T00:00:00`
  }));

  (config.apps?.diary?.entries || [])
    .filter(item => item?.date === today && item?.title)
    .forEach(item => notices.push({
      id: `diary:${item.id}`,
      appId: 'diary',
      title: '今天的日记已保存',
      body: item.title,
      createdAt: `${today}T12:00:00`
    }));

  upcomingAnniversaries(config.apps?.anniversary?.events || [], date, config.apps?.anniversary?.reminderDays || 3)
    .forEach(({ event, metrics }) => notices.push({
      id: `anniversary:${event.id}:${metrics.nextDate}`,
      appId: 'anniversary',
      title: metrics.daysUntil === 0 ? '今天是纪念日' : `还有 ${metrics.daysUntil} 天就是纪念日`,
      body: event.title,
      createdAt: `${today}T08:00:00`
    }));

  return notices
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
    .slice(0, 8);
}
