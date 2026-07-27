export function purgeCharacterData(config, characterId) {
  const chat = config.apps?.chat || {};
  const sessions = (chat.sessions || []).filter(session => session.characterId !== characterId);
  const activeSessionIds = { ...(chat.activeSessionIds || {}) };
  delete activeSessionIds[characterId];

  return {
    ...config,
    apps: {
      ...config.apps,
      chat: {
        ...chat,
        sessions,
        activeSessionIds,
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
