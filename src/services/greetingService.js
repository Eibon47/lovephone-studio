import { activeCharacter, localDateKey, makeId } from '../apps/appData.js?v=app-config-40';
import { streamAiChat } from './aiService.js?v=app-config-57';
import { friendlyAiError } from './aiErrors.js?v=app-config-36';
import { resolveCharacterAiProfile } from './aiProfileScope.js?v=app-config-45';

const inFlightGreetings = new Set();

export function greetingPeriodFor(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 20 || hour < 3) return 'night';
  return null;
}

export function greetingLabel(period) {
  return period === 'morning' ? '早安' : '晚安';
}

export function greetingProviderId(config, character) {
  return resolveCharacterAiProfile(config, character).providerId;
}

export function greetingKey(date, period, characterId) {
  return `${date}:${period}:${characterId || 'system'}`;
}

export function findGreeting(config, {
  date = localDateKey(),
  period = greetingPeriodFor(),
  characterId
} = {}) {
  if (!period) return null;
  const key = greetingKey(date, period, characterId);
  return (config.apps?.goodnight?.greetings || []).find(item => item.key === key) || null;
}

function memoriesFor(config, characterId) {
  return (config.apps?.memory?.entries || [])
    .filter(entry => (entry.characterId || config.character.id) === characterId)
    .slice(0, 8)
    .map(entry => `- ${entry.title}：${entry.content}`)
    .join('\n');
}

export function buildGreetingRequest(config, {
  character,
  period,
  date = localDateKey()
}) {
  const label = greetingLabel(period);
  const memories = memoriesFor(config, character.id);
  const profile = resolveCharacterAiProfile(config, character);
  return {
    providerId: profile.providerId,
    profileId: profile.profileId,
    system: [
      `你是名为“${character.name}”的 AI 陪伴角色。`,
      `关系：${character.relationship || '陪伴者'}。`,
      `说话风格：${character.speakingStyle || '自然、简短、温柔'}。`,
      `角色设定：${character.definition || '稳定陪伴用户，尊重现实边界。'}`,
      memories ? `可以参考这些记忆：\n${memories}` : '',
      `请写一句${label}问候，30 到 70 个中文字符。`,
      '语气自然，不使用标题、引号或“早安问候：”等前缀，不虚构具体事件，不诱导依赖。'
    ].filter(Boolean).join('\n'),
    messages: [{
      role: 'user',
      content: `${date}，请根据当前角色和已有记忆生成一句${label}。`
    }]
  };
}

export function localGreeting(character, period) {
  const name = character?.name || '小手机';
  const userName = character?.userName || '你';
  if (period === 'morning') {
    return `${userName}，早上好。新的一天不用着急，${name}会在这里陪你慢慢开始。`;
  }
  return `${userName}，晚安。今天已经走了很远，剩下的事情明天再想，${name}会陪你安稳睡下。`;
}

function greetingCharacter(config, osState = {}) {
  if (config.apps?.goodnight?.useCurrentCharacter) {
    return activeCharacter(config, osState);
  }
  return {
    ...config.character,
    id: 'system',
    name: '小手机',
    aiProviderId: ''
  };
}

async function generateGreeting(config, character, period) {
  if (!config.apps?.goodnight?.aiGenerated) {
    return {
      message: localGreeting(character, period),
      source: 'local',
      providerId: 'local',
      warning: ''
    };
  }

  const providerId = greetingProviderId(config, character);
  try {
    const message = (await streamAiChat(
      config,
      buildGreetingRequest(config, { character, period })
    )).replace(/\s+/g, ' ').trim().slice(0, 180);
    if (!message) throw new Error('模型没有生成可用问候');
    return { message, source: 'ai', providerId, warning: '' };
  } catch (error) {
    return {
      message: localGreeting(character, period),
      source: 'local-fallback',
      providerId,
      warning: `AI 问候生成失败，已使用本地问候：${friendlyAiError(error)}`
    };
  }
}

function showSystemNotification(config, greeting) {
  if (
    !config.apps?.goodnight?.notifications
    || typeof Notification === 'undefined'
    || Notification.permission !== 'granted'
  ) return;
  try {
    new Notification(`${greeting.characterName}的${greetingLabel(greeting.period)}`, {
      body: greeting.message,
      tag: greeting.key
    });
  } catch {
    // The greeting remains available in the app if the browser rejects a notification.
  }
}

export async function generateAndStoreGreeting(config, handlers, osState = {}, {
  period = greetingPeriodFor(),
  force = false
} = {}) {
  if (!period) return null;
  const latestConfig = handlers.getConfig?.() || config;
  const character = greetingCharacter(latestConfig, osState);
  const date = localDateKey();
  const key = greetingKey(date, period, character.id);
  const existing = findGreeting(latestConfig, { date, period, characterId: character.id });
  if (existing && !force) return existing;
  if (inFlightGreetings.has(key)) return null;

  inFlightGreetings.add(key);
  handlers.updatePhoneState?.({
    greetingGeneratingKey: key,
    greetingStatus: `正在生成${greetingLabel(period)}问候…`
  });
  try {
    const generated = await generateGreeting(latestConfig, character, period);
    const currentConfig = handlers.getConfig?.() || latestConfig;
    if (!currentConfig.apps?.goodnight?.enabled) return null;
    const currentCharacter = greetingCharacter(currentConfig, osState);
    if (currentCharacter.id !== character.id) return null;

    const currentGreetings = Array.isArray(currentConfig.apps.goodnight.greetings)
      ? currentConfig.apps.goodnight.greetings
      : [];
    const greeting = {
      id: existing?.id || makeId('greeting'),
      key,
      date,
      period,
      characterId: character.id,
      characterName: character.name,
      message: generated.message,
      source: generated.source,
      providerId: generated.providerId,
      createdAt: new Date().toISOString()
    };
    const next = [
      greeting,
      ...currentGreetings.filter(item => item.key !== key)
    ].slice(0, 120);
    handlers.updatePhoneState?.({
      greetingGeneratingKey: null,
      greetingStatus: generated.warning || `${greetingLabel(period)}问候已生成。`
    });
    handlers.updatePath?.('apps.goodnight.greetings', next, { keepPhone: true });
    showSystemNotification(currentConfig, greeting);
    return greeting;
  } finally {
    inFlightGreetings.delete(key);
  }
}

export function syncScheduledGreeting(config, handlers, osState = {}, date = new Date()) {
  const app = config.apps?.goodnight;
  if (!app?.enabled) return;
  const period = greetingPeriodFor(date);
  if (!period) return;
  if (period === 'morning' && !app.goodMorning) return;
  if (period === 'night' && !app.goodNight) return;
  void generateAndStoreGreeting(config, handlers, osState, { period });
}
