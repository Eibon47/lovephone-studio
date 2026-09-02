import { createUniqueCharacterId } from './characterIdentityService.js';

export const ROLE_PACKAGE_FORMAT = 'lovephone-role';
export const ROLE_PACKAGE_VERSION = 1;
const ROLE_FIELDS = ['name', 'userName', 'relationship', 'personality', 'speakingStyle', 'greeting', 'definition', 'avatar', 'aiProviderId'];

function pickRole(character = {}) {
  const role = Object.fromEntries(ROLE_FIELDS.map(key => [key, structuredClone(character[key])]).filter(([, value]) => value !== undefined));
  role.aiProfiles = Object.fromEntries(Object.entries(character.aiProfiles || {}).map(([providerId, profile]) => [providerId, {
    model: String(profile?.model || '').slice(0, 160),
    baseUrl: String(profile?.baseUrl || '').slice(0, 300)
  }]));
  return role;
}

export function characterDataSummary(config, characterId) {
  const chat = config.apps?.chat || {};
  const sessions = (chat.sessions || []).filter(item => item.characterId === characterId);
  const sessionIds = new Set(sessions.map(item => item.id));
  return {
    sessions: sessions.length,
    messages: (chat.messages || []).filter(item => item.characterId === characterId || sessionIds.has(item.sessionId)).length,
    memories: (config.apps?.memory?.entries || []).filter(item => item.characterId === characterId).length,
    diaries: (config.apps?.diary?.entries || []).filter(item => item.characterId === characterId).length,
    tasks: (config.companion?.tasks || []).filter(item => item.characterId === characterId).length,
    notifications: (config.companion?.notifications || []).filter(item => item.characterId === characterId).length
  };
}

export function createCharacterPackage(config, characterId, includes = {}) {
  const character = [config.character, ...(config.characters || [])].find(item => item.id === characterId);
  if (!character) throw new Error('找不到要导出的角色。');
  const payload = { format: ROLE_PACKAGE_FORMAT, formatVersion: ROLE_PACKAGE_VERSION, exportedAt: new Date().toISOString(), character: pickRole(character), data: {} };
  if (includes.chat) {
    const sessions = (config.apps.chat.sessions || []).filter(item => item.characterId === characterId);
    const ids = new Set(sessions.map(item => item.id));
    payload.data.chat = { sessions: sessions.map(item => ({ ...item })), messages: (config.apps.chat.messages || []).filter(item => ids.has(item.sessionId)).map(item => ({ ...item })) };
  }
  if (includes.memory) payload.data.memories = (config.apps.memory?.entries || []).filter(item => item.characterId === characterId).map(item => ({ ...item }));
  if (includes.diary) payload.data.diaries = (config.apps.diary?.entries || []).filter(item => item.characterId === characterId).map(item => ({ ...item }));
  return payload;
}

export function parseCharacterPackage(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('角色文件不是有效的 JSON。'); }
  if (parsed?.format !== ROLE_PACKAGE_FORMAT || parsed?.formatVersion !== ROLE_PACKAGE_VERSION || !parsed.character?.name) throw new Error('这不是兼容的 LovePhone 角色文件。');
  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
  return {
    character: pickRole(parsed.character),
    data: { chat: data.chat && typeof data.chat === 'object' ? data.chat : null, memories: Array.isArray(data.memories) ? data.memories : [], diaries: Array.isArray(data.diaries) ? data.diaries : [] },
    summary: { messages: Array.isArray(data.chat?.messages) ? data.chat.messages.length : 0, memories: Array.isArray(data.memories) ? data.memories.length : 0, diaries: Array.isArray(data.diaries) ? data.diaries.length : 0 }
  };
}

export function importCharacterPackage(config, parsed) {
  const characters = [config.character, ...(config.characters || [])];
  const id = createUniqueCharacterId(characters, 'character-imported');
  const now = new Date().toISOString();
  const character = { ...parsed.character, id, aiProfiles: parsed.character.aiProfiles || {} };
  const sessionIdMap = new Map();
  const sessions = (parsed.data.chat?.sessions || []).map((session, index) => {
    const nextId = `session-${id}-${index + 1}`;
    sessionIdMap.set(session.id, nextId);
    return { ...session, id: nextId, characterId: id, createdAt: session.createdAt || now, updatedAt: session.updatedAt || now, lastReadAt: now };
  });
  const messages = (parsed.data.chat?.messages || []).map(message => ({ ...message, id: `msg-imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, characterId: id, sessionId: sessionIdMap.get(message.sessionId) || sessions[0]?.id, requestStatus: 'sent' })).filter(message => message.sessionId);
  return {
    ...config,
    characters: [...(config.characters || []), character],
    apps: {
      ...config.apps,
      character: { ...config.apps.character, activeCharacterId: id },
      chat: { ...config.apps.chat, sessions: [...(config.apps.chat.sessions || []), ...sessions], messages: [...(config.apps.chat.messages || []), ...messages], activeSessionIds: { ...config.apps.chat.activeSessionIds, ...(sessions[0] ? { [id]: sessions[0].id } : {}) } },
      memory: { ...config.apps.memory, entries: [...(config.apps.memory?.entries || []), ...parsed.data.memories.map(item => ({ ...item, characterId: id }))] },
      diary: { ...config.apps.diary, entries: [...(config.apps.diary?.entries || []), ...parsed.data.diaries.map(item => ({ ...item, characterId: id }))] }
    }
  };
}

export function downloadCharacterPackage(payload, name = 'lovephone-role') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(name).replace(/[\\/:*?"<>|]/g, '-')}.lovephone-role.json`;
  link.click();
  URL.revokeObjectURL(url);
}
