export function purgeCharacterData(config, characterId) {
  const chat = config.apps?.chat || {};
  const sessions = (chat.sessions || []).filter(session => session.characterId !== characterId);
  const removedSessionIds = new Set(
    (chat.sessions || [])
      .filter(session => session.characterId === characterId)
      .map(session => session.id)
  );
  const activeSessionIds = { ...(chat.activeSessionIds || {}) };
  delete activeSessionIds[characterId];
  const drafts = Object.fromEntries(
    Object.entries(chat.drafts || {}).filter(([sessionId]) => !removedSessionIds.has(sessionId))
  );

  return {
    ...config,
    apps: {
      ...config.apps,
      chat: {
        ...chat,
        sessions,
        activeSessionIds,
        drafts,
        messages: (chat.messages || []).filter(message => message.characterId !== characterId)
      },
      memory: {
        ...config.apps.memory,
        entries: (config.apps.memory?.entries || [])
          .filter(entry => entry.characterId !== characterId)
      },
      diary: {
        ...config.apps.diary,
        entries: (config.apps.diary?.entries || [])
          .filter(entry => entry.characterId !== characterId)
      },
      goodnight: {
        ...config.apps.goodnight,
        entries: (config.apps.goodnight?.entries || [])
          .filter(entry => entry.characterId !== characterId),
        greetings: (config.apps.goodnight?.greetings || [])
          .filter(entry => entry.characterId !== characterId)
      }
    }
  };
}
