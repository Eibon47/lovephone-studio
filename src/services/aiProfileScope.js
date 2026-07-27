export function roleProfileId(characterOrId) {
  const id = typeof characterOrId === 'string' ? characterOrId : characterOrId?.id;
  const safeId = String(id || 'character-main').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 90);
  return `role-${safeId}`;
}

export function resolveCharacterAiProfile(config, character) {
  const usesRoleProfile = Boolean(
    config.apps?.settings?.perRoleApi
    && character?.aiProviderId
  );
  const providerId = usesRoleProfile
    ? character.aiProviderId
    : config.aiProviders?.activeId;
  return {
    providerId,
    profileId: usesRoleProfile ? roleProfileId(character) : providerId,
    scope: usesRoleProfile ? 'character' : 'global'
  };
}

export function characterConfigPath(config, characterId) {
  if (config.character?.id === characterId) return 'character';
  const index = (config.characters || []).findIndex(character => character.id === characterId);
  return index >= 0 ? `characters.${index}` : '';
}

export function characterByScope(config, scopeId) {
  if (!String(scopeId || '').startsWith('role:')) return null;
  const characterId = String(scopeId).slice(5);
  return [config.character, ...(config.characters || [])]
    .find(character => character.id === characterId) || null;
}
