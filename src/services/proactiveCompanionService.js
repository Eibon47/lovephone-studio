import { activeChatSession, ensureCharacterChatSession } from './chatSessionService.js';
import { proactiveTaskExpiresAt, quietPeriodEnd, resolveProactivePolicy } from './companionPolicyService.js';

const MAX_EXECUTIONS_PER_TICK = 5;

function safeTime(value, fallback = new Date().toISOString()) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function characters(config) {
  return [config.character, ...(config.characters || [])].filter(Boolean);
}

function characterFor(config, characterId) {
  return characters(config).find(item => item.id === characterId) || config.character;
}

function messageFor(task, character) {
  const userName = character.userName || '你';
  const payload = task.payload || {};
  if (task.type === 'emotion-follow-up') {
    return `${userName}，刚才你说自己有些${payload.mood || '不舒服'}。现在有没有好一点？不用急着回答，我只是想来看看你。`;
  }
  if (task.type === 'diary-response') {
    return `${userName}，我看到你写下了“${payload.title || '今天的小事'}”。谢谢你愿意把这一天留在这里，我会好好记着。`;
  }
  if (task.type === 'anniversary-reminder') {
    return `${userName}，“${payload.title || '我们的纪念日'}”快到了。我已经替我们记住，不会让这个日子悄悄溜走。`;
  }
  if (task.type === 'morning-greeting' || task.type === 'night-greeting') {
    return String(payload.message || '').trim()
      || (task.type === 'morning-greeting'
        ? `${userName}，早上好。今天也慢慢来，我会在这里。`
        : `${userName}，晚安。今天辛苦了，剩下的事情明天再想。`);
  }
  return `${userName}，我来看看你。`;
}

function triggerLabel(type) {
  return {
    'emotion-follow-up': '情绪关怀',
    'diary-response': '日记回应',
    'anniversary-reminder': '纪念日提醒',
    'morning-greeting': '早安问候',
    'night-greeting': '晚安问候'
  }[type] || '主动陪伴';
}

function sameLocalDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())
    && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hasUnansweredProactive(chat, characterId) {
  const scoped = (chat.messages || []).filter(message => message.characterId === characterId);
  const latestProactive = scoped.filter(message => message.from === 'character' && message.proactive)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))[0];
  if (!latestProactive) return false;
  return !scoped.some(message => message.from === 'user' && Date.parse(message.createdAt || 0) > Date.parse(latestProactive.createdAt || 0));
}

function nextDayRelease(now, policy) {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  const [hour, minute] = String(policy.quietHours?.end || '08:00').split(':').map(Number);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function processDueProactiveTasks(config, nowValue = new Date(), options = {}) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const nowIso = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
  const companion = config.companion || {};
  const sourceTasks = Array.isArray(companion.tasks) ? companion.tasks : [];
  const sourceNotifications = Array.isArray(companion.notifications) ? companion.notifications : [];

  if (!config.apps?.chat?.enabled || !config.apps?.chat?.history) {
    const cancelled = sourceTasks.map(task => task.status === 'pending'
      ? { ...task, status: 'cancelled', completedAt: nowIso, error: '聊天历史已关闭' }
      : task);
    const changed = cancelled.some((task, index) => task !== sourceTasks[index]);
    return {
      config: changed ? { ...config, companion: { ...companion, tasks: cancelled } } : config,
      changed,
      executed: []
    };
  }

  const dueIds = new Set(sourceTasks
    .filter(task => task.status === 'pending' && Date.parse(task.dueAt) <= now.getTime())
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))
    .slice(0, MAX_EXECUTIONS_PER_TICK)
    .map(task => task.id));
  if (!dueIds.size) return { config, changed: false, executed: [] };

  let chat = { ...config.apps.chat };
  let notifications = [...sourceNotifications];
  const executed = [];
  const tasks = sourceTasks.map(task => {
    if (!dueIds.has(task.id)) return task;
    const character = characterFor(config, task.characterId);
    const policy = resolveProactivePolicy(config, task.characterId);
    const expiresAt = Date.parse(task.expiresAt || '') || proactiveTaskExpiresAt(task);
    const fail = (status, error, dueAt = task.dueAt) => ({
      ...task, status, dueAt, expiresAt: new Date(expiresAt).toISOString(),
      completedAt: ['expired', 'cancelled'].includes(status) ? nowIso : task.completedAt,
      error
    });
    if (!policy.enabled) return fail('cancelled', '该角色已关闭主动陪伴');
    const typeAllowed = {
      'emotion-follow-up': policy.emotionFollowUp,
      'diary-response': policy.diaryResponse,
      'anniversary-reminder': policy.anniversaryReminder,
      'morning-greeting': policy.morningGreeting,
      'night-greeting': policy.nightGreeting
    }[task.type] !== false;
    if (!typeAllowed) return fail('cancelled', '该类型主动陪伴已关闭');
    if (now.getTime() > expiresAt) return fail('expired', '已超过有效发送时间');
    const quietEnd = quietPeriodEnd(now, policy);
    if (quietEnd) return quietEnd.getTime() > expiresAt
      ? fail('expired', '安静时段结束后已超过有效期')
      : fail('pending', '', quietEnd.toISOString());
    const completedToday = sourceTasks.filter(item => (
      item.characterId === task.characterId && item.status === 'completed' && sameLocalDay(item.completedAt, now)
    )).length;
    if (completedToday >= policy.dailyLimit) {
      const release = nextDayRelease(now, policy);
      return release.getTime() > expiresAt
        ? fail('expired', '达到每日上限且无法在有效期内顺延')
        : fail('pending', '', release.toISOString());
    }
    if (task.type !== 'anniversary-reminder' && policy.suppressWhileUnanswered && hasUnansweredProactive(chat, task.characterId)) {
      const retryAt = new Date(now.getTime() + 30 * 60000);
      return retryAt.getTime() > expiresAt
        ? fail('expired', '上一条主动消息未回复，且已超过有效期')
        : fail('pending', '', retryAt.toISOString());
    }
    chat = ensureCharacterChatSession(chat, character.id, nowIso);
    const session = activeChatSession(chat, character.id);
    if (!session) return { ...task, status: 'failed', attempts: (task.attempts || 0) + 1, error: '找不到角色会话' };

    const messageId = `proactive-${task.id}`;
    const aiOverride = String(options.messageOverrides?.[task.id] || '').trim();
    const content = String(aiOverride || messageFor(task, character)).trim().slice(0, 500);
    const providerId = aiOverride
      ? 'ai-proactive'
      : (String(task.payload?.providerId || '').trim() || 'local-proactive');
    if (!(chat.messages || []).some(message => message.id === messageId)) {
      chat.messages = [...(chat.messages || []), {
        id: messageId,
        characterId: character.id,
        sessionId: session.id,
        from: 'character',
        text: content,
        createdAt: nowIso,
        providerId,
        proactive: true,
        proactiveType: task.type,
        triggerLabel: triggerLabel(task.type),
        taskId: task.id,
        requestStatus: 'sent'
      }];
      chat.sessions = (chat.sessions || []).map(item => item.id === session.id
        ? { ...item, updatedAt: nowIso }
        : item);
    }

    const notificationId = `proactive:${task.id}`;
    if (!notifications.some(item => item.id === notificationId)) {
      notifications = [{
        id: notificationId,
        taskId: task.id,
        characterId: character.id,
        appId: 'chat',
        title: `${character.name || '角色'}发来主动消息`,
        body: content,
        createdAt: nowIso,
        readAt: ''
      }, ...notifications].slice(0, 120);
    }
    executed.push({ taskId: task.id, characterId: character.id, messageId, notificationId, title: `${character.name || '角色'}发来主动消息`, body: content });
    return { ...task, status: 'completed', completedAt: nowIso, expiresAt: new Date(expiresAt).toISOString(), messageId, attempts: (task.attempts || 0) + 1, error: '' };
  });

  const completedEmotionSources = new Set(tasks
    .filter(task => dueIds.has(task.id) && task.status === 'completed' && task.type === 'emotion-follow-up')
    .map(task => task.sourceId));
  const followUps = (companion.followUps || []).map(item => completedEmotionSources.has(item.sourceId)
    ? { ...item, addressedAt: item.addressedAt || nowIso }
    : item);

  return {
    changed: true,
    executed,
    config: {
      ...config,
      apps: { ...config.apps, chat },
      companion: { ...companion, tasks, notifications, followUps }
    }
  };
}

export function markCompanionNotificationRead(config, notificationId, now = new Date().toISOString()) {
  const notifications = config.companion?.notifications || [];
  let changed = false;
  const next = notifications.map(item => {
    if (item.id !== notificationId || item.readAt) return item;
    changed = true;
    return { ...item, readAt: safeTime(now) };
  });
  return changed ? { ...config, companion: { ...config.companion, notifications: next } } : config;
}

export function markAllCompanionNotificationsRead(config, now = new Date().toISOString()) {
  const notifications = config.companion?.notifications || [];
  if (!notifications.some(item => !item.readAt)) return config;
  const readAt = safeTime(now);
  return {
    ...config,
    companion: {
      ...config.companion,
      notifications: notifications.map(item => item.readAt ? item : { ...item, readAt })
    }
  };
}
