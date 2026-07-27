function cleanId(value) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{3,120}$/.test(id) ? id : '';
}

export function defaultChatSessionId(characterId) {
  return `session-${cleanId(characterId) || 'character-main'}-main`;
}

function defaultSession(characterId, createdAt) {
  return {
    id: defaultChatSessionId(characterId),
    characterId,
    title: '默认会话',
    createdAt,
    updatedAt: createdAt
  };
}

export function normalizeChatSessionData(chat = {}, characterIds = [], fallbackDate = '') {
  const validCharacters = new Set(characterIds);
  const now = fallbackDate || new Date().toISOString();
  const usedIds = new Set();
  const sessions = [];

  for (const source of Array.isArray(chat.sessions) ? chat.sessions : []) {
    const characterId = cleanId(source?.characterId);
    const id = cleanId(source?.id);
    if (!id || usedIds.has(id) || !validCharacters.has(characterId)) continue;
    usedIds.add(id);
    sessions.push({
      id,
      characterId,
      title: String(source.title || '未命名会话').trim().slice(0, 30) || '未命名会话',
      createdAt: source.createdAt || now,
      updatedAt: source.updatedAt || source.createdAt || now
    });
  }

  for (const characterId of characterIds) {
    if (sessions.some(session => session.characterId === characterId)) continue;
    const session = defaultSession(characterId, now);
    if (!usedIds.has(session.id)) {
      usedIds.add(session.id);
      sessions.push(session);
    }
  }

  const activeSessionIds = {};
  for (const characterId of characterIds) {
    const requested = cleanId(chat.activeSessionIds?.[characterId]);
    const selected = sessions.find(session => (
      session.characterId === characterId && session.id === requested
    )) || sessions.find(session => session.characterId === characterId);
    if (selected) activeSessionIds[characterId] = selected.id;
  }

  const messages = (Array.isArray(chat.messages) ? chat.messages : []).map(message => {
    const characterId = validCharacters.has(message?.characterId)
      ? message.characterId
      : characterIds[0];
    const requestedSessionId = cleanId(message?.sessionId);
    const sessionId = sessions.some(session => (
      session.characterId === characterId && session.id === requestedSessionId
    ))
      ? requestedSessionId
      : activeSessionIds[characterId];
    return { ...message, characterId, sessionId };
  });

  return { sessions, activeSessionIds, messages };
}

export function sessionsForCharacter(chat, characterId) {
  return (chat.sessions || [])
    .filter(session => session.characterId === characterId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function activeChatSession(chat, characterId) {
  const sessions = sessionsForCharacter(chat, characterId);
  return sessions.find(session => session.id === chat.activeSessionIds?.[characterId])
    || sessions[0]
    || null;
}

export function ensureCharacterChatSession(chat, characterId, now = new Date().toISOString()) {
  const existing = sessionsForCharacter(chat, characterId);
  if (existing.length) {
    const active = existing.find(session => session.id === chat.activeSessionIds?.[characterId])
      || existing[0];
    return {
      ...chat,
      activeSessionIds: {
        ...(chat.activeSessionIds || {}),
        [characterId]: active.id
      }
    };
  }
  const session = defaultSession(characterId, now);
  return {
    ...chat,
    sessions: [...(chat.sessions || []), session],
    activeSessionIds: {
      ...(chat.activeSessionIds || {}),
      [characterId]: session.id
    }
  };
}

export function messagesForSession(chat, characterId, sessionId) {
  return (chat.messages || []).filter(message => (
    message.characterId === characterId && message.sessionId === sessionId
  ));
}

export function replaceSessionMessages(chat, characterId, sessionId, messages) {
  const untouched = (chat.messages || []).filter(message => !(
    message.characterId === characterId && message.sessionId === sessionId
  ));
  const scoped = messages.map(message => ({
    ...message,
    characterId,
    sessionId
  }));
  return [...untouched, ...scoped];
}

export function applyChatMessageUpdate(chat, options) {
  const {
    characterId,
    sessionId,
    messages,
    persist,
    ephemeralMessages = {},
    now = new Date().toISOString()
  } = options;
  const scoped = messages.map(message => ({
    ...message,
    characterId,
    sessionId
  }));

  if (!persist) {
    return {
      persisted: false,
      chat,
      ephemeralMessages: {
        ...ephemeralMessages,
        [sessionId]: scoped
      }
    };
  }

  const firstUser = scoped.find(message => message.from === 'user')?.text?.trim();
  const sessions = (chat.sessions || []).map(session => {
    if (session.id !== sessionId) return session;
    const shouldName = /^(?:默认会话|新会话(?: \d+)?)$/.test(session.title || '');
    return {
      ...session,
      title: shouldName && firstUser ? firstUser.slice(0, 18) : session.title,
      updatedAt: now
    };
  });
  return {
    persisted: true,
    ephemeralMessages,
    chat: {
      ...chat,
      sessions,
      messages: replaceSessionMessages(chat, characterId, sessionId, scoped)
    }
  };
}
