function cleanId(value, fallback = 'character') {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  return cleaned.length >= 3 ? cleaned : fallback;
}

export function nextAvailableCharacterId(preferred, usedIds = []) {
  const used = usedIds instanceof Set ? usedIds : new Set(usedIds);
  const base = cleanId(preferred, 'character');
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-copy-${suffix}`)) suffix += 1;
  return `${base}-copy-${suffix}`;
}

export function createUniqueCharacterId(characters = [], prefix = 'character') {
  const used = new Set(characters.map(item => item?.id).filter(Boolean));
  const seed = `${cleanId(prefix)}-${Date.now().toString(36)}`;
  return nextAvailableCharacterId(seed, used);
}

export function repairCharacterIds(mainCharacter = {}, extraCharacters = []) {
  const used = new Set();
  const repairs = [];
  const mainOriginal = cleanId(mainCharacter.id, 'character-main');
  const mainId = nextAvailableCharacterId(mainOriginal, used);
  used.add(mainId);
  const main = { ...mainCharacter, id: mainId };

  const characters = (Array.isArray(extraCharacters) ? extraCharacters : [])
    .filter(item => item && typeof item === 'object')
    .slice(0, 11)
    .map((item, index) => {
      const originalId = cleanId(item.id, `character-extra-${index + 1}`);
      const id = nextAvailableCharacterId(originalId, used);
      used.add(id);
      if (id !== originalId) {
        repairs.push({ originalId, newId: id, name: String(item.name || `角色 ${index + 2}`) });
      }
      return { ...item, id };
    });

  return { main, characters, repairs, changed: repairs.length > 0 || mainId !== mainOriginal };
}

export function findDuplicateCharacterIds(config = {}) {
  const ids = [config.character?.id, ...(config.characters || []).map(item => item?.id)].filter(Boolean);
  const seen = new Set();
  return [...new Set(ids.filter(id => seen.has(id) || !seen.add(id)))];
}
