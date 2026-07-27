export const assetBase = 'assets/theme-fantasy';

export const iconMap = {
  heart: `${assetBase}/ui-icons/heart.png`,
  chat: `${assetBase}/ui-icons/chat.png`,
  character: `${assetBase}/ui-icons/people.png`,
  memory: `${assetBase}/ui-icons/sparkle.png`,
  music: `${assetBase}/ui-icons/music.png`,
  diary: `${assetBase}/ui-icons/diary.png`,
  anniversary: `${assetBase}/ui-icons/clock.png`,
  goodnight: `${assetBase}/ui-icons/moon.png`,
  sprout: `${assetBase}/ui-icons/sprout.png`,
  moon: `${assetBase}/ui-icons/moon.png`,
  settings: `${assetBase}/ui-icons/bell.png`
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
