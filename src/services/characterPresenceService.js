import { localDateKey } from '../apps/appData.js';

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
  return { label: '在线陪伴', detail: '有空时随时可以来聊聊', greeting: null };
}
