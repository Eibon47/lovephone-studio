import { localDateKey } from '../apps/appData.js';
import { isIntegrationEnabled } from './companionPolicyService.js';

export function latestCharacterGreeting(config, characterId, date = localDateKey()) {
  return (config.apps?.goodnight?.greetings || [])
    .filter(item => item?.characterId === characterId && item?.date === date && item?.message)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))[0] || null;
}

export function characterPresence(config, character, osState = {}) {
  const greeting = latestCharacterGreeting(config, character?.id);
  const isChatting = osState.chatView === 'conversation'
    && osState.chatCharacterId === character?.id;

  if (isChatting) {
    return { label: '正在和你聊天', detail: '这段对话只属于你们' };
  }
  if (greeting) {
    return { label: '给你留了问候', detail: greeting.message, greeting };
  }
  if (isIntegrationEnabled(config, 'relationshipDesktop')) {
    const signal = config.companion?.relationshipSignals?.[character?.id];
    if (signal?.lastMood) return { label: `最近感到${signal.lastMood}`, detail: '来自你们最近一次互动', greeting: null };
    if (signal?.interactionCount > 0) return { label: '关系正在积累', detail: `已经留下 ${signal.interactionCount} 次互动信号`, greeting: null };
  }
  return { label: '在线陪伴', detail: '有空时随时可以来聊聊', greeting: null };
}
