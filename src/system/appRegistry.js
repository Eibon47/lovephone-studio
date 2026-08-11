import { CharacterApp } from '../apps/CharacterApp.js?v=app-config-96';
import { ChatApp } from '../apps/ChatApp.js?v=app-config-95';
import { SettingsApp } from '../apps/SettingsApp.js?v=app-config-93';
import { MusicApp } from '../apps/MusicApp.js?v=app-config-93';
import { PlaceholderApp } from '../apps/PlaceholderApp.js?v=app-config-61';
import { MemoryApp } from '../apps/MemoryApp.js?v=app-config-96';
import { DiaryApp } from '../apps/DiaryApp.js?v=app-config-83';
import { AnniversaryApp } from '../apps/AnniversaryApp.js?v=app-config-83';
import { GoodnightApp } from '../apps/GoodnightApp.js?v=app-config-83';
import { getPath } from './html.js?v=app-config-13';
import { CustomAppRuntime, customAppIcon } from './CustomAppRuntime.js';

export const APP_REGISTRY = [
  {
    id: 'character',
    name: '\u89d2\u8272',
    icon: 'character',
    enabled: true,
    dock: false,
    component: CharacterApp
  },
  {
    id: 'chat',
    name: '\u804a\u5929',
    icon: 'chat',
    enabled: true,
    dock: true,
    component: ChatApp
  },
  {
    id: 'memory',
    name: '\u8bb0\u5fc6',
    icon: 'memory',
    enabledBy: 'components.memory',
    dock: true,
    component: MemoryApp
  },
  {
    id: 'music',
    name: '音乐',
    icon: 'music',
    enabledBy: 'components.music',
    dock: false,
    component: MusicApp
  },
  {
    id: 'diary',
    name: '\u65e5\u8bb0',
    icon: 'diary',
    enabledBy: 'components.diary',
    dock: false,
    component: DiaryApp
  },
  {
    id: 'anniversary',
    name: '\u7eaa\u5ff5\u65e5',
    icon: 'anniversary',
    enabledBy: 'components.anniversary',
    dock: false,
    component: AnniversaryApp
  },
  {
    id: 'goodnight',
    name: '\u665a\u5b89\u95ee\u5019',
    icon: 'goodnight',
    enabledBy: 'components.goodnight',
    dock: true,
    component: GoodnightApp
  },
  {
    id: 'settings',
    name: '\u8bbe\u7f6e',
    icon: 'settings',
    enabled: true,
    dock: true,
    component: SettingsApp
  }
];

export function isAppEnabled(app, config, runtimeCapabilities = {}) {
  if (app.requiresRuntimeCapability && runtimeCapabilities[app.requiresRuntimeCapability] === false) {
    return false;
  }
  if (app.enabled === true) return true;
  if (config.apps?.[app.id]) return Boolean(config.apps[app.id].enabled);
  if (app.enabledBy) return Boolean(getPath(config, app.enabledBy));
  return false;
}

export function customAppRegistryItems(customApps = []) {
  return (Array.isArray(customApps) ? customApps : [])
    .filter(app => app && app.enabled !== false && app.id && app.manifest)
    .map(app => ({
      id: `custom-${app.id}`,
      customAppId: app.id,
      name: app.name || app.manifest.name || '自定义 App',
      icon: 'settings',
      iconUrl: customAppIcon(app),
      enabled: true,
      dock: false,
      component: CustomAppRuntime
    }));
}

export function getEnabledApps(config, runtimeCapabilities = {}, customApps = []) {
  return [
    ...APP_REGISTRY.filter(app => isAppEnabled(app, config, runtimeCapabilities)),
    ...customAppRegistryItems(customApps)
  ];
}

export function getAppById(appId, customApps = []) {
  return APP_REGISTRY.find(app => app.id === appId)
    || customAppRegistryItems(customApps).find(app => app.id === appId);
}
