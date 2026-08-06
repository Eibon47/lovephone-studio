import { cloneConfig, defaultConfig } from './defaultConfig.js?v=app-config-95';
import { AI_PROVIDER_CATALOG, DEFAULT_AI_PROVIDERS } from './aiProviderCatalog.js?v=app-config-35';
import { normalizeChatSessionData } from '../services/chatSessionService.js?v=app-config-95';
import { normalizeCustomization } from '../services/customizationModel.js';
import { normalizePhoneSetup } from '../services/phoneSetupService.js';

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

function normalizeCharacterList(value) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set(['character-main']);
  return value
    .filter(item => item && typeof item === 'object')
    .slice(0, 11)
    .map((item, index) => {
      let id = safeCharacterId(item.id, `character-extra-${index + 1}`);
      if (usedIds.has(id)) id = `character-extra-${index + 1}`;
      usedIds.add(id);
      return { ...item, id };
    });
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
  return {
    enabled: Boolean(source.enabled),
    providerId,
    profileId: 'builder-assistant',
    model: typeof source.model === 'string' ? source.model.trim().slice(0, 160) : '',
    baseUrl: typeof source.baseUrl === 'string' ? source.baseUrl.trim().slice(0, 300) : ''
  };
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
    characters: normalizeCharacterList(source.characters),
    theme: mergeTheme(base.theme, source.theme || {}),
    components: { ...base.components, ...(source.components || {}) },
    apps: { ...base.apps },
    aiProviders: mergeAiProviders(base.aiProviders, source.aiProviders || {}),
    aiAssistant: normalizeAiAssistant(source.aiAssistant || {}),
    model: { ...base.model, ...(source.model || {}) },
    memory: { ...base.memory, ...(source.memory || {}) },
    voice: { ...base.voice, ...(source.voice || {}) }
  };

  normalized.version = 4;
  normalized.character.avatar = {
    ...base.character.avatar,
    ...(source.character?.avatar || {})
  };

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
    ? normalized.apps.memory.entries.map(entry => ({
        ...entry,
        characterId: characterIds.has(entry?.characterId)
          ? entry.characterId
          : normalized.character.id
      }))
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


