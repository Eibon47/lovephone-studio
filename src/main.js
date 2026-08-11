import { renderAppSelectionPanel, bindAppSelectionPanel } from './builder/AppSelectionPanel.js?v=app-config-86';
import { renderAppearancePanel, bindAppearancePanel } from './builder/AppearancePanel.js?v=app-config-84';
import { renderCustomizationDrawer } from './builder/CustomizationDrawer.js?v=app-config-84';
import { renderAiAssistantPanel, bindAiAssistantPanel } from './builder/AiAssistantPanel.js?v=app-config-87';
import { renderPreviewActions, bindPreviewActions } from './builder/PreviewActions.js?v=app-config-46';
import { renderLovePhoneOS } from './system/LovePhoneOS.js?v=app-config-96';
import { getEnabledApps } from './system/appRegistry.js?v=app-config-96';
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
  setStorageStatusListener,
  summarizeImportedConfig
} from './storage/localConfigStore.js?v=app-config-94';
import {
  configureAiProvider,
  removeAiProfile,
  streamAiChat,
  testAiProvider
} from './services/aiService.js?v=app-config-85';
import { cloneConfig } from './config/defaultConfig.js?v=app-config-95';
import {
  applyBuilderAssistantOperations,
  buildBuilderAssistantSystemPrompt,
  createBuilderAssistantContext,
  parseBuilderAssistantResponse
} from './services/builderAssistantService.js?v=app-config-85';
import { roleProfileId } from './services/aiProfileScope.js?v=app-config-45';
import {
  enqueueAiProfileDelete,
  flushAiProfileDeletes
} from './services/aiProfileCleanup.js?v=app-config-59';
import { purgeCharacterData } from './services/characterDataService.js?v=app-config-59';
import { ensureCharacterChatSession } from './services/chatSessionService.js?v=app-config-95';
import {
  getStandaloneUrl,
  getPwaInstallHelp,
  installPwa,
  isPhoneMode,
  isPwaInstallAvailable,
  setupPwa
} from './services/pwaService.js?v=app-config-46';
import { checkStartupHealth } from './services/startupHealthService.js?v=app-config-92';
import {
  cloneCustomization,
  createCustomWidgetFromTemplate,
  DEFAULT_CUSTOMIZATION,
  normalizeCharacterAppearance,
  normalizeChatAppearance,
  normalizeCompanionAppearance,
  normalizeMemoryAppearance,
  normalizeMusicAppearance,
  normalizeSettingsAppearance,
  normalizeCustomization,
  validateCustomCss,
  validateCustomWidgetCode
} from './services/customizationModel.js?v=app-config-84';
import {
  createThemePackage,
  downloadThemePackage,
  inspectThemePackage
} from './services/themePackageService.js';
import {
  createStandalonePhoneArchive,
  downloadStandalonePhoneArchive
} from './services/standalonePhoneExportService.js';
import { getCustomizationStore } from './storage/customizationStore.js';
import { getCustomAppStore } from './storage/customAppStore.js';
import {
  appPackageFileName,
  createExampleCustomAppPackage,
  downloadCustomAppPackage,
  inspectCustomAppPackage
} from './services/customAppPackageService.js';

const app = document.getElementById('app');
const exportedPhone = globalThis.__LOVE_PHONE_EXPORT__;
const phoneMode = isPhoneMode(
  location.search,
  window.matchMedia?.('(display-mode: standalone)').matches
) || Boolean(exportedPhone?.config);
const steps = [
  { id: 'apps', label: '功能' },
  { id: 'appearance', label: '美化' },
  { id: 'save', label: '完成' }
];

async function loadRuntimeCapabilities() {
  try {
    const response = await fetch('/__lovephone_runtime', { cache: 'no-store' });
    if (!response.ok) throw new Error('runtime unavailable');
    const runtime = await response.json();
    return {
      desktop: Boolean(runtime.desktop),
      experimentalMusic: runtime.experimentalMusic !== false
    };
  } catch {
    // A static preview opened without the local server stays in development mode.
    return { desktop: false, experimentalMusic: true };
  }
}

const runtimeCapabilities = await loadRuntimeCapabilities();
const customAppStore = getCustomAppStore();
for (const bundle of globalThis.__LOVE_PHONE_EXPORT_APPS__?.apps || []) {
  try {
    if (!(await customAppStore.getApp(bundle.id))) {
      const bytes = Uint8Array.from(atob(bundle.archive), value => value.charCodeAt(0));
      const inspected = await inspectCustomAppPackage(bytes);
      await customAppStore.install(inspected, { permissions: bundle.permissions || inspected.manifest.permissions });
    }
  } catch {
    // A damaged optional custom App must never prevent the exported phone from opening.
  }
}
const initialCustomApps = await customAppStore.listApps().catch(() => []);

const state = {
  config: await loadConfig({
    seedConfig: exportedPhone?.config,
    isolated: Boolean(exportedPhone?.config)
  }),
  activeStep: 'apps',
  phone: {
    currentApp: 'home',
    characterView: 'list',
    selectedCharacterIndex: 0,
    selectedCharacterId: null,
    chatView: 'list',
    chatCharacterId: null,
    runtimeCapabilities,
    customApps: initialCustomApps
  },
  ui: {
    statusMessage: '已加载上次的小手机配置。',
    appConfigId: null,
    appearancePage: 'phone',
    appearanceAppId: 'character',
    customEditor: null,
    customWidgetTab: 'templates',
    customWidgetIndex: 0,
    chatAppearanceTab: 'overall',
    chatAppearancePreview: 'list',
    characterAppearanceTab: 'overall',
    characterAppearancePreview: 'list',
    settingsAppearanceTab: 'overall',
    settingsAppearancePreview: 'top',
    memoryAppearanceTab: 'overall',
    memoryAppearancePreview: 'top',
    musicAppearanceTab: 'overall',
    musicAppearancePreview: 'home',
    companionAppearanceTab: 'overall',
    companionAppearancePreview: 'top',
    customImportPreview: null,
    customStatus: '',
    customAppImportPreview: null,
    customAppManagerId: null,
    aiAssistant: {
      open: false,
      isSending: false,
      messages: [],
      lastOperations: [],
      draftBase: null,
      draftHistory: []
    },
    installAvailable: isPwaInstallAvailable(),
    storageStatus: getStorageStatusSnapshot()
  }
};

// The package archive and its private data live in IndexedDB. The config only
// keeps desktop-facing metadata so old configurations remain compatible.
state.config.customApps = initialCustomApps.map(record => ({
  id: record.id,
  name: record.name,
  iconOverride: record.iconOverride || '',
  enabled: record.enabled !== false,
  version: record.manifest?.version || '',
  permissions: [...(record.permissions || [])],
  networkOrigins: [...(record.manifest?.networkOrigins || [])]
}));

function chatPreviewForCustomizationPath(path) {
  const value = String(path || '');
  if (!value.startsWith('appThemes.chat.')) return null;
  if (
    value.includes('.chat.list.')
    || value.endsWith('.chat.overall.pageBackground')
    || value.endsWith('.variables.background')
    || value.endsWith('.variables.text')
  ) return 'list';
  if (
    value.includes('.chat.bubbles.')
    || value.includes('.chat.composer.')
    || value.endsWith('.chat.overall.conversationBackground')
    || value.endsWith('.variables.surface')
    || value.endsWith('.variables.accent')
  ) return 'conversation';
  return null;
}

function characterPreviewForCustomizationPath(path) {
  const value = String(path || '');
  if (!value.startsWith('appThemes.character.')) return null;
  if (
    value.includes('.character.list.')
    || value.endsWith('.character.overall.pageBackground')
    || value.endsWith('.variables.background')
    || value.endsWith('.variables.text')
  ) return 'list';
  if (
    value.includes('.character.detail.')
    || value.endsWith('.variables.surface')
    || value.endsWith('.variables.accent')
  ) return 'detail';
  return null;
}

function settingsPreviewForCustomizationPath(path) {
  const value = String(path || '');
  if (!value.startsWith('appThemes.settings.')) return null;
  if (
    value.includes('.settings.groups.')
    || value.endsWith('.variables.surface')
  ) return 'groups';
  if (
    value.includes('.settings.controls.')
    || value.endsWith('.variables.accent')
  ) return 'controls';
  if (
    value.includes('.settings.overall.')
    || value.endsWith('.variables.background')
    || value.endsWith('.variables.text')
  ) return 'top';
  return null;
}

function memoryPreviewForCustomizationPath(path) {
  const value = String(path || '');
  if (!value.startsWith('appThemes.memory.')) return null;
  if (value.includes('.memory.editor.') || value.endsWith('.variables.accent')) return 'editor';
  if (value.includes('.memory.cards.') || value.endsWith('.variables.surface')) return 'cards';
  if (
    value.includes('.memory.overall.')
    || value.endsWith('.variables.background')
    || value.endsWith('.variables.text')
  ) return 'top';
  return null;
}

function musicPreviewForCustomizationPath(path) {
  const value = String(path || '');
  if (!value.startsWith('appThemes.music.')) return null;
  if (value.includes('.music.player.')) return 'player';
  if (value.includes('.music.home.') || value.includes('.music.mini.') || value.includes('.music.overall.')) return 'home';
  if (value.endsWith('.variables.background') || value.endsWith('.variables.surface') || value.endsWith('.variables.text') || value.endsWith('.variables.accent')) return 'home';
  return null;
}

function companionPreviewForCustomizationPath(path, appId) {
  const value = String(path || '');
  if (!value.startsWith(`appThemes.${appId}.`)) return null;
  if (value.includes('.companion.editor.')) return 'editor';
  if (value.includes('.companion.cards.') || value.endsWith('.variables.surface')) return 'cards';
  if (value.includes('.companion.overall.') || value.endsWith('.variables.background') || value.endsWith('.variables.text') || value.endsWith('.variables.accent')) return 'top';
  return null;
}

function selectChatAppearancePreview(view) {
  if (!['list', 'conversation'].includes(view)) return null;
  const characters = [state.config.character, ...(state.config.characters || [])];
  const selected = characters.find(character => character.id === state.phone.chatCharacterId)
    || characters[0];
  state.ui.chatAppearancePreview = view;
  state.phone.currentApp = 'chat';
  state.phone.chatView = view;
  state.phone.chatCharacterId = selected?.id || state.config.character.id;
  state.phone.chatAppearancePreviewMode = view === 'conversation';
  return view;
}

function selectCharacterAppearancePreview(view) {
  if (!['list', 'detail'].includes(view)) return null;
  const characters = [state.config.character, ...(state.config.characters || [])];
  const selected = characters.find(character => character.id === state.phone.selectedCharacterId)
    || characters[0];
  state.ui.characterAppearancePreview = view;
  state.phone.currentApp = 'character';
  state.phone.characterView = view;
  state.phone.selectedCharacterId = selected?.id || state.config.character.id;
  state.phone.selectedCharacterIndex = Math.max(0, characters.findIndex(character => character.id === selected?.id));
  return view;
}

function selectSettingsAppearancePreview(view) {
  if (!['top', 'groups', 'controls'].includes(view)) return null;
  state.ui.settingsAppearancePreview = view;
  state.phone.currentApp = 'settings';
  state.phone.settingsAppearanceAnchor = view;
  return view;
}

function selectMemoryAppearancePreview(view) {
  if (!['top', 'editor', 'cards'].includes(view)) return null;
  state.ui.memoryAppearancePreview = view;
  state.phone.currentApp = 'memory';
  state.phone.memoryAppearanceAnchor = view;
  state.phone.memoryAppearancePreviewMode = true;
  return view;
}

function selectMusicAppearancePreview(view) {
  if (!['home', 'player'].includes(view)) return null;
  state.ui.musicAppearancePreview = view;
  state.phone.currentApp = 'music';
  state.phone.musicView = view === 'player' ? 'player' : 'discover';
  state.phone.musicAppearancePreviewMode = true;
  return view;
}

function selectCompanionAppearancePreview(appId, view) {
  if (!['diary', 'anniversary', 'goodnight'].includes(appId) || !['top', 'editor', 'cards'].includes(view)) return null;
  state.ui.companionAppearancePreview = view;
  state.phone.currentApp = appId;
  state.phone.companionAppearanceAnchor = view;
  state.phone.companionAppearancePreviewMode = true;
  return view;
}

function setPath(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  keys.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
}

function removePath(target, path) {
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce((cursor, key) => cursor?.[key], target);
  if (parent && typeof parent === 'object') delete parent[keys[keys.length - 1]];
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

function customAppMetadata(record) {
  return {
    id: record.id,
    name: record.name,
    iconOverride: record.iconOverride || '',
    enabled: record.enabled !== false,
    version: record.manifest?.version || '',
    permissions: [...(record.permissions || [])],
    networkOrigins: [...(record.manifest?.networkOrigins || [])]
  };
}

async function refreshCustomApps() {
  state.phone.customApps = await customAppStore.listApps();
  state.config.customApps = state.phone.customApps.map(customAppMetadata);
}

function customAppPermission(record, permission) {
  if (!(record?.permissions || []).includes(permission)) {
    throw new Error(`该 App 没有“${permission}”权限，请到设置中的自定义 App 管理里授权。`);
  }
}

async function handleCustomAppRequest(appId, method, args = {}) {
  const record = (state.phone.customApps || []).find(item => item.id === appId);
  if (!record || record.enabled === false) throw new Error('这个 App 已被禁用或卸载。');
  if (method.startsWith('storage.')) {
    customAppPermission(record, 'storage');
    const key = String(args.key || '').trim();
    if (!key || key.length > 120) throw new Error('本地数据的键名不合法。');
    if (method === 'storage.get') return customAppStore.getData(appId, key);
    if (method === 'storage.set') return customAppStore.setData(appId, key, args.value);
    if (method === 'storage.delete') return customAppStore.deleteData(appId, key);
  }
  if (method === 'data.read') {
    const scope = String(args.scope || '');
    const maps = {
      character: ['character.read', () => ({ ...state.config.character, aiProfiles: undefined })],
      chat: ['chat.read', () => state.config.apps.chat?.messages || []],
      memory: ['memory.read', () => state.config.apps.memory?.entries || []],
      diary: ['diary.read', () => state.config.apps.diary?.entries || []],
      media: ['media.read', () => ({ musicEnabled: Boolean(state.config.apps.music?.enabled) })]
    };
    const entry = maps[scope];
    if (!entry) throw new Error('不支持读取这类系统数据。');
    customAppPermission(record, entry[0]);
    return structuredClone(entry[1]());
  }
  if (method === 'network.fetch') {
    customAppPermission(record, 'network');
    let url;
    try { url = new URL(String(args.url || '')); } catch { throw new Error('联网地址无效。'); }
    if (!(record.manifest?.networkOrigins || []).includes(url.origin)) throw new Error('该地址不在安装时允许的联网域名中。');
    const response = await fetch(url, {
      method: ['GET', 'POST'].includes(String(args.options?.method || 'GET').toUpperCase()) ? args.options.method : 'GET',
      headers: args.options?.headers && typeof args.options.headers === 'object' ? args.options.headers : undefined,
      body: args.options?.body ? JSON.stringify(args.options.body) : undefined
    });
    const text = (await response.text()).slice(0, 512 * 1024);
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { ok: response.ok, status: response.status, body };
  }
  if (method === 'notification') {
    customAppPermission(record, 'notifications');
    if (!('Notification' in window)) throw new Error('当前设备不支持系统通知。');
    const status = await Notification.requestPermission();
    if (status !== 'granted') throw new Error('系统通知未获允许。');
    new Notification(record.name, { body: String(args.message || '').slice(0, 120) });
    return true;
  }
  if (method === 'system.openApp') {
    customAppPermission(record, 'system.openApp');
    openPhoneApp(String(args.id || 'home')); return true;
  }
  if (method === 'desktop.home') {
    customAppPermission(record, 'desktop');
    openPhoneApp('home'); return true;
  }
  if (method === 'navigate') {
    const page = String(args.page || '');
    if (!(record.manifest?.pages || []).includes(page)) throw new Error('这个页面不在 App 清单中。');
    state.phone.customAppPages = { ...(state.phone.customAppPages || {}), [appId]: page };
    render({ keepPhone: true });
    return true;
  }
  throw new Error('这个 App 请求了尚未支持的系统能力。');
}

function confirmConfigImport(config) {
  const summary = summarizeImportedConfig(config);
  return window.confirm(
    `即将覆盖当前小手机：\n\n${summary.title}\n${summary.characters} 个角色 · ${summary.enabledApps} 个 App\n${summary.messages} 条聊天 · ${summary.memories} 条记忆 · ${summary.diaries} 篇日记\n\n当前数据会先自动创建本地备份。确定导入吗？`
  );
}

function pushAssistantMessage(role, content) {
  const message = String(content || '').trim();
  if (!message) return;
  state.ui.aiAssistant.messages = [
    ...(state.ui.aiAssistant.messages || []),
    { role: role === 'user' ? 'user' : 'assistant', content: message }
  ].slice(-14);
}

function openAssistantPreview(appId) {
  state.phone.currentApp = appId || 'home';
  if (appId === 'chat') state.phone.chatView = 'list';
  if (appId === 'character') state.phone.characterView = 'list';
}

async function sendAssistantRequest(content) {
  const message = String(content || '').trim().slice(0, 500);
  if (!message || state.ui.aiAssistant.isSending) return;

  const assistantConfig = state.config.aiAssistant || {};
  const providerId = assistantConfig.providerId;
  if (!assistantConfig.enabled || !providerId) {
    state.ui.aiAssistant.open = true;
    pushAssistantMessage('assistant', '请先在“功能”第一步启用 AI 搭建助手，并完成它的接口连接。');
    render();
    return;
  }

  pushAssistantMessage('user', message);
  state.ui.aiAssistant.open = true;
  state.ui.aiAssistant.isSending = true;
  state.ui.aiAssistant.lastOperations = [];
  render();

  try {
    const context = createBuilderAssistantContext(state.config, state.phone);
    const history = state.ui.aiAssistant.messages
      .slice(-10)
      .map(item => ({ role: item.role, content: item.content }));
    const raw = await streamAiChat(state.config, {
      providerId,
      profileId: assistantConfig.profileId || 'builder-assistant',
      system: buildBuilderAssistantSystemPrompt(context),
      messages: history
    });
    const result = parseBuilderAssistantResponse(raw, state.config);
    if (result.operations.length) {
      const before = cloneConfig(state.config);
      const draft = applyBuilderAssistantOperations(state.config, result.operations);
      if (!state.ui.aiAssistant.draftBase) state.ui.aiAssistant.draftBase = cloneConfig(before);
      state.ui.aiAssistant.draftHistory.push({ config: before, operations: result.operations });
      state.config = draft.config;
      state.ui.aiAssistant.lastOperations = draft.operations;
      if (draft.previewAppId) openAssistantPreview(draft.previewAppId);
    }
    pushAssistantMessage('assistant', result.reply);
  } catch (error) {
    pushAssistantMessage('assistant', `暂时无法生成草稿：${error.message || '请检查设置中的模型连接。'}`);
  } finally {
    state.ui.aiAssistant.isSending = false;
    render();
  }
}

function applyAssistantDraft() {
  if (!state.ui.aiAssistant.draftBase) return;
  state.ui.aiAssistant.draftBase = null;
  state.ui.aiAssistant.draftHistory = [];
  state.ui.aiAssistant.lastOperations = [];
  persist('AI 美化草稿已应用并保存。');
  pushAssistantMessage('assistant', '已应用这次美化草稿。之后还可以继续告诉我想调整的地方。');
  render();
}

function discardAssistantDraft() {
  const original = state.ui.aiAssistant.draftBase;
  if (!original) return;
  state.config = cloneConfig(original);
  state.ui.aiAssistant.draftBase = null;
  state.ui.aiAssistant.draftHistory = [];
  state.ui.aiAssistant.lastOperations = [];
  pushAssistantMessage('assistant', '已放弃这次草稿，原来的小手机外观没有改变。');
  render();
}

function undoAssistantDraft() {
  const history = state.ui.aiAssistant.draftHistory;
  if (!history?.length) return;
  const previous = history.pop();
  state.config = cloneConfig(previous.config);
  state.ui.aiAssistant.lastOperations = history.at(-1)?.operations || [];
  pushAssistantMessage('assistant', '已撤销上一组草稿修改。');
  render();
}

function bindAssistantPanel(root) {
  bindAiAssistantPanel(root, {
    toggle: () => {
      state.ui.aiAssistant.open = !state.ui.aiAssistant.open;
      render();
    },
    close: () => {
      state.ui.aiAssistant.open = false;
      render();
    },
    suggest: prompt => sendAssistantRequest(prompt),
    send: content => sendAssistantRequest(content),
    configure: () => {
      state.activeStep = 'apps';
      state.ui.appConfigId = 'ai-assistant';
      render();
    },
    apply: applyAssistantDraft,
    discard: discardAssistantDraft,
    undo: undoAssistantDraft
  });
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
  return renderAppSelectionPanel(state.config, {
    ...state.ui,
    runtimeCapabilities,
    customApps: state.phone.customApps
  });
}

function openPhoneApp(appId) {
  const available = getEnabledApps(state.config, runtimeCapabilities, state.phone.customApps)
    .some(appItem => appItem.id === appId);
  if (!available) {
    state.phone.currentApp = 'home';
    state.ui.statusMessage = '这个 App 当前未启用。';
    render({ keepPhone: true });
    return;
  }
  state.phone.currentApp = appId;
  if (appId === 'chat') {
    state.phone.chatView = 'list';
    state.phone.chatSessionDeleteConfirmId = null;
  }
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
    chatCharacterId: state.phone.chatCharacterId === characterId
      ? null
      : state.phone.chatCharacterId,
    chatView: state.phone.chatCharacterId === characterId
      ? 'list'
      : state.phone.chatView,
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

function defaultCustomizationValue(kind) {
  const defaults = cloneCustomization(DEFAULT_CUSTOMIZATION);
  const paths = {
    basic: 'tokens',
    palette: 'tokens',
    shell: 'phoneShell',
    iconPack: 'iconPack',
    desktop: 'desktop',
    widgets: 'widgets'
  };
  return paths[kind] ? structuredClone(defaults[paths[kind]]) : null;
}

function mediaTypeForAsset(name) {
  const extension = String(name || '').split('.').pop().toLowerCase();
  return {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    woff: 'font/woff',
    woff2: 'font/woff2'
  }[extension] || 'application/octet-stream';
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
    inspectCustomApp: async file => {
      try {
        state.ui.customAppImportPreview = await inspectCustomAppPackage(file);
        state.ui.statusMessage = '已完成 App 包预检，请确认权限后安装。';
      } catch (error) {
        state.ui.customAppImportPreview = null;
        state.ui.statusMessage = error.message || 'App 包无法导入。';
      }
      render();
    },
    cancelCustomAppImport: () => { state.ui.customAppImportPreview = null; render(); },
    installCustomApp: async () => {
      const preview = state.ui.customAppImportPreview;
      if (!preview) return;
      try {
        const existing = await customAppStore.getApp(preview.manifest.id);
        const changedPermissions = existing && JSON.stringify(existing.manifest.permissions || []) !== JSON.stringify(preview.manifest.permissions || []);
        const changedOrigins = existing && JSON.stringify(existing.manifest.networkOrigins || []) !== JSON.stringify(preview.manifest.networkOrigins || []);
        if (existing && (changedPermissions || changedOrigins) && !window.confirm('这个更新请求了不同的权限或联网域名。确认后才会保留原数据并更新 App。')) return;
        if (existing && !window.confirm('检测到相同 App ID。更新会保留这个 App 的独立数据，是否继续？')) return;
        await customAppStore.install(preview, { replace: Boolean(existing), permissions: preview.manifest.permissions });
        await refreshCustomApps();
        persist(existing ? '自定义 App 已更新，原有独立数据已保留。' : '自定义 App 已安装并加入桌面。');
        state.ui.customAppImportPreview = null;
      } catch (error) { state.ui.statusMessage = error.message || '安装自定义 App 失败。'; }
      render();
    },
    openCustomAppManager: id => { state.ui.customAppManagerId = id; render(); },
    closeCustomAppManager: () => { state.ui.customAppManagerId = null; render(); },
    toggleCustomApp: async (id, enabled) => { await customAppStore.update(id, { enabled }); await refreshCustomApps(); persist(enabled ? '自定义 App 已启用。' : '自定义 App 已禁用。'); render(); },
    renameCustomApp: async (id, name) => { await customAppStore.update(id, { name: String(name || '').trim().slice(0, 60) || '未命名 App' }); await refreshCustomApps(); persist('自定义 App 名称已保存。'); render(); },
    updateCustomAppIcon: async (id, iconOverride) => { await customAppStore.update(id, { iconOverride }); await refreshCustomApps(); persist('自定义 App 图标已保存。'); render(); },
    setCustomAppPermissions: async (id, permissions) => { await customAppStore.update(id, { permissions }); await refreshCustomApps(); persist('自定义 App 权限已更新。'); render(); },
    removeCustomApp: async id => { if (!window.confirm('卸载后会删除这个 App 的文件、设置和独立数据，无法恢复。确定卸载吗？')) return; await customAppStore.remove(id); await refreshCustomApps(); state.ui.customAppManagerId = null; persist('自定义 App 已卸载，独立数据已清理。'); render(); },
    exportCustomApp: async id => { const record = await customAppStore.getApp(id); if (record) downloadCustomAppPackage(record.archive, appPackageFileName(record)); },
    downloadExampleCustomApp: () => downloadCustomAppPackage(createExampleCustomAppPackage(), 'hello-companion.lovephone-app.zip'),
    setAiAssistantEnabled: enabled => {
      state.config.aiAssistant.enabled = Boolean(enabled);
      if (!enabled) state.ui.aiAssistant.open = false;
      persist(enabled ? 'AI 搭建助手已启用。' : 'AI 搭建助手已关闭。');
      render();
    },
    openAiAssistantConfig: () => {
      state.ui.appConfigId = 'ai-assistant';
      render();
    },
    configureAiAssistant: async ({ providerId, apiKey, model, baseUrl }) => {
      const profileId = 'builder-assistant';
      state.ui.aiAssistant.connectionDraft = { providerId, model, baseUrl };
      state.ui.aiAssistant.connectionStatus = '正在连接并测试...';
      try {
        await configureAiProvider(state.config, { profileId, providerId, apiKey, model, baseUrl });
        const result = await testAiProvider(state.config, { profileId, providerId });
        state.config.aiAssistant = {
          enabled: true,
          providerId,
          profileId,
          model,
          baseUrl
        };
        state.ui.aiAssistant.connectionDraft = null;
        state.ui.aiAssistant.connectionStatus = result.answer || '连接成功，可以开始使用。';
        persist('AI 搭建助手接口已连接。');
      } catch (error) {
        state.ui.aiAssistant.connectionStatus = error.message || '连接失败，请检查 API Key、模型名称和接口地址。';
      }
      render();
    },
    openPhoneApp,
    selectCharacter,
    openCharacterContext: (appId, characterId) => {
      const characters = [state.config.character, ...(state.config.characters || [])];
      const index = characters.findIndex(character => character.id === characterId);
      if (index < 0 || !state.config.apps?.[appId]?.enabled) return;
      state.config.apps.chat = ensureCharacterChatSession(state.config.apps.chat, characterId);
      state.config.apps.character.activeCharacterId = characterId;
      state.phone = {
        ...state.phone,
        currentApp: appId,
        selectedCharacterId: characterId,
        selectedCharacterIndex: index,
        chatCharacterId: appId === 'chat' ? characterId : state.phone.chatCharacterId,
        chatView: appId === 'chat' ? 'conversation' : state.phone.chatView
      };
      persist('已打开该角色的专属记录。');
      render({ keepPhone: true });
    },
    deleteCharacter,
    moveCharacter,
    duplicateCharacter,
    setAppearancePage: page => {
      state.ui.appearancePage = page === 'apps' ? 'apps' : 'phone';
      if (state.ui.appearancePage === 'apps') {
        const enabledApps = getEnabledApps(state.config, runtimeCapabilities);
        const selectedApp = enabledApps.find(app => app.id === state.ui.appearanceAppId) || enabledApps[0];
        state.ui.appearanceAppId = selectedApp?.id || 'character';
        state.phone.currentApp = state.ui.appearanceAppId;
        if (state.phone.currentApp === 'chat') state.phone.chatView = 'list';
      } else {
        state.phone.currentApp = 'home';
      }
      render();
    },
    selectAppearanceApp: appId => {
      state.ui.appearanceAppId = appId;
      state.phone.currentApp = appId;
      if (appId === 'character') state.phone.characterView = 'list';
      if (appId === 'chat') state.phone.chatView = 'list';
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
    openCustomization: (kind, appId = '') => {
      state.ui.customEditor = {
        kind,
        appId,
        original: cloneCustomization(state.config.theme.customization)
      };
      state.ui.customImportPreview = null;
      state.ui.customStatus = '';
      if (kind === 'widgets') {
        state.ui.customWidgetTab = 'templates';
        state.ui.customWidgetIndex = Math.max(0, (state.config.theme.customization.widgets || []).length - 1);
      }
      if (['basic', 'shell', 'palette', 'iconPack', 'desktop'].includes(kind)) {
        setPath(state.config, `theme.customization.active.${kind}`, true);
      }
      if (kind === 'app' && appId) {
        if (!state.config.theme.customization.appThemes?.[appId]) {
          setPath(state.config, `theme.customization.appThemes.${appId}`, {
            enabled: true,
            name: '',
            icon: '',
            variables: {},
            css: ''
          });
        }
        if (appId === 'chat') {
          const theme = state.config.theme.customization.appThemes.chat;
          theme.chat = normalizeChatAppearance(theme.chat);
          state.ui.chatAppearanceTab = 'overall';
          state.ui.chatAppearancePreview = 'list';
          state.phone.chatView = 'list';
          state.phone.chatAppearancePreviewMode = false;
        }
        if (appId === 'character') {
          const theme = state.config.theme.customization.appThemes.character;
          theme.character = normalizeCharacterAppearance(theme.character);
          state.ui.characterAppearanceTab = 'overall';
          state.ui.characterAppearancePreview = 'list';
          state.phone.characterView = 'list';
        }
        if (appId === 'settings') {
          const theme = state.config.theme.customization.appThemes.settings;
          theme.settings = normalizeSettingsAppearance(theme.settings);
          state.ui.settingsAppearanceTab = 'overall';
          state.ui.settingsAppearancePreview = 'top';
          state.phone.settingsAppearanceAnchor = 'top';
        }
        if (appId === 'memory') {
          const theme = state.config.theme.customization.appThemes.memory;
          theme.memory = normalizeMemoryAppearance(theme.memory);
          state.ui.memoryAppearanceTab = 'overall';
          state.ui.memoryAppearancePreview = 'top';
          state.phone.memoryAppearanceAnchor = 'top';
          state.phone.memoryAppearancePreviewMode = true;
        }
        if (appId === 'music') {
          const theme = state.config.theme.customization.appThemes.music;
          theme.music = normalizeMusicAppearance(theme.music);
          state.ui.musicAppearanceTab = 'overall';
          state.ui.musicAppearancePreview = 'home';
          state.phone.musicView = 'discover';
          state.phone.musicAppearancePreviewMode = true;
        }
        if (['diary', 'anniversary', 'goodnight'].includes(appId)) {
          const theme = state.config.theme.customization.appThemes[appId];
          theme.companion = normalizeCompanionAppearance(theme.companion);
          state.ui.companionAppearanceTab = 'overall';
          state.ui.companionAppearancePreview = 'top';
          state.phone.companionAppearanceAnchor = 'top';
          state.phone.companionAppearancePreviewMode = true;
        }
        state.phone.currentApp = appId;
      } else if (kind !== 'packages') {
        state.phone.currentApp = 'home';
      }
      render();
    },
    updateCustomization: (path, value, options = {}) => {
      if (!state.ui.customEditor) return;
      const preview = chatPreviewForCustomizationPath(path);
      if (preview) selectChatAppearancePreview(preview);
      const characterPreview = characterPreviewForCustomizationPath(path);
      if (characterPreview) selectCharacterAppearancePreview(characterPreview);
      const settingsPreview = settingsPreviewForCustomizationPath(path);
      if (settingsPreview) selectSettingsAppearancePreview(settingsPreview);
      const memoryPreview = memoryPreviewForCustomizationPath(path);
      if (memoryPreview) selectMemoryAppearancePreview(memoryPreview);
      const musicPreview = musicPreviewForCustomizationPath(path);
      if (musicPreview) selectMusicAppearancePreview(musicPreview);
      const companionAppId = path.match(/^appThemes\.(diary|anniversary|goodnight)\./)?.[1];
      const companionPreview = companionAppId ? companionPreviewForCustomizationPath(path, companionAppId) : null;
      if (companionPreview) selectCompanionAppearancePreview(companionAppId, companionPreview);
      if (
        path.startsWith('appThemes.chat.chat.')
        && path !== 'appThemes.chat.chat.enabled'
      ) {
        setPath(state.config, 'theme.customization.appThemes.chat.chat.enabled', true);
      }
      if (
        path.startsWith('appThemes.character.character.')
        && path !== 'appThemes.character.character.enabled'
      ) {
        setPath(state.config, 'theme.customization.appThemes.character.character.enabled', true);
      }
      if (
        path.startsWith('appThemes.settings.settings.')
        && path !== 'appThemes.settings.settings.enabled'
      ) {
        setPath(state.config, 'theme.customization.appThemes.settings.settings.enabled', true);
      }
      if (
        path.startsWith('appThemes.memory.memory.')
        && path !== 'appThemes.memory.memory.enabled'
      ) {
        setPath(state.config, 'theme.customization.appThemes.memory.memory.enabled', true);
      }
      if (
        path.startsWith('appThemes.music.music.')
        && path !== 'appThemes.music.music.enabled'
      ) {
        setPath(state.config, 'theme.customization.appThemes.music.music.enabled', true);
      }
      if (
        companionAppId
        && path.startsWith(`appThemes.${companionAppId}.companion.`)
        && path !== `appThemes.${companionAppId}.companion.enabled`
      ) {
        setPath(state.config, `theme.customization.appThemes.${companionAppId}.companion.enabled`, true);
      }
      setPath(state.config, `theme.customization.${path}`, value);
      state.ui.customStatus = options.valid === false
        ? '这段 CSS 尚未通过安全检查，不会被应用。'
        : '正在预览，点击“应用”后保存。';
      if (options.noRender) {
        renderLovePhoneOS(
          document.getElementById('lovePhoneOS'),
          state.config,
          state.phone,
          createPhoneHandlers()
        );
      } else if (options.keepFocus) {
        render({ keepPhone: true });
      } else {
        render();
      }
    },
    removeCustomizationPath: path => {
      removePath(state.config.theme.customization, path);
      state.ui.customStatus = '已从预览中移除。';
      render();
    },
    setCustomizationStatus: message => {
      state.ui.customStatus = message;
      render();
    },
    setCustomWidgetTab: tab => {
      if (!['templates', 'style', 'code'].includes(tab)) return;
      state.ui.customWidgetTab = tab;
      render();
    },
    setChatAppearanceTab: tab => {
      if (!['overall', 'list', 'bubbles', 'composer'].includes(tab)) return;
      state.ui.chatAppearanceTab = tab;
      selectChatAppearancePreview(['bubbles', 'composer'].includes(tab) ? 'conversation' : 'list');
      render();
    },
    setChatAppearancePreview: view => {
      if (!selectChatAppearancePreview(view)) return;
      render();
    },
    setCharacterAppearanceTab: tab => {
      if (!['overall', 'list', 'detail'].includes(tab)) return;
      state.ui.characterAppearanceTab = tab;
      selectCharacterAppearancePreview(tab === 'detail' ? 'detail' : 'list');
      render();
    },
    setCharacterAppearancePreview: view => {
      if (!selectCharacterAppearancePreview(view)) return;
      render();
    },
    setSettingsAppearanceTab: tab => {
      if (!['overall', 'groups', 'controls'].includes(tab)) return;
      state.ui.settingsAppearanceTab = tab;
      selectSettingsAppearancePreview(tab === 'overall' ? 'top' : tab);
      render();
    },
    setSettingsAppearancePreview: view => {
      if (!selectSettingsAppearancePreview(view)) return;
      render();
    },
    setMemoryAppearanceTab: tab => {
      if (!['overall', 'editor', 'cards'].includes(tab)) return;
      state.ui.memoryAppearanceTab = tab;
      selectMemoryAppearancePreview(tab === 'overall' ? 'top' : tab);
      render();
    },
    setMemoryAppearancePreview: view => {
      if (!selectMemoryAppearancePreview(view)) return;
      render();
    },
    setMusicAppearanceTab: tab => {
      if (!['overall', 'home', 'mini', 'player'].includes(tab)) return;
      state.ui.musicAppearanceTab = tab;
      selectMusicAppearancePreview(tab === 'player' ? 'player' : 'home');
      render();
    },
    setMusicAppearancePreview: view => {
      if (!selectMusicAppearancePreview(view)) return;
      render();
    },
    setCompanionAppearanceTab: tab => {
      if (!['overall', 'editor', 'cards'].includes(tab)) return;
      const appId = state.ui.customEditor?.appId;
      if (!['diary', 'anniversary', 'goodnight'].includes(appId)) return;
      state.ui.companionAppearanceTab = tab;
      selectCompanionAppearancePreview(appId, tab === 'overall' ? 'top' : tab);
      render();
    },
    setCompanionAppearancePreview: view => {
      const appId = state.ui.customEditor?.appId;
      if (!selectCompanionAppearancePreview(appId, view)) return;
      render();
    },
    previewCustomizationPath: path => {
      if (state.ui.customEditor?.kind !== 'app') return null;
      const appId = state.ui.customEditor.appId;
      const preview = appId === 'chat'
          ? chatPreviewForCustomizationPath(path)
          : appId === 'character'
            ? characterPreviewForCustomizationPath(path)
            : appId === 'settings'
              ? settingsPreviewForCustomizationPath(path)
              : appId === 'memory'
                ? memoryPreviewForCustomizationPath(path)
                : appId === 'music'
                  ? musicPreviewForCustomizationPath(path)
                  : ['diary', 'anniversary', 'goodnight'].includes(appId)
                    ? companionPreviewForCustomizationPath(path, appId)
                    : null;
      if (!preview) return null;
      if (appId === 'chat') selectChatAppearancePreview(preview);
      else if (appId === 'character') selectCharacterAppearancePreview(preview);
      else if (appId === 'settings') selectSettingsAppearancePreview(preview);
      else if (appId === 'memory') selectMemoryAppearancePreview(preview);
      else if (appId === 'music') selectMusicAppearancePreview(preview);
      else selectCompanionAppearancePreview(appId, preview);
      renderLovePhoneOS(
        document.getElementById('lovePhoneOS'),
        state.config,
        state.phone,
        createPhoneHandlers()
      );
      return { appId, view: preview };
    },
    selectCustomWidget: index => {
      const widgets = state.config.theme.customization.widgets || [];
      if (!widgets[index]) return;
      state.ui.customWidgetIndex = index;
      state.ui.customWidgetTab = 'style';
      render();
    },
    addCustomWidget: templateId => {
      const widgets = state.config.theme.customization.widgets || [];
      widgets.push(createCustomWidgetFromTemplate(templateId, widgets.length));
      state.ui.customWidgetIndex = widgets.length - 1;
      state.ui.customWidgetTab = 'style';
      state.ui.customStatus = '模板已加入桌面，可继续调整样式或编写代码。';
      render();
    },
    removeCustomWidget: index => {
      state.config.theme.customization.widgets.splice(index, 1);
      state.ui.customWidgetIndex = Math.max(0, Math.min(
        state.ui.customWidgetIndex,
        state.config.theme.customization.widgets.length - 1
      ));
      if (!state.config.theme.customization.widgets.length) state.ui.customWidgetTab = 'templates';
      state.ui.customStatus = '组件已从预览移除。';
      render();
    },
    setCustomWidgetCodeMode: (index, enabled) => {
      const widget = state.config.theme.customization.widgets?.[index];
      if (!widget) return;
      if (enabled && !widget.code?.html && !widget.code?.css && !widget.code?.js) {
        widget.code = createCustomWidgetFromTemplate(widget.templateId, index, widget.id).code;
      }
      widget.mode = enabled ? 'code' : 'visual';
      state.ui.customStatus = enabled ? '代码将在安全沙箱中运行。' : '已切回可视化模板。';
      render();
    },
    toggleCustomWidgetPermission: (category, value, checked) => {
      const widget = state.config.theme.customization.widgets?.[state.ui.customWidgetIndex];
      if (!widget || !['data', 'action'].includes(category)) return;
      const path = category === 'data' ? 'dataPermissions' : 'actionPermissions';
      const values = new Set(widget.code?.[path] || []);
      if (checked) values.add(value);
      else values.delete(value);
      widget.code = { ...(widget.code || {}), [path]: [...values] };
      state.ui.customStatus = '组件权限已更新。';
      render();
    },
    cancelCustomization: () => {
      const original = state.ui.customEditor?.original;
      if (original) state.config.theme.customization = cloneCustomization(original);
      state.ui.customEditor = null;
      state.ui.customImportPreview = null;
      state.ui.customStatus = '';
      state.phone.chatAppearancePreviewMode = false;
      state.phone.memoryAppearancePreviewMode = false;
      state.phone.musicAppearancePreviewMode = false;
      state.phone.companionAppearancePreviewMode = false;
      state.phone.companionAppearanceAnchor = null;
      state.phone.memoryAppearanceAnchor = null;
      state.phone.settingsAppearanceAnchor = null;
      render();
    },
    applyCustomization: () => {
      const editor = state.ui.customEditor;
      if (!editor) return;
      if (editor.kind === 'app') {
        const css = state.config.theme.customization.appThemes?.[editor.appId]?.css || '';
        const result = validateCustomCss(css);
        if (!result.valid) {
          state.ui.customStatus = result.errors[0];
          render();
          return;
        }
      }
      if (editor.kind === 'widgets') {
        const invalidWidget = (state.config.theme.customization.widgets || [])
          .find(widget => widget.mode === 'code' && !validateCustomWidgetCode(widget.code).valid);
        if (invalidWidget) {
          state.ui.customStatus = `“${invalidWidget.name}”的代码未通过安全检查。`;
          render();
          return;
        }
      }
      state.config.theme.customization = normalizeCustomization(state.config.theme.customization);
      state.ui.customEditor = null;
      state.ui.customStatus = '';
      state.phone.chatAppearancePreviewMode = false;
      state.phone.memoryAppearancePreviewMode = false;
      state.phone.musicAppearancePreviewMode = false;
      state.phone.companionAppearancePreviewMode = false;
      state.phone.companionAppearanceAnchor = null;
      state.phone.memoryAppearanceAnchor = null;
      state.phone.settingsAppearanceAnchor = null;
      persist('自定义外观已保存。');
      render();
    },
    resetCustomization: () => {
      const editor = state.ui.customEditor;
      if (!editor) return;
      if (editor.kind === 'app') {
        removePath(state.config.theme.customization, `appThemes.${editor.appId}`);
      } else {
        const path = {
          basic: 'tokens',
          palette: 'tokens',
          shell: 'phoneShell',
          iconPack: 'iconPack',
          desktop: 'desktop',
          widgets: 'widgets'
        }[editor.kind];
        const value = defaultCustomizationValue(editor.kind);
        if (path && value !== null) setPath(state.config.theme.customization, path, value);
        if (['basic', 'shell', 'palette', 'iconPack', 'desktop'].includes(editor.kind)) {
          setPath(state.config, `theme.customization.active.${editor.kind}`, false);
        }
      }
      state.ui.customStatus = '已恢复这一部分的默认值，尚未正式保存。';
      render();
    },
    inspectThemePackage: async file => {
      state.ui.customStatus = '正在检查主题包…';
      render();
      try {
        state.ui.customImportPreview = await inspectThemePackage(file);
        state.ui.customStatus = '检查完成，可以安全应用。';
      } catch (error) {
        state.ui.customImportPreview = null;
        state.ui.customStatus = error.message || '主题包检查失败。';
      }
      render();
    },
    applyImportedThemePackage: async () => {
      const preview = state.ui.customImportPreview;
      if (!preview) return;
      try {
        const store = getCustomizationStore();
        await store.savePackage({
          id: preview.manifest.id,
          name: preview.manifest.name,
          type: preview.manifest.type,
          version: preview.manifest.version,
          targetAppId: preview.manifest.targetAppId,
          manifest: preview.manifest,
          customization: preview.customization
        }, { replace: true });
        for (const asset of preview.assets) {
          await store.saveAsset(preview.manifest.id, {
            id: asset.id,
            name: asset.name,
            mediaType: mediaTypeForAsset(asset.name),
            data: asset.data
          }, { replace: true });
        }
        state.config.theme.customization = normalizeCustomization({
          ...preview.customization,
          css: preview.css,
          activePackageIds: [
            ...(preview.customization.activePackageIds || []),
            preview.manifest.id
          ]
        });
        state.ui.customImportPreview = null;
        state.ui.customEditor = null;
        persist(`主题“${preview.manifest.name}”已导入并应用。`, {
          forceBackup: true,
          reason: 'before-theme-import'
        });
      } catch (error) {
        state.ui.customStatus = error.message || '主题包应用失败。';
      }
      render();
    },
    exportThemePackage: async () => {
      try {
        const customization = normalizeCustomization(state.config.theme.customization);
        const bytes = await createThemePackage({
          id: `lovephone-${Date.now()}`,
          name: `${state.config.meta.title || '我的小手机'}主题`,
          author: 'LovePhone Studio',
          version: '1.0.0',
          type: 'phone',
          customization,
          css: customization.css
        });
        downloadThemePackage(bytes, `${state.config.meta.title || 'lovephone'}-theme.zip`);
        state.ui.customStatus = '主题包已导出。';
      } catch (error) {
        state.ui.customStatus = error.message || '主题包导出失败。';
      }
      render();
    },
    openAppConfig: appId => {
      state.ui.appConfigId = appId;
      state.phone.currentApp = appId;
      if (appId === 'character') {
        state.phone.characterView = 'list';
        state.phone.selectedCharacterIndex = 0;
      }
      if (appId === 'chat') state.phone.chatView = 'list';
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
          : result.message || getPwaInstallHelp();
      if (result.outcome === 'unavailable') window.alert(state.ui.statusMessage);
      render();
    },
    exportJson: () => {
      const filename = exportConfig(state.config);
      state.ui.statusMessage = `已导出 ${filename}`;
      render();
    },
    importJson: async file => {
      try {
        const imported = await importConfigFromFile(file);
        if (!confirmConfigImport(imported)) {
          state.ui.statusMessage = '已取消导入，当前小手机没有变化。';
          render();
          return;
        }
        state.config = imported;
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
    customAppRequest: handleCustomAppRequest,
    manageCustomApps: () => {
      if (phoneMode) {
        state.phone.currentApp = 'settings';
        render({ keepPhone: true });
      } else {
        state.activeStep = 'apps';
        state.ui.customAppManagerId = state.phone.customApps?.[0]?.id || null;
        render();
      }
    },
    toggleCustomApp: async (id, enabled) => { await customAppStore.update(id, { enabled }); await refreshCustomApps(); persist(enabled ? '自定义 App 已启用。' : '自定义 App 已禁用。'); render({ keepPhone: true }); },
    setCustomAppPermissions: async (id, permissions) => { await customAppStore.update(id, { permissions }); await refreshCustomApps(); persist('自定义 App 权限已更新。'); render({ keepPhone: true }); },
    removeCustomApp: async id => { if (!window.confirm('卸载会删除这个 App 的所有独立数据，确定吗？')) return; await customAppStore.remove(id); await refreshCustomApps(); persist('自定义 App 已卸载。'); render({ keepPhone: true }); },
    selectCharacter,
    deleteCharacter,
    moveCharacter,
    duplicateCharacter,
    checkStartupHealth: refreshStartupHealth,
    phoneSetupAction: async (action, target) => {
      if (action === 'backup') {
        try {
          await createConfigBackup(state.config);
          setPath(state.config, 'meta.phoneSetup.completed.backup', true);
          persist('已创建本地备份。');
        } catch (error) {
          state.ui.statusMessage = error.message || '创建备份失败，请稍后重试。';
        }
        render({ keepPhone: true });
        return;
      }
      if (target === 'character') {
        setPath(state.config, 'meta.phoneSetup.completed.character', true);
        persist('请确认角色资料。');
      }
      state.phone.currentApp = target || 'home';
      if (target === 'character') state.phone.characterView = 'list';
      render({ keepPhone: true });
    },
    dismissPhoneSetup: () => {
      setPath(state.config, 'meta.phoneSetup.dismissed', true);
      persist('已收起开始使用提示。');
      render({ keepPhone: true });
    },
    toggleNotificationCenter: () => {
      state.phone.notificationCenterOpen = !state.phone.notificationCenterOpen;
      render({ keepPhone: true });
    },
    openPhoneNotification: (appId, characterId) => {
      state.phone.notificationCenterOpen = false;
      state.phone.currentApp = appId || 'home';
      if (appId === 'chat') {
        state.phone.chatCharacterId = characterId || state.config.character.id;
        state.phone.chatView = 'conversation';
      }
      render({ keepPhone: true });
    },
    markPhoneSetup: key => {
      if (!['character', 'ai', 'backup'].includes(key)) return;
      setPath(state.config, `meta.phoneSetup.completed.${key}`, true);
      persist('开始使用进度已更新。');
    },
    backup: async () => {
      try {
        await createConfigBackup(state.config);
        setPath(state.config, 'meta.phoneSetup.completed.backup', true);
        persist('本地备份已创建。');
      } catch (error) {
        state.ui.statusMessage = error.message || '创建备份失败，请稍后重试。';
      }
      render({ keepPhone: true });
    },
    restoreBackup: async () => {
      try {
        state.config = await restoreLatestConfigBackup();
        state.ui.statusMessage = '最近的本地备份已恢复。';
      } catch (error) {
        state.ui.statusMessage = error.message || '恢复备份失败。';
      }
      render({ keepPhone: true });
    },
    install: async () => {
      const result = await installPwa();
      state.ui.installAvailable = isPwaInstallAvailable();
      state.ui.statusMessage = result.outcome === 'accepted'
        ? '安装请求已确认。'
        : result.outcome === 'dismissed'
          ? '已取消安装。'
          : result.message || getPwaInstallHelp();
      if (result.outcome === 'unavailable') window.alert(state.ui.statusMessage);
      render({ keepPhone: true });
    },
    updateWeatherLocation: location => {
      setPath(state.config, 'theme.widgets.weather.city', location.city);
      setPath(state.config, 'theme.widgets.weather.latitude', location.latitude);
      setPath(state.config, 'theme.widgets.weather.longitude', location.longitude);
      persist(`天气位置已更新为 ${location.city}。`);
      render({ keepPhone: true });
    },
    openApp: appId => {
      state.phone.currentApp = appId;
      state.phone.chatAppearancePreviewMode = false;
      state.phone.settingsAppearanceAnchor = null;
      state.phone.memoryAppearanceAnchor = null;
      state.phone.memoryAppearancePreviewMode = false;
      state.phone.musicAppearancePreviewMode = false;
      state.phone.companionAppearancePreviewMode = false;
      state.phone.companionAppearanceAnchor = null;
      if (appId === 'character') {
        state.phone.characterView = 'list';
      }
      if (appId === 'chat') {
        state.phone.chatView = 'list';
        state.phone.chatSessionDeleteConfirmId = null;
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
    downloadStandaloneHtml: async () => {
      try {
        state.ui.statusMessage = '正在打包本地 HTML 小手机…';
        render();
        const archive = await createStandalonePhoneArchive(state.config);
        downloadStandalonePhoneArchive(archive);
        state.ui.statusMessage = `已下载 ${archive.filename}，共 ${archive.fileCount} 个文件。`;
      } catch (error) {
        state.ui.statusMessage = error.message || '本地 HTML 导出失败，请检查网络后重试。';
      }
      render();
    },
    importJson: async file => {
      try {
        const imported = await importConfigFromFile(file);
        if (!confirmConfigImport(imported)) {
          state.ui.statusMessage = '已取消导入，当前小手机没有变化。';
          render({ keepPhone: true });
          return;
        }
        state.config = imported;
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
          ${state.config.aiAssistant?.enabled ? renderAiAssistantPanel(state.config, state.ui.aiAssistant) : ''}
        </section>
        <aside class="preview-pane">
          <div id="lovePhoneOS"></div>
        </aside>
      </main>
      ${renderCustomizationDrawer(state.config, state.ui, getEnabledApps(state.config, runtimeCapabilities, state.phone.customApps))}
      <div id="globalStorageNotice" class="global-storage-notice" role="alert" hidden></div>
    `;

    app.querySelectorAll('[data-step]').forEach(button => {
      button.addEventListener('click', () => setStep(button.dataset.step));
    });

    bindPanel(app);
    bindAssistantPanel(app);
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
