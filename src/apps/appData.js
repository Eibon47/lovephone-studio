export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shortDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

export function timeLabel(value = new Date().toISOString()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function activeCharacter(config, osState = {}) {
  const characters = [config.character, ...(config.characters || [])];
  const activeId = osState.selectedCharacterId || config.apps?.character?.activeCharacterId;
  const selectedById = characters.find(character => character.id === activeId);
  if (selectedById) return selectedById;
  return characters[Math.max(0, Math.min(Number(osState.selectedCharacterIndex || 0), characters.length - 1))]
    || config.character;
}
