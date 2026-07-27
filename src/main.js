import { renderAppSelectionPanel, bindAppSelectionPanel } from './builder/AppSelectionPanel.js?v=app-config-58';
import { renderAppearancePanel, bindAppearancePanel } from './builder/AppearancePanel.js?v=app-config-61';
import { renderPreviewActions, bindPreviewActions } from './builder/PreviewActions.js?v=app-config-46';
import { renderLovePhoneOS } from './system/LovePhoneOS.js?v=app-config-61';
import { getEnabledApps } from './system/appRegistry.js?v=app-config-61';
import {
  createConfigBackup,
  exportConfig,
  flushConfigSaves,
  getStorageStatusSnapshot,
  importConfigFromFile,
  loadConfig,
  resetConfig,
  restoreLatestConfigBackup,
  saveConfig,
  setStorageStatusListener
} from './storage/localConfigStore.js?v=app-config-59';
import { removeAiProfile } from './services/aiService.js?v=app-config-57';
import { roleProfileId } from './services/aiProfileScope.js?v=app-config-45';
import {
  enqueueAiProfileDelete,
  flushAiProfileDeletes
} from './services/aiProfileCleanup.js?v=app-config-59';
import { purgeCharacterData } from './services/characterDataService.js?v=app-config-59';
import { ensureCharacterChatSession } from './services/chatSessionService.js?v=app-config-59';
import {
  getStandaloneUrl,
  installPwa,
  isPhoneMode,
  isPwaInstallAvailable,
  setupPwa
} from './services/pwaService.js?v=app-config-46';
import { checkStartupHealth } from './services/startupHealthService.js?v=app-config-51';

const app = document.getElementById('app');
const phoneMode = isPhoneMode(
  location.search,
  window.matchMedia?.('(display-mode: standalone)').matches
);
const steps = [
  { id: 'apps', label: '功能' },
  { id: 'appearance', label: '美化' },
  { id: 'save', label: '完成' }
];

const state = {
  config: await loadConfig(),
  activeStep: 'apps',
  phone: {
    currentApp: 'home',
    characterView: 'list',
    selectedCharacterIndex: 0,
    selectedCharacterId: null
  },
  ui: {
    statusMessage: '已加载上次的小手机配置。',
    appConfigId: null,
    appearancePage: 'phone',
    appearanceAppId: 'character',
    installAvailable: isPwaInstallAvailable(),
    storageStatus: getStorageStatusSnapshot()
  }
};

function setPath(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  keys.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
}

function persist(message = '已自动保存。', saveOptions = {}) {
  state.config = saveConfig(state.config, saveOptions);
  state.ui.statusMessage = message;
}

function renderGlobalStorageNotice() {
  const notice = document.getElementById('globalStorageNotice');
  if (!notice) return;
  const storage = state.ui.storageStatus || {};
  const visible = storage.state === 'error' || storage.state === 'warning';
  notice.hidden = !visible;
  notice.className = `global-storage-notice is-${storage.state || 'idle'}`;
  notice.textContent = visible ? storage.message : '';
}

function updatePath(path, value, options = {}) {
  setPath(state.config, path, value);
  if (path === 'character.name') {
    state.config.meta.title = `${value || '我的'}的小手机`;
  }
  persist('已自动保存，右侧手机已更新。');
  if (options.noRender) return;
  render(options);
}

function updatePhoneState(patch) {
  state.phone = { ...state.phone, ...patch };
  render({ keepPhone: true });
}

async function refreshStartupHealth() {
  state.phone.startupHealth = {
    ...(state.phone.startupHealth || {}),
    checking: true
  };
  if (state.phone.currentApp === 'settings') render({ keepPhone: true });
  const health = await checkStartupHealth(state.config, state.ui.storageStatus);
  state.phone.startupHealth = { ...health, checking: false };
  const before = state.config.aiProviders?.pendingProfileDeletes?.length || 0;
  state.config = await flushAiProfileDeletes(
    state.config,
    profileId => removeAiProfile(state.config, profileId)
  );
  if (before !== (state.config.aiProviders?.pendingProfileDeletes?.length || 0)) {
    state.config = saveConfig(state.config);
  }
  if (state.phone.currentApp === 'settings') render({ keepPhone: true });
}

function setStep(stepId) {
  state.ui.appConfigId = null;
  if (stepId === 'appearance') {
    state.ui.appearancePage = 'phone';
    state.phone.currentApp = 'home';
  }
  state.activeStep = stepId;
  render();
}

function getPanelHtml() {
  if (state.activeStep === 'appearance') return renderAppearancePanel(state.config, state.ui);
  if (state.activeStep === 'save') return renderPreviewActions(state.config, state.ui);
  return renderAppSelectionPanel(state.config, state.ui);
}

function openPhoneApp(appId) {
  state.phone.currentApp = appId;
  render({ keepPhone: true });
}

function selectCharacter(characterId, phonePatch = {}) {
  const characters = [state.config.character, ...(state.config.characters || [])];
  const index = characters.findIndex(character => character.id === characterId);
  if (index < 0) return;
  state.config.apps.chat = ensureCharacterChatSession(state.config.apps.chat, characterId);
  setPath(state.config, 'apps.character.activeCharacterId', characterId);
  state.phone = {
    ...state.phone,
    selectedCharacterId: characterId,
    selectedCharacterIndex: index,
    ...phonePatch
  };
  persist('当前角色已切换。');
  render({ keepPhone: true });
}

function deleteCharacter(characterId) {
  const characters = [state.config.character, ...(state.config.characters || [])];
  if (characters.length <= 1) return;
  const remaining = characters.filter(character => character.id !== characterId);
  if (remaining.length === characters.length) return;
  state.config = enqueueAiProfileDelete(state.config, roleProfileId(characterId));

  state.config.character = remaining[0];
  state.config.characters = remaining.slice(1);
  const removedSessionIds = new Set(
    (state.config.apps.chat.sessions || [])
      .filter(session => session.characterId === characterId)
      .map(session => session.id)
  );
  state.config = purgeCharacterData(state.config, characterId);

  const previousActiveId = state.config.apps.character.activeCharacterId;
  const activeCharacterId = remaining.some(character => character.id === previousActiveId)
    ? previousActiveId
    : remaining[0].id;
  state.config.apps.character.activeCharacterId = activeCharacterId;
  state.config.meta.title = `${state.config.character.name || '我的'}的小手机`;
  state.phone = {
    ...state.phone,
    characterView: 'list',
    characterDeleteConfirmId: null,
    selectedCharacterId: activeCharacterId,
    selectedCharacterIndex: remaining.findIndex(character => character.id === activeCharacterId),
    ephemeralChatMessages: Object.fromEntries(
      Object.entries(state.phone.ephemeralChatMessages || {})
        .filter(([sessionId]) => !removedSessionIds.has(sessionId))
    )
  };
  persist('角色及其聊天和记忆已删除。');
  void flushAiProfileDeletes(
    state.config,
    profileId => removeAiProfile(state.config, profileId)
  ).then(nextConfig => {
    state.config.aiProviders.pendingProfileDeletes =
      nextConfig.aiProviders.pendingProfileDeletes;
    state.config = saveConfig(state.config);
  });
  render({ keepPhone: true });
}

function moveCharacter(characterId, direction) {
  const characters = [state.config.character, ...(state.config.characters || [])];
  const index = characters.findIndex(character => character.id === characterId);
  const target = index + Math.sign(direction);
  if (index < 0 || target < 0 || target >= characters.length) return;
  [characters[index], characters[target]] = [characters[target], characters[index]];
  state.config.character = characters[0];
  state.config.characters = characters.slice(1);
  state.phone.selectedCharacterIndex = target;
  state.phone.selectedCharacterId = characterId;
  persist('角色顺序已更新。');
  render({ keepPhone: true });
}

function duplicateCharacter(characterId) {
  const characters = [state.config.character, ...(state.config.characters || [])];
  const limit = Number(state.config.apps.character?.maxCharacters) || 3;
  if (characters.length >= limit) return;
  const source = characters.find(character => character.id === characterId);
  if (!source) return;
  const duplicate = structuredClone(source);
  duplicate.id = `character-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  duplicate.name = `${source.name || '角色'} 副本`;
  state.config.characters = [...(state.config.characters || []), duplicate];
  state.config.apps.character.activeCharacterId = duplicate.id;
  state.phone = {
    ...state.phone,
    characterView: 'detail',
    selectedCharacterId: duplicate.id,
    selectedCharacterIndex: characters.length,
    characterNotice: '已复制角色设定；聊天、记忆和 API 密钥不会复制。'
  };
  persist('角色设定已复制。');
  render({ keepPhone: true });
}

function bindFlowActions(root) {
  root.querySelectorAll('[data-next-step]').forEach(button => {
    button.addEventListener('click', () => setStep(button.dataset.nextStep));
  });
}

function bindPanel(root) {
  const handlers = {
    getConfig: () => state.config,
    updatePath,
    updatePhoneState,
    openPhoneApp,
    selectCharacter,
    deleteCharacter,
    moveCharacter,
    duplicateCharacter,
    setAppearancePage: page => {
      state.ui.appearancePage = page === 'apps' ? 'apps' : 'phone';
      if (state.ui.appearancePage === 'apps') {
        const enabledApps = getEnabledApps(state.config);
        const selectedApp = enabledApps.find(app => app.id === state.ui.appearanceAppId) || enabledApps[0];
        state.ui.appearanceAppId = selectedApp?.id || 'character';
        state.phone.currentApp = state.ui.appearanceAppId;
      } else {
        state.phone.currentApp = 'home';
      }
      render();
    },
    selectAppearanceApp: appId => {
      state.ui.appearanceAppId = appId;
      state.phone.currentApp = appId;
      if (appId === 'character') state.phone.characterView = 'list';
      render();
    },
    setAppTheme: (appId, themeId) => {
      setPath(state.config, `theme.appLooks.${appId}.uiTheme`, themeId);
      state.phone.currentApp = appId;
      persist('App 界面主题已更新。');
      render();
    },
    applyAppThemeToAll: themeId => {
      const appLooks = { ...(state.config.theme.appLooks || {}) };
      Object.keys(state.config.apps || {}).forEach(appId => {
        appLooks[appId] = {
          ...(appLooks[appId] || {}),
          uiTheme: themeId
        };
      });
      setPath(state.config, 'theme.appLooks', appLooks);
      persist('界面主题已应用到全部 App。');
      render();
    },
    updateAppIcon: (appId, image) => {
      setPath(state.config, `theme.appLooks.${appId}.icon`, {
        mode: 'upload',
        value: image
      });
      persist('App 图标已更新。');
      render();
    },
    resetAppIcon: appId => {
      setPath(state.config, `theme.appLooks.${appId}.icon`, {
        mode: 'preset',
        value: ''
      });
      persist('App 图标已恢复默认。');
      render();
    },
    openAppConfig: appId => {
      state.ui.appConfigId = appId;
      state.phone.currentApp = appId;
      if (appId === 'character') {
        state.phone.characterView = 'list';
        state.phone.selectedCharacterIndex = 0;
      }
      render();
    },
    closeAppConfig: () => {
      state.ui.appConfigId = null;
      state.ui.appearancePage = 'phone';
      state.ui.appearanceAppId = 'character';
      render();
    },
    setAppEnabled: (appId, enabled) => {
      setPath(state.config, `components.${appId}`, enabled);
      setPath(state.config, `apps.${appId}.enabled`, enabled);
      state.phone.currentApp = enabled ? appId : 'home';
      persist(enabled ? '功能已开启。' : '功能已关闭。');
      render();
    },
    save: async () => {
      await createConfigBackup(state.config);
      state.ui.statusMessage = '已保存并创建本地备份。';
      render();
    },
    backup: async () => {
      await createConfigBackup(state.config);
      state.ui.statusMessage = '本地备份已创建。';
      render();
    },
    restoreBackup: async () => {
      try {
        state.config = await restoreLatestConfigBackup();
        state.ui.statusMessage = '最近的本地备份已恢复。';
        state.phone.currentApp = 'home';
      } catch (error) {
        state.ui.statusMessage = error.message || '恢复备份失败。';
      }
      render();
    },
    openStandalone: async () => {
      persist('已保存，正在打开独立小手机。');
      await flushConfigSaves();
      window.open(getStandaloneUrl(), '_blank', 'noopener');
      render();
    },
    install: async () => {
      const result = await installPwa();
      state.ui.installAvailable = isPwaInstallAvailable();
      state.ui.statusMessage = result.outcome === 'accepted'
        ? '安装请求已确认。'
        : result.outcome === 'dismissed'
          ? '已取消安装。'
          : '请先打开独立小手机，再从浏览器菜单选择“安装应用”。';
      render();
    },
    exportJson: () => {
      const filename = exportConfig(state.config);
      state.ui.statusMessage = `已导出 ${filename}`;
      render();
    },
    importJson: async file => {
      try {
        state.config = await importConfigFromFile(file);
        persist('导入成功，已保存到本地。', {
          forceBackup: true,
          reason: 'before-import'
        });
      } catch (error) {
        state.ui.statusMessage = error.message || '导入失败，请检查 JSON。';
      }
      render();
    },
    reset: () => {
      const confirmed = window.confirm(
        '确定重置整台小手机吗？\n\n角色、聊天、记忆、日记、美化和服务配置都会恢复默认。系统会先创建一份可恢复的本地备份。'
      );
      if (!confirmed) {
        state.ui.statusMessage = '已取消重置。';
        return;
      }
      state.config = resetConfig();
      state.phone.currentApp = 'home';
      state.phone.characterView = 'list';
      state.phone.selectedCharacterIndex = 0;
      state.phone.selectedCharacterId = null;
      state.activeStep = 'apps';
      state.ui.appConfigId = null;
      state.ui.statusMessage = '已重置为默认小手机配置。';
      render();
    }
  };

  bindAppSelectionPanel(root, handlers);
  bindAppearancePanel(root, handlers);
  bindPreviewActions(root, handlers);
  bindFlowActions(root);
}

function renderStepNav() {
  return `
    <nav class="step-nav" aria-label="搭建步骤">
      ${steps.map((step, index) => `
        <button class="${state.activeStep === step.id ? 'active' : ''}" type="button" data-step="${step.id}">
          <span>${index + 1}</span>
          ${step.label}
        </button>
      `).join('')}
    </nav>
  `;
}

function createPhoneHandlers() {
  return {
    getConfig: () => state.config,
    updatePath,
    updatePhoneState,
    selectCharacter,
    deleteCharacter,
    moveCharacter,
    duplicateCharacter,
    checkStartupHealth: refreshStartupHealth,
    updateWeatherLocation: location => {
      setPath(state.config, 'theme.widgets.weather.city', location.city);
      setPath(state.config, 'theme.widgets.weather.latitude', location.latitude);
      setPath(state.config, 'theme.widgets.weather.longitude', location.longitude);
      persist(`天气位置已更新为 ${location.city}。`);
      render({ keepPhone: true });
    },
    openApp: appId => {
      state.phone.currentApp = appId;
      if (appId === 'character') {
        state.phone.characterView = 'list';
      }
      render({ keepPhone: true });
    },
    goHome: () => {
      state.phone.currentApp = 'home';
      render({ keepPhone: true });
    },
    exportJson: () => {
      const filename = exportConfig(state.config);
      state.ui.statusMessage = `已导出 ${filename}`;
    },
    importJson: async file => {
      try {
        state.config = await importConfigFromFile(file);
        persist('导入成功，已保存到本地。', {
          forceBackup: true,
          reason: 'before-import'
        });
      } catch (error) {
        state.ui.statusMessage = error.message || '导入失败，请检查 JSON。';
      }
      render({ keepPhone: true });
    }
  };
}

function render(options = {}) {
  const keepPhone = options.keepPhone === true;
  const phoneHandlers = createPhoneHandlers();

  if (phoneMode) {
    if (!keepPhone || !document.getElementById('lovePhoneOS')) {
      app.innerHTML = `
        <main class="standalone-phone-shell">
          <div id="lovePhoneOS"></div>
        </main>
        <div id="globalStorageNotice" class="global-storage-notice" role="alert" hidden></div>
      `;
    }
    renderLovePhoneOS(document.getElementById('lovePhoneOS'), state.config, state.phone, phoneHandlers);
    return;
  }

  if (!keepPhone) {
    app.innerHTML = `
      <main class="studio-shell">
        <section class="builder-pane">
          <header class="studio-header">
            <p class="eyebrow">LovePhone Studio｜小手机工坊</p>
            <h1>先选功能，再生成小手机</h1>
            <p>角色、聊天和设置是必带能力；其他功能先作为可选项。点开配置后，右侧手机会直接进入对应 App。</p>
          </header>
          ${renderStepNav()}
          <div class="panel-host">
            ${getPanelHtml()}
          </div>
        </section>
        <aside class="preview-pane">
          <div id="lovePhoneOS"></div>
        </aside>
      </main>
      <div id="globalStorageNotice" class="global-storage-notice" role="alert" hidden></div>
    `;

    app.querySelectorAll('[data-step]').forEach(button => {
      button.addEventListener('click', () => setStep(button.dataset.step));
    });

    bindPanel(app);
  }

  renderLovePhoneOS(document.getElementById('lovePhoneOS'), state.config, state.phone, phoneHandlers);
  renderGlobalStorageNotice();
}

setupPwa({
  onInstallAvailabilityChange: available => {
    state.ui.installAvailable = available;
    if (!phoneMode && state.activeStep === 'save') render();
  }
});
setStorageStatusListener(status => {
  state.ui.storageStatus = status;
  renderGlobalStorageNotice();
  if (!phoneMode && state.activeStep === 'save') render();
});
render();
void refreshStartupHealth();
