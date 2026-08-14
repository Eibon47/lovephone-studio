export const assetBase = 'assets/theme-fantasy';

const exportedIconAssets = globalThis.__LOVE_PHONE_ICON_ASSETS__ || {};

function builtInIcon(name) {
  const embedded = exportedIconAssets[name];
  return typeof embedded === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(embedded)
    ? embedded
    : `${assetBase}/ui-icons/${name}.png`;
}

export const iconMap = {
  heart: builtInIcon('heart'),
  chat: builtInIcon('chat'),
  character: builtInIcon('people'),
  memory: builtInIcon('sparkle'),
  music: builtInIcon('music'),
  diary: builtInIcon('diary'),
  anniversary: builtInIcon('clock'),
  goodnight: builtInIcon('moon'),
  sprout: builtInIcon('sprout'),
  moon: builtInIcon('moon'),
  settings: builtInIcon('bell')
};

export function safeUploadedImage(value) {
  const source = String(value || '');
  if (source.length > 2_000_000) return '';
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/.test(source)
    ? source
    : '';
}

export function getCharacterAvatar(character) {
  const avatar = character?.avatar || {};
  const uploaded = safeUploadedImage(avatar.value);
  if (avatar.type === 'upload' && uploaded) {
    return uploaded;
  }
  return iconMap[avatar.value] || iconMap.heart;
}

export function getAvatarIcon(config) {
  return getCharacterAvatar(config.character);
}
