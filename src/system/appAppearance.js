import { iconMap, safeUploadedImage } from './icons.js?v=app-config-61';

export const APP_UI_THEMES = [
  { id: 'lovephone', label: 'LovePhone', desc: '保留当前柔和、轻盈的小手机风格。' },
  { id: 'wechat', label: '清简通讯', desc: '克制列表、浅灰底色和清晰分组。' },
  { id: 'qq', label: '晴空社交', desc: '轻蓝强调、圆润气泡和活泼状态感。' },
  { id: 'instagram', label: '影像社交', desc: '纯白界面、头像视觉和鲜明互动按钮。' },
  { id: 'x', label: '黑白信息流', desc: '黑白高对比、细分隔线和紧凑信息层级。' }
];

export const APP_UI_THEME_IDS = APP_UI_THEMES.map(theme => theme.id);

export function getAppLook(config, appId) {
  const look = config.theme?.appLooks?.[appId] || {};
  return {
    uiTheme: APP_UI_THEME_IDS.includes(look.uiTheme) ? look.uiTheme : 'lovephone',
    icon: {
      mode: look.icon?.mode === 'upload' ? 'upload' : 'preset',
      value: typeof look.icon?.value === 'string' ? look.icon.value : ''
    }
  };
}

export function getAppIcon(config, app) {
  if (app.iconUrl && /^data:image\//i.test(app.iconUrl)) return app.iconUrl;
  const customization = config.theme?.customization;
  const customIcon = getAppLook(config, app.id).icon;
  const uploaded = safeUploadedImage(customIcon.value);
  if (customIcon.mode === 'upload' && uploaded) {
    return uploaded;
  }
  const customAppIcon = safeUploadedImage(customization?.appThemes?.[app.id]?.icon);
  if (customAppIcon) return customAppIcon;
  const packIcon = customization?.active?.iconPack
    ? safeUploadedImage(customization?.iconPack?.icons?.[app.id])
    : '';
  if (packIcon) return packIcon;
  return iconMap[app.icon] || iconMap.heart;
}

export function getAppTheme(config, appId) {
  return getAppLook(config, appId).uiTheme;
}
