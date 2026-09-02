export const DEFAULT_PROACTIVE_POLICY = Object.freeze({
  enabled: true,
  quietHours: { enabled: true, start: '23:00', end: '08:00' },
  dailyLimit: 3,
  suppressWhileUnanswered: true,
  emotionFollowUp: true,
  emotionFollowUpMinutes: 30,
  morningGreeting: true,
  nightGreeting: true,
  diaryResponse: true,
  anniversaryReminder: true
});

export const DEFAULT_COMPANION_INTEGRATIONS = Object.freeze({
  musicContext: false,
  diaryCompanion: false,
  anniversaryCompanion: false,
  moodAwareGreetings: false,
  relationshipDesktop: false
});

const boolKeys = ['enabled', 'suppressWhileUnanswered', 'emotionFollowUp', 'morningGreeting', 'nightGreeting', 'diaryResponse', 'anniversaryReminder'];

function validClock(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? value : fallback;
}

export function normalizeProactivePolicy(value = {}, fallback = DEFAULT_PROACTIVE_POLICY) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = {
    ...fallback,
    quietHours: {
      ...fallback.quietHours,
      ...(source.quietHours || {}),
      enabled: source.quietHours?.enabled !== false,
      start: validClock(source.quietHours?.start, fallback.quietHours.start),
      end: validClock(source.quietHours?.end, fallback.quietHours.end)
    },
    dailyLimit: Math.max(1, Math.min(20, Number(source.dailyLimit) || fallback.dailyLimit)),
    emotionFollowUpMinutes: Math.max(5, Math.min(720, Number(source.emotionFollowUpMinutes) || fallback.emotionFollowUpMinutes))
  };
  boolKeys.forEach(key => {
    if (typeof source[key] === 'boolean') normalized[key] = source[key];
  });
  return normalized;
}

export function normalizeProactiveSettings(value = {}, validCharacterIds = []) {
  const defaults = normalizeProactivePolicy(value.defaults);
  const validIds = new Set(validCharacterIds);
  const characterOverrides = {};
  Object.entries(value.characterOverrides || {}).forEach(([characterId, override]) => {
    if (!validIds.has(characterId) || !override || typeof override !== 'object') return;
    characterOverrides[characterId] = {
      useGlobal: override.useGlobal !== false,
      ...normalizeProactivePolicy(override, defaults)
    };
  });
  return { defaults, characterOverrides };
}

export function normalizeCompanionIntegrations(value = {}) {
  return Object.fromEntries(Object.keys(DEFAULT_COMPANION_INTEGRATIONS).map(key => [key, value?.[key] === true]));
}

export function resolveProactivePolicy(config, characterId) {
  const proactive = normalizeProactiveSettings(config.companion?.proactive, [
    config.character?.id,
    ...(config.characters || []).map(item => item.id)
  ].filter(Boolean));
  const override = proactive.characterOverrides[characterId];
  return !override || override.useGlobal ? proactive.defaults : normalizeProactivePolicy(override, proactive.defaults);
}

export function isIntegrationEnabled(config, key) {
  const enabled = normalizeCompanionIntegrations(config.companion?.integrations)[key] === true;
  const appMap = {
    musicContext: 'music', diaryCompanion: 'diary', anniversaryCompanion: 'anniversary',
    moodAwareGreetings: 'goodnight', relationshipDesktop: 'character'
  };
  const appId = appMap[key];
  return enabled && (!appId || config.apps?.[appId]?.enabled !== false);
}

export function integrationRecordSummary(config, key) {
  const sourceApp = { musicContext: 'music', diaryCompanion: 'diary', anniversaryCompanion: 'anniversary', moodAwareGreetings: 'goodnight', relationshipDesktop: 'character' }[key];
  const matches = item => item?.sourceApp === sourceApp || item?.sourceRef?.appId === sourceApp || String(item?.source || '').startsWith(`${sourceApp}-`);
  return {
    events: (config.companion?.events || []).filter(matches).length,
    tasks: (config.companion?.tasks || []).filter(matches).length,
    memories: (config.apps?.memory?.entries || []).filter(matches).length
  };
}

export function clearIntegrationRecords(config, key) {
  const sourceApp = { musicContext: 'music', diaryCompanion: 'diary', anniversaryCompanion: 'anniversary', moodAwareGreetings: 'goodnight', relationshipDesktop: 'character' }[key];
  if (!sourceApp) return config;
  const matches = item => item?.sourceApp === sourceApp || item?.sourceRef?.appId === sourceApp || String(item?.source || '').startsWith(`${sourceApp}-`);
  const companionKeys = ['events', 'timeline', 'memoryCandidates', 'followUps', 'tasks'];
  const companion = { ...config.companion };
  companionKeys.forEach(collection => { companion[collection] = (companion[collection] || []).filter(item => !matches(item)); });
  const remainingTaskIds = new Set((companion.tasks || []).map(item => item.id));
  companion.notifications = (companion.notifications || []).filter(item => !item.taskId || remainingTaskIds.has(item.taskId));
  return {
    ...config,
    companion,
    apps: {
      ...config.apps,
      memory: { ...config.apps.memory, entries: (config.apps.memory?.entries || []).filter(item => !matches(item)) }
    }
  };
}

function minutesAt(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function clockMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

export function quietPeriodEnd(nowValue, policy) {
  if (!policy.quietHours?.enabled) return null;
  const now = nowValue instanceof Date ? new Date(nowValue) : new Date(nowValue);
  const start = clockMinutes(policy.quietHours.start);
  const end = clockMinutes(policy.quietHours.end);
  const current = minutesAt(now);
  const inside = start === end || (start < end ? current >= start && current < end : current >= start || current < end);
  if (!inside) return null;
  const result = new Date(now);
  const [endHour, endMinute] = policy.quietHours.end.split(':').map(Number);
  result.setHours(endHour, endMinute, 0, 0);
  if (result <= now) result.setDate(result.getDate() + 1);
  return result;
}

export function proactiveTaskExpiresAt(task) {
  const due = new Date(task.dueAt || task.createdAt);
  if (Number.isNaN(due.getTime())) return 0;
  if (['emotion-follow-up', 'diary-response'].includes(task.type)) return due.getTime() + 12 * 3600000;
  if (['morning-greeting', 'night-greeting'].includes(task.type)) return due.getTime() + 3 * 3600000;
  if (task.type === 'anniversary-reminder') {
    const date = String(task.payload?.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const end = date ? new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), 23, 59, 59, 999) : due;
    return end.getTime();
  }
  return due.getTime() + 12 * 3600000;
}
