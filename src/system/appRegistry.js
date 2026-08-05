import { CharacterApp } from '../apps/CharacterApp.js?v=app-config-61';
import { ChatApp } from '../apps/ChatApp.js?v=app-config-72';
import { SettingsApp } from '../apps/SettingsApp.js?v=app-config-61';
import { MusicApp } from '../apps/MusicApp.js?v=app-config-83';
import { PlaceholderApp } from '../apps/PlaceholderApp.js?v=app-config-61';
import { MemoryApp } from '../apps/MemoryApp.js?v=app-config-77';
import { DiaryApp } from '../apps/DiaryApp.js?v=app-config-83';
import { AnniversaryApp } from '../apps/AnniversaryApp.js?v=app-config-83';
import { GoodnightApp } from '../apps/GoodnightApp.js?v=app-config-83';
import { getPath } from './html.js?v=app-config-13';

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

export function isAppEnabled(app, config) {
  if (app.enabled === true) return true;
  if (config.apps?.[app.id]) return Boolean(config.apps[app.id].enabled);
  if (app.enabledBy) return Boolean(getPath(config, app.enabledBy));
  return false;
}

export function getEnabledApps(config) {
  return APP_REGISTRY.filter(app => isAppEnabled(app, config));
}

export function getAppById(appId) {
  return APP_REGISTRY.find(app => app.id === appId);
}
