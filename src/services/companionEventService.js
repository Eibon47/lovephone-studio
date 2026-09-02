const EVENT_LIMIT = 300;
const TIMELINE_LIMIT = 120;
const CANDIDATE_LIMIT = 100;
const FOLLOW_UP_LIMIT = 60;
const TASK_LIMIT = 120;
const NOTIFICATION_LIMIT = 120;
import { isIntegrationEnabled, proactiveTaskExpiresAt, resolveProactivePolicy } from './companionPolicyService.js';

const EVENT_TYPES = new Set([
  'chat.user_message.sent',
  'chat.character_message.completed',
  'diary.entry.saved',
  'anniversary.event.saved',
  'music.track.started',
  'goodnight.checkin.saved',
  'greeting.generated'
]);

const emotionalSignals = [
  ['难过', '难过'], ['伤心', '难过'], ['想哭', '难过'], ['累', '疲惫'],
  ['焦虑', '焦虑'], ['害怕', '不安'], ['生气', '生气'], ['开心', '开心'],
  ['高兴', '开心'], ['想你', '想念']
];

function text(value, max = 400) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function makeId(prefix = 'event') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeItem(item, fallbackCharacterId) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    id: text(item.id, 120) || makeId('legacy'),
    characterId: text(item.characterId, 80) || fallbackCharacterId,
    createdAt: safeTime(item.createdAt || item.occurredAt)
  };
}

function normalizeTask(item, fallbackCharacterId) {
  const normalized = normalizeItem(item, fallbackCharacterId);
  if (!normalized) return null;
  const status = ['pending', 'completed', 'cancelled', 'failed', 'expired'].includes(item.status)
    ? item.status
    : 'pending';
  return {
    ...normalized,
    type: text(item.type, 50),
    status,
    dedupeKey: text(item.dedupeKey, 180),
    eventId: text(item.eventId, 120),
    sourceApp: text(item.sourceApp, 30),
    sourceId: text(item.sourceId, 120),
    dueAt: safeTime(item.dueAt || item.createdAt),
    expiresAt: item.expiresAt ? safeTime(item.expiresAt) : '',
    attempts: Math.max(0, Math.min(5, Number(item.attempts) || 0)),
    payload: item.payload && typeof item.payload === 'object' ? { ...item.payload } : {}
  };
}

function normalizeNotification(item, fallbackCharacterId) {
  const normalized = normalizeItem(item, fallbackCharacterId);
  if (!normalized) return null;
  return {
    ...normalized,
    taskId: text(item.taskId, 120),
    appId: text(item.appId, 30) || 'chat',
    title: text(item.title, 80),
    body: text(item.body, 240),
    readAt: item.readAt ? safeTime(item.readAt) : ''
  };
}

export function normalizeCompanionState(source = {}, characterIds = [], fallbackCharacterId = 'character-main') {
  const validIds = new Set(characterIds.length ? characterIds : [fallbackCharacterId]);
  const normalizeList = (value, limit) => (Array.isArray(value) ? value : [])
    .map(item => normalizeItem(item, fallbackCharacterId))
    .filter(item => item && validIds.has(item.characterId))
    .slice(0, limit);
  const relationshipSignals = {};
  Object.entries(source.relationshipSignals || {}).forEach(([characterId, signal]) => {
    if (!validIds.has(characterId) || !signal || typeof signal !== 'object') return;
    relationshipSignals[characterId] = {
      interactionCount: Math.max(0, Number(signal.interactionCount) || 0),
      lastInteractionAt: signal.lastInteractionAt ? safeTime(signal.lastInteractionAt) : '',
      lastMood: text(signal.lastMood, 30),
      lastSourceApp: text(signal.lastSourceApp, 30)
    };
  });
  return {
    events: normalizeList(source.events, EVENT_LIMIT),
    timeline: normalizeList(source.timeline, TIMELINE_LIMIT),
    memoryCandidates: normalizeList(source.memoryCandidates, CANDIDATE_LIMIT),
    followUps: normalizeList(source.followUps, FOLLOW_UP_LIMIT),
    tasks: (Array.isArray(source.tasks) ? source.tasks : [])
      .map(item => normalizeTask(item, fallbackCharacterId))
      .filter(item => item && validIds.has(item.characterId))
      .slice(0, TASK_LIMIT),
    notifications: (Array.isArray(source.notifications) ? source.notifications : [])
      .map(item => normalizeNotification(item, fallbackCharacterId))
      .filter(item => item && validIds.has(item.characterId))
      .slice(0, NOTIFICATION_LIMIT),
    relationshipSignals,
    proactive: source.proactive && typeof source.proactive === 'object' ? source.proactive : {},
    integrations: source.integrations && typeof source.integrations === 'object' ? source.integrations : {}
  };
}

function moodFrom(value) {
  const source = text(value, 500);
  return emotionalSignals.find(([keyword]) => source.includes(keyword))?.[1] || '';
}

function projectionFor(event) {
  const payload = event.payload || {};
  if (event.type === 'diary.entry.saved') return {
    title: `写下日记：${text(payload.title, 40) || '今天的小事'}`,
    summary: text(payload.content, 120),
    candidate: { type: 'event', title: text(payload.title, 40) || '日记里的这一天', content: text(payload.content, 240) }
  };
  if (event.type === 'anniversary.event.saved') return {
    title: `记住纪念日：${text(payload.title, 40)}`,
    summary: text(payload.date, 30),
    candidate: { type: 'relationship', title: text(payload.title, 40) || '重要的日子', content: `${text(payload.date, 30)}${payload.yearly ? '，每年都会纪念' : ''}` }
  };
  if (event.type === 'music.track.started') return {
    title: `一起听了《${text(payload.name, 50) || '一首歌'}》`,
    summary: text(payload.artist, 60)
  };
  if (event.type === 'goodnight.checkin.saved') return {
    title: '完成了今晚的睡前记录',
    summary: text(payload.note || payload.mood, 100)
  };
  if (event.type === 'greeting.generated') return {
    title: payload.period === 'morning' ? '收到了一句早安' : '收到了一句晚安',
    summary: text(payload.message, 120)
  };
  if (event.type === 'chat.user_message.sent') {
    const mood = moodFrom(payload.text);
    if (!mood) return {};
    return {
      followUp: {
        mood,
        summary: `用户提到自己${mood}：${text(payload.text, 140)}`
      },
      candidate: text(payload.text, 240).length >= 12 ? {
        type: 'event',
        title: `一次关于${mood}的聊天`,
        content: text(payload.text, 240)
      } : null
    };
  }
  return {};
}

function anniversaryDueAt(payload, nowValue) {
  const match = String(payload.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const now = new Date(nowValue);
  if (!match || Number.isNaN(now.getTime())) return now.toISOString();
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  let target = new Date(Number(match[1]), month, day, 9, 0, 0, 0);
  if (payload.yearly) {
    target = new Date(now.getFullYear(), month, day, 9, 0, 0, 0);
    if (target < now) target = new Date(now.getFullYear() + 1, month, day, 9, 0, 0, 0);
  }
  const reminderDays = Math.max(0, Math.min(30, Number(payload.reminderDays) || 0));
  const due = new Date(target.getTime() - reminderDays * 86400000);
  return (due < now && target >= now ? now : due).toISOString();
}

function taskFor(event, projection, policy) {
  const baseTime = new Date(event.occurredAt);
  if (event.type === 'chat.user_message.sent' && projection.followUp && policy.emotionFollowUp) return {
    type: 'emotion-follow-up',
    dueAt: new Date(baseTime.getTime() + policy.emotionFollowUpMinutes * 60000).toISOString(),
    payload: { mood: projection.followUp.mood, userText: text(event.payload?.text, 180) }
  };
  if (event.type === 'diary.entry.saved' && policy.diaryResponse) return {
    type: 'diary-response',
    dueAt: new Date(baseTime.getTime() + 5 * 60000).toISOString(),
    payload: { title: text(event.payload?.title, 40), content: text(event.payload?.content, 180) }
  };
  if (event.type === 'anniversary.event.saved' && policy.anniversaryReminder) return {
    type: 'anniversary-reminder',
    dueAt: anniversaryDueAt(event.payload || {}, event.occurredAt),
    payload: { ...event.payload }
  };
  if (event.type === 'greeting.generated'
    && ((event.payload?.period === 'morning' && policy.morningGreeting)
      || (event.payload?.period !== 'morning' && policy.nightGreeting))) return {
    type: event.payload?.period === 'morning' ? 'morning-greeting' : 'night-greeting',
    dueAt: event.occurredAt,
    payload: {
      period: event.payload?.period,
      message: text(event.payload?.message, 180),
      providerId: text(event.payload?.providerId, 80)
    }
  };
  return null;
}

function eventFrom(input, fallbackCharacterId) {
  const type = text(input?.type, 80);
  if (!EVENT_TYPES.has(type)) throw new Error('不支持的陪伴事件类型。');
  const sourceId = text(input.sourceId, 120);
  const sourceApp = text(input.sourceApp || type.split('.')[0], 30);
  const characterId = text(input.characterId, 80) || fallbackCharacterId;
  return {
    id: text(input.id, 120) || makeId('event'),
    type,
    characterId,
    sourceApp,
    sourceId,
    dedupeKey: text(input.dedupeKey, 180) || `${type}:${characterId}:${sourceId || makeId('source')}`,
    occurredAt: safeTime(input.occurredAt),
    createdAt: new Date().toISOString(),
    payload: Object.fromEntries(Object.entries(input.payload || {}).slice(0, 20).map(([key, value]) => [text(key, 50), typeof value === 'boolean' || typeof value === 'number' ? value : text(value, 500)]))
  };
}

export function recordCompanionEvent(config, input) {
  const fallbackId = config.character?.id || 'character-main';
  const characterIds = [fallbackId, ...(config.characters || []).map(item => item.id)];
  const current = normalizeCompanionState(config.companion, characterIds, fallbackId);
  const event = eventFrom(input, fallbackId);
  if (!characterIds.includes(event.characterId)) event.characterId = fallbackId;

  const integrationKey = {
    'music.track.started': 'musicContext',
    'diary.entry.saved': 'diaryCompanion',
    'anniversary.event.saved': 'anniversaryCompanion'
  }[event.type];
  if (integrationKey && !isIntegrationEnabled(config, integrationKey)) return current;

  const previous = current.events.find(item => item.dedupeKey === event.dedupeKey);
  const replacedIds = new Set(previous ? [previous.id] : []);
  const events = [event, ...current.events.filter(item => item.dedupeKey !== event.dedupeKey)].slice(0, EVENT_LIMIT);
  let timeline = current.timeline.filter(item => !replacedIds.has(item.eventId));
  let memoryCandidates = current.memoryCandidates.filter(item => !replacedIds.has(item.eventId));
  let followUps = current.followUps.filter(item => !replacedIds.has(item.eventId));
  let tasks = current.tasks.filter(item => !(replacedIds.has(item.eventId) && item.status === 'pending'));

  if (event.type === 'chat.character_message.completed') {
    followUps = followUps.map(item => item.characterId === event.characterId && !item.addressedAt
      ? { ...item, addressedAt: event.occurredAt }
      : item);
  }

  const projection = projectionFor(event);
  const proactiveDedupeKey = `proactive:${event.dedupeKey}`;
  const alreadyCompleted = current.tasks.some(item => item.dedupeKey === proactiveDedupeKey && item.status === 'completed');
  const policy = resolveProactivePolicy(config, event.characterId);
  const task = config.apps?.chat?.enabled && config.apps?.chat?.history && policy.enabled && !alreadyCompleted
    ? taskFor(event, projection, policy)
    : null;
  if (task) {
    tasks = [{
      id: makeId('task'),
      eventId: event.id,
      characterId: event.characterId,
      sourceApp: event.sourceApp,
      sourceId: event.sourceId,
      dedupeKey: proactiveDedupeKey,
      status: 'pending',
      attempts: 0,
      createdAt: event.occurredAt,
      dueAt: task.dueAt,
      type: task.type,
      payload: task.payload,
      expiresAt: new Date(proactiveTaskExpiresAt({ ...task, createdAt: event.occurredAt })).toISOString()
    }, ...tasks.filter(item => item.dedupeKey !== proactiveDedupeKey)].slice(0, TASK_LIMIT);
  }
  if (projection.title) timeline = [{
    id: makeId('timeline'), eventId: event.id, characterId: event.characterId,
    sourceApp: event.sourceApp, sourceId: event.sourceId, title: projection.title,
    summary: projection.summary || '', createdAt: event.occurredAt
  }, ...timeline].slice(0, TIMELINE_LIMIT);
  if (projection.candidate?.content) memoryCandidates = [{
    id: makeId('candidate'), eventId: event.id, characterId: event.characterId,
    sourceApp: event.sourceApp, sourceId: event.sourceId, status: 'pending',
    type: projection.candidate.type, title: projection.candidate.title,
    content: projection.candidate.content, createdAt: event.occurredAt
  }, ...memoryCandidates].slice(0, CANDIDATE_LIMIT);
  if (projection.followUp) followUps = [{
    id: makeId('followup'), eventId: event.id, characterId: event.characterId,
    sourceApp: event.sourceApp, sourceId: event.sourceId, ...projection.followUp,
    createdAt: event.occurredAt, addressedAt: ''
  }, ...followUps].slice(0, FOLLOW_UP_LIMIT);

  const priorSignal = current.relationshipSignals[event.characterId] || {};
  return {
    events,
    timeline,
    memoryCandidates,
    followUps,
    tasks,
    notifications: current.notifications,
    proactive: current.proactive,
    integrations: current.integrations,
    relationshipSignals: {
      ...current.relationshipSignals,
      [event.characterId]: {
        interactionCount: (Number(priorSignal.interactionCount) || 0) + (previous ? 0 : 1),
        lastInteractionAt: event.occurredAt,
        lastMood: projection.followUp?.mood || priorSignal.lastMood || '',
        lastSourceApp: event.sourceApp
      }
    }
  };
}

export function removeCompanionSource(config, sourceApp, sourceId) {
  const fallbackId = config.character?.id || 'character-main';
  const characterIds = [fallbackId, ...(config.characters || []).map(item => item.id)];
  const current = normalizeCompanionState(config.companion, characterIds, fallbackId);
  const matches = item => item.sourceApp === sourceApp && item.sourceId === sourceId;
  const eventIds = new Set(current.events.filter(matches).map(item => item.id));
  const related = item => matches(item) || eventIds.has(item.eventId);
  return {
    ...current,
    events: current.events.filter(item => !matches(item)),
    timeline: current.timeline.filter(item => !related(item)),
    memoryCandidates: current.memoryCandidates.filter(item => !related(item)),
    followUps: current.followUps.filter(item => !related(item)),
    tasks: current.tasks.filter(item => !related(item)),
    notifications: current.notifications.filter(item => !current.tasks.some(task => related(task) && task.id === item.taskId))
  };
}

export function resolveMemoryCandidate(config, candidateId, status, overrides = {}) {
  const fallbackId = config.character?.id || 'character-main';
  const characterIds = [fallbackId, ...(config.characters || []).map(item => item.id)];
  const companion = normalizeCompanionState(config.companion, characterIds, fallbackId);
  const candidate = companion.memoryCandidates.find(item => item.id === candidateId && item.status === 'pending');
  if (!candidate || !['accepted', 'dismissed'].includes(status)) return { companion, memoryEntry: null };
  return {
    companion: {
      ...companion,
      memoryCandidates: companion.memoryCandidates.map(item => item.id === candidateId
        ? { ...item, status, resolvedAt: new Date().toISOString() }
        : item)
    },
    memoryEntry: status === 'accepted' ? {
      id: makeId('memory'),
      type: overrides.type || candidate.type || 'event',
      title: overrides.title || candidate.title,
      content: overrides.content || candidate.content,
      date: candidate.createdAt.slice(0, 10),
      characterId: candidate.characterId,
      source: 'event-candidate',
      sourceEventId: candidate.eventId,
      importance: Math.max(1, Math.min(5, Number(overrides.importance) || 3)),
      expiresAt: overrides.expiresAt || '',
      sourceRef: {
        appId: candidate.sourceApp,
        sourceId: candidate.sourceId,
        label: candidate.title
      },
      updatedAt: new Date().toISOString()
    } : null
  };
}
