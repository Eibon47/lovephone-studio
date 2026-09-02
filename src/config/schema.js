import { cloneConfig, defaultConfig } from './defaultConfig.js?v=app-config-96';
import { AI_PROVIDER_CATALOG, DEFAULT_AI_PROVIDERS } from './aiProviderCatalog.js?v=app-config-35';
import { normalizeChatSessionData } from '../services/chatSessionService.js?v=app-config-95';
import { normalizeCustomization } from '../services/customizationModel.js?v=app-config-104';
import { normalizePhoneSetup } from '../services/phoneSetupService.js';
import { normalizeCompanionState } from '../services/companionEventService.js';
import { repairCharacterIds } from '../services/characterIdentityService.js';
import { normalizeCompanionIntegrations, normalizeProactiveSettings } from '../services/companionPolicyService.js';
import { normalizeMemoryEntry } from '../services/memoryRetrievalService.js';
import { migrateLegacyBuiltinWidgets } from '../services/compositionWidgetModel.js?v=app-config-108';

// Cache-bumped default schema keeps older saved phones compatible with new widgets.
const componentKeys = ['chat', 'music', 'memory', 'diary', 'anniversary', 'goodnight'];
const appKeys = ['character', 'chat', 'music', 'memory', 'diary', 'anniversary', 'goodnight', 'settings'];
const fontStyles = ['wenkai', 'clean', 'serif'];
const phoneFrames = ['dark', 'graphite', 'cream', 'midnight'];
const iconSets = ['soft', 'glass', 'sticker', 'mono'];
const widgetStyles = ['colorful', 'glass', 'minimal'];
const appUiThemes = ['lovephone', 'wechat', 'qq', 'instagram', 'x'];

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function mergeAppConfig(baseApp, sourceApp = {}) {
  const merged = {
    ...baseApp,
    ...sourceApp
  };

  if (baseApp.statusBar) {
    merged.statusBar = {
      ...baseApp.statusBar,
      ...(sourceApp.statusBar || {})
    };
  }
  if (baseApp.ai) {
    merged.ai = {
      ...baseApp.ai,
      ...(sourceApp.ai || {})
    };
  }
  if (Array.isArray(baseApp.types)) {
    merged.types = Array.isArray(sourceApp.types) ? sourceApp.types : baseApp.types;
  }

  return merged;
}

function safeCharacterId(value, fallback) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{3,80}$/.test(id) ? id : fallback;
}

function sanitizeAiProfileMap(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, profile]) => /^[a-zA-Z0-9_-]{2,120}$/.test(id) && profile && typeof profile === 'object')
      .map(([id, profile]) => [id, {
        model: typeof profile.model === 'string' ? profile.model.trim().slice(0, 160) : '',
        baseUrl: typeof profile.baseUrl === 'string' ? profile.baseUrl.trim().slice(0, 300) : ''
      }])
  );
}

function migrateChatCharacterIds(messages, mainCharacter, characters) {
  if (!Array.isArray(messages)) return [];
  return messages.map(message => {
    const legacyKey = String(message?.characterId || 'character-0');
    let characterId = legacyKey;
    const legacyMatch = legacyKey.match(/^character-(\d+)$/);
    if (legacyMatch) {
      const index = Number(legacyMatch[1]);
      characterId = index === 0
        ? mainCharacter.id
        : characters[index - 1]?.id || mainCharacter.id;
    }
    return { ...message, characterId };
  });
}

function mergeTheme(baseTheme, sourceTheme = {}) {
  const merged = {
    ...baseTheme,
    ...sourceTheme,
    widgets: {
      ...baseTheme.widgets,
      ...(sourceTheme.widgets || {})
    },
    appLayouts: {
      ...baseTheme.appLayouts,
      ...(sourceTheme.appLayouts || {})
    },
    appLooks: {
      ...baseTheme.appLooks,
      ...(sourceTheme.appLooks || {})
    },
    customization: normalizeCustomization(sourceTheme.customization)
  };

  Object.keys(baseTheme.widgets || {}).forEach(key => {
    merged.widgets[key] = {
      ...baseTheme.widgets[key],
      ...(sourceTheme.widgets?.[key] || {}),
      layout: {
        ...baseTheme.widgets[key].layout,
        ...(sourceTheme.widgets?.[key]?.layout || {})
      }
    };
  });

  Object.entries(merged.appLooks).forEach(([appId, look]) => {
    const sourceLook = look && typeof look === 'object' ? look : {};
    const sourceIcon = sourceLook.icon && typeof sourceLook.icon === 'object' ? sourceLook.icon : {};
    merged.appLooks[appId] = {
      ...sourceLook,
      uiTheme: appUiThemes.includes(sourceLook.uiTheme) ? sourceLook.uiTheme : 'lovephone',
      icon: {
        mode: sourceIcon.mode === 'upload' ? 'upload' : 'preset',
        value: typeof sourceIcon.value === 'string' ? sourceIcon.value : ''
      }
    };
  });

  const legacyCustomization = Number(sourceTheme.customization?.version) < 3;
  merged.customization = normalizeCustomization({
    ...merged.customization,
    widgets: legacyCustomization
      ? migrateLegacyBuiltinWidgets(merged, merged.customization.widgets || [])
      : merged.customization.widgets || []
  });

  return merged;
}

function mergeAiProviders(baseProviders, sourceProviders = {}) {
  const validIds = new Set(AI_PROVIDER_CATALOG.map(provider => provider.id));
  const selected = Array.isArray(sourceProviders.selected)
    ? sourceProviders.selected.filter(id => validIds.has(id))
    : DEFAULT_AI_PROVIDERS;
  const normalizedSelected = selected.length ? [...new Set(selected)] : DEFAULT_AI_PROVIDERS;
  const preferredActive = validIds.has(sourceProviders.activeId)
    ? sourceProviders.activeId
    : sourceProviders.global?.provider;
  const activeId = normalizedSelected.includes(preferredActive) ? preferredActive : normalizedSelected[0];

  return {
    ...baseProviders,
    ...sourceProviders,
    selected: normalizedSelected,
    activeId,
    pendingProfileDeletes: [...new Set(
      (sourceProviders.pendingProfileDeletes || [])
        .map(value => String(value || '').trim())
        .filter(value => /^[a-zA-Z0-9_-]{2,120}$/.test(value))
    )],
    profiles: {
      ...sanitizeAiProfileMap(baseProviders.profiles),
      ...sanitizeAiProfileMap(sourceProviders.profiles)
    },
    global: {
      ...baseProviders.global,
      ...(sourceProviders.global || {}),
      provider: activeId
    }
  };
}

function normalizeAiAssistant(source = {}) {
  const validIds = new Set(AI_PROVIDER_CATALOG.map(provider => provider.id));
  const providerId = validIds.has(source.providerId) ? source.providerId : '';
  const brief = source.designBrief && typeof source.designBrief === 'object' ? source.designBrief : {};
  const briefItems = value => Array.isArray(value)
    ? [...new Set(value.map(item => String(item || '').trim().slice(0, 120)).filter(Boolean))].slice(0, 20)
    : [];
  return {
    enabled: Boolean(source.enabled),
    providerId,
    profileId: 'builder-assistant',
    model: typeof source.model === 'string' ? source.model.trim().slice(0, 160) : '',
    baseUrl: typeof source.baseUrl === 'string' ? source.baseUrl.trim().slice(0, 300) : '',
    designBrief: {
      preferences: briefItems(brief.preferences),
      avoid: briefItems(brief.avoid),
      decisions: briefItems(brief.decisions),
      updatedAt: typeof brief.updatedAt === 'string' ? brief.updatedAt.trim().slice(0, 40) : ''
    }
  };
}

function normalizeCustomApps(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object')
    .slice(0, 30)
    .map(item => ({
      id: safeCharacterId(item.id, ''),
      name: String(item.name || '').trim().slice(0, 60),
      iconOverride: typeof item.iconOverride === 'string' && item.iconOverride.startsWith('data:image/') ? item.iconOverride : '',
      enabled: item.enabled !== false,
      version: String(item.version || '').trim().slice(0, 40),
      permissions: Array.isArray(item.permissions) ? item.permissions.map(value => String(value)).slice(0, 20) : [],
      networkOrigins: Array.isArray(item.networkOrigins) ? item.networkOrigins.map(value => String(value)).slice(0, 20) : []
    })).filter(item => item.id);
}

export function normalizeConfig(input) {
  const base = cloneConfig(defaultConfig);
  const source = input && typeof input === 'object' ? input : {};
  const normalized = {
    ...base,
    ...source,
    meta: { ...base.meta, ...(source.meta || {}) },
    character: {
      ...base.character,
      ...(source.character || {}),
      id: safeCharacterId(source.character?.id, 'character-main'),
      aiProfiles: {
        ...sanitizeAiProfileMap(base.character.aiProfiles),
        ...sanitizeAiProfileMap(source.character?.aiProfiles)
      }
    },
    characters: Array.isArray(source.characters) ? source.characters : [],
    customApps: normalizeCustomApps(source.customApps),
    theme: mergeTheme(base.theme, source.theme || {}),
    components: { ...base.components, ...(source.components || {}) },
    apps: { ...base.apps },
    aiProviders: mergeAiProviders(base.aiProviders, source.aiProviders || {}),
    aiAssistant: normalizeAiAssistant(source.aiAssistant || {}),
    companion: { ...base.companion },
    model: { ...base.model, ...(source.model || {}) },
    memory: { ...base.memory, ...(source.memory || {}) },
    voice: { ...base.voice, ...(source.voice || {}) }
  };

  normalized.version = 6;
  if (Number(source.version || 0) < 6 && source.theme?.appLayouts) {
    normalized.theme.appLayouts = Object.fromEntries(Object.entries(normalized.theme.appLayouts || {}).map(([appId, layout]) => [appId, {
      x: Math.min(11, Math.max(0, Math.round((Number(layout?.x) || 0) * 3))),
      y: Math.max(0, Math.round((Number(layout?.y) || 0) * 3)),
      w: Math.min(12, Math.max(2, Math.round((Number(layout?.w) || 1) * 3))),
      h: Math.min(36, Math.max(2, Math.round((Number(layout?.h) || 2) * 3)))
    }]));
  }
  normalized.theme.appLayouts = Object.fromEntries(Object.entries(normalized.theme.appLayouts || {}).map(([appId, value]) => {
    const layout = value && typeof value === 'object' ? value : {};
    const layoutY = Number(layout.y);
    return [appId, {
      x: Math.min(9, Math.max(0, Math.round(Number(layout.x) || 0))),
      y: Math.min(282, Math.max(0, Math.round(Number.isFinite(layoutY) ? layoutY : 24))),
      w: 3,
      h: 6
    }];
  }));
  normalized.character.avatar = {
    ...base.character.avatar,
    ...(source.character?.avatar || {})
  };
  const identityRepair = repairCharacterIds(normalized.character, normalized.characters);
  normalized.character = identityRepair.main;
  normalized.characters = identityRepair.characters;
  normalized.meta.characterIdRepairs = identityRepair.repairs;
  normalized.meta.characterIdRepairNotice = identityRepair.repairs.length
    ? `已修复 ${identityRepair.repairs.length} 个重复角色编号。为避免聊天和记忆串联，修复后的角色从空白数据开始。`
    : String(source.meta?.characterIdRepairNotice || '');

  appKeys.forEach(key => {
    normalized.apps[key] = mergeAppConfig(base.apps[key], source.apps?.[key]);
  });

  // The old desktop-only bridge was intentionally retired. Keep user-entered
  // compatible API addresses, but do not silently point mobile phones at a
  // computer-local service after migration.
  if (normalized.apps.music.source === 'official-ncm-cli') {
    normalized.apps.music.source = 'netease-compatible-api';
    if (/^https?:\/\/(127\.0\.0\.1|localhost):5188\/?$/i.test(normalized.apps.music.apiBaseUrl || '')) {
      normalized.apps.music.apiBaseUrl = '';
    }
    normalized.apps.music.onlineEnabled = Boolean(normalized.apps.music.apiBaseUrl);
  } else {
    normalized.apps.music.onlineEnabled = Boolean(normalized.apps.music.onlineEnabled);
  }
  if (
    /^https?:\/\/(127\.0\.0\.1|localhost):5188\/?$/i.test(normalized.apps.music.apiBaseUrl || '')
    && !normalized.apps.music.onlineEnabled
  ) {
    normalized.apps.music.apiBaseUrl = '';
  }

  // The old value forced every exported configuration to call the creator's
  // local bridge after it was opened on a deployed website. Empty now selects
  // the appropriate runtime automatically in aiService.
  if (/^http:\/\/(127\.0\.0\.1|localhost):5189\/?$/i.test(normalized.aiProviders.bridgeUrl || '')) {
    normalized.aiProviders.bridgeUrl = '';
  }

  // New defaults are merged per field above. Never replace a user's complete
  // App configuration just because the template or schema version changed.
  normalized.meta.templateId = source.meta?.templateId || base.meta.templateId;
  normalized.meta.appFlowVersion = base.meta.appFlowVersion;
  normalized.meta.phoneSetup = normalizePhoneSetup(source.meta?.phoneSetup || base.meta.phoneSetup);

  componentKeys.forEach(key => {
    const appEnabled = normalized.apps[key]?.enabled;
    normalized.components[key] = Boolean(appEnabled ?? normalized.components[key]);
    if (normalized.apps[key]) {
      normalized.apps[key].enabled = normalized.apps[key].required ? true : normalized.components[key];
    }
  });
  normalized.components.chat = true;
  normalized.apps.character.enabled = true;
  normalized.apps.character.allowMultiple = true;
  normalized.apps.character.avatar = true;
  normalized.apps.chat.enabled = true;
  normalized.apps.settings.enabled = true;

  normalized.memory.enabled = Boolean(normalized.apps.memory.enabled);
  normalized.character.personality = Array.isArray(normalized.character.personality)
    ? normalized.character.personality.slice(0, 5)
    : [];
  normalized.characters = normalized.characters.map(character => ({
    ...base.character,
    ...character,
    aiProfiles: {
      ...sanitizeAiProfileMap(base.character.aiProfiles),
      ...sanitizeAiProfileMap(character.aiProfiles)
    },
    avatar: {
      ...base.character.avatar,
      ...(character.avatar || {})
    },
    personality: Array.isArray(character.personality)
      ? character.personality.slice(0, 5)
      : []
  }));
  const characterIds = new Set([
    normalized.character.id,
    ...normalized.characters.map(character => character.id)
  ]);
  normalized.companion = normalizeCompanionState(
    source.companion || base.companion,
    [...characterIds],
    normalized.character.id
  );
  normalized.companion.proactive = normalizeProactiveSettings(
    source.companion?.proactive || base.companion.proactive,
    [...characterIds]
  );
  normalized.companion.integrations = normalizeCompanionIntegrations(
    source.companion?.integrations || base.companion.integrations
  );
  const integrationForTask = {
    'diary-response': 'diaryCompanion',
    'anniversary-reminder': 'anniversaryCompanion'
  };
  normalized.companion.tasks = normalized.companion.tasks.map(task => {
    const integration = integrationForTask[task.type];
    return integration && task.status === 'pending' && !normalized.companion.integrations[integration]
      ? { ...task, status: 'cancelled', completedAt: new Date().toISOString(), error: '对应 App 联动尚未授权' }
      : task;
  });
  normalized.apps.character.activeCharacterId = characterIds.has(normalized.apps.character.activeCharacterId)
    ? normalized.apps.character.activeCharacterId
    : normalized.character.id;
  normalized.apps.chat.messages = migrateChatCharacterIds(
    normalized.apps.chat.messages,
    normalized.character,
    normalized.characters
  );
  const chatSessionData = normalizeChatSessionData(
    normalized.apps.chat,
    [...characterIds],
    normalized.meta.createdAt || normalized.meta.updatedAt
  );
  normalized.apps.chat.sessions = chatSessionData.sessions;
  normalized.apps.chat.activeSessionIds = chatSessionData.activeSessionIds;
  normalized.apps.chat.messages = chatSessionData.messages;
  normalized.apps.memory.entries = Array.isArray(normalized.apps.memory.entries)
    ? normalized.apps.memory.entries.map(entry => normalizeMemoryEntry({
        ...entry,
        characterId: characterIds.has(entry?.characterId) ? entry.characterId : normalized.character.id
      }, normalized.character.id))
    : [];

  delete normalized.theme.wallpaper;

  if (!fontStyles.includes(normalized.theme.fontStyle)) {
    normalized.theme.fontStyle = base.theme.fontStyle;
  }
  if (!phoneFrames.includes(normalized.theme.phoneFrame)) {
    normalized.theme.phoneFrame = base.theme.phoneFrame;
  }
  if (!iconSets.includes(normalized.theme.iconSet)) {
    normalized.theme.iconSet = base.theme.iconSet;
  }
  if (!widgetStyles.includes(normalized.theme.widgetStyle)) {
    normalized.theme.widgetStyle = base.theme.widgetStyle;
  }
  if (!isHexColor(normalized.theme.primaryColor)) {
    normalized.theme.primaryColor = base.theme.primaryColor;
  }

  normalized.meta.updatedAt = new Date().toISOString();
  if (!normalized.meta.createdAt) normalized.meta.createdAt = normalized.meta.updatedAt;

  return normalized;
}

export function parseConfigJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error('\u8fd9\u4e0d\u662f\u6709\u6548\u7684 JSON \u6587\u4ef6\u3002');
  }
  return normalizeConfig(parsed);
}


