const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/;
const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const CUSTOMIZATION_VERSION = 2;
export const CUSTOM_WIDGET_SOURCES = [
  'time', 'date', 'weather', 'activeCharacter', 'music',
  'anniversary', 'diary', 'memory', 'mood'
];
export const CUSTOM_WIDGET_ACTIONS = [
  'none', 'openApp', 'musicPlayPause', 'musicPrevious', 'musicNext',
  'switchCharacter', 'createDiary', 'openChat', 'openAnniversary'
];
export const CUSTOM_WIDGET_TYPES = ['text', 'image', 'progress', 'list'];

export const CUSTOM_WIDGET_TEMPLATES = [
  { id: 'clock', name: '数字时钟', description: '大号时间、日期与星期', type: 'text', dataSource: 'time', action: 'none', size: [4, 2], tone: ['#dff2e8', '#183629'] },
  { id: 'weather', name: '天气卡片', description: '城市、温度与天气状态', type: 'progress', dataSource: 'weather', action: 'none', size: [2, 2], tone: ['#dcecf5', '#24495d'] },
  { id: 'calendar', name: '日历', description: '日期、星期与月历视觉', type: 'text', dataSource: 'date', action: 'none', size: [2, 2], tone: ['#fffdf6', '#493f3b'] },
  { id: 'music', name: '音乐播放器', description: '歌曲信息与播放控制', type: 'progress', dataSource: 'music', action: 'musicPlayPause', size: [4, 2], tone: ['#262a2d', '#ffffff'] },
  { id: 'photo', name: '相框', description: '上传一张本地图片作为桌面相框', type: 'image', dataSource: 'date', action: 'none', size: [2, 2], tone: ['#fffdf6', '#183629'] },
  { id: 'character', name: '角色状态', description: '显示当前角色与关系状态', type: 'text', dataSource: 'activeCharacter', action: 'openChat', size: [4, 2], tone: ['#f3e8f5', '#4d3553'] },
  { id: 'anniversary', name: '纪念日', description: '显示最近的重要日期和天数', type: 'progress', dataSource: 'anniversary', action: 'openAnniversary', size: [2, 2], tone: ['#f8e8e8', '#6a3e43'] },
  { id: 'actions', name: '快捷启动', description: '快速进入常用功能', type: 'list', dataSource: 'activeCharacter', action: 'openApp', actionTarget: 'chat', size: [4, 2], tone: ['#edf1f5', '#263746'] },
  { id: 'mood', name: '心情记录', description: '显示最近一次心情记录', type: 'progress', dataSource: 'mood', action: 'createDiary', size: [2, 2], tone: ['#f9edcf', '#5c4930'] },
  { id: 'note', name: '桌面便签', description: '把最近日记变成桌面便签', type: 'list', dataSource: 'diary', action: 'createDiary', size: [4, 2], tone: ['#fff2b8', '#514521'] }
];

const CUSTOM_WIDGET_TEMPLATE_IDS = new Set(CUSTOM_WIDGET_TEMPLATES.map(template => template.id));
const DEFAULT_WIDGET_CODE = Object.freeze({
  html: '<div class="card"><strong data-title>我的组件</strong><p data-detail>从左侧选择允许的数据。</p><button data-action="openChat">打开聊天</button></div>',
  css: '.card { height: 100%; display: grid; align-content: center; gap: 6px; padding: 12px; border-radius: 14px; background: #fffdf6; color: #183629; }\nbutton { width: fit-content; border: 0; padding: 6px 10px; border-radius: 8px; background: #7fb59a; color: white; }',
  js: "const character = widget.data('activeCharacter');\nif (character) {\n  document.querySelector('[data-title]').textContent = character.primary;\n  document.querySelector('[data-detail]').textContent = character.secondary;\n}\ndocument.querySelector('[data-action]').addEventListener('click', () => widget.openChat());",
  dataPermissions: ['activeCharacter'],
  actionPermissions: ['openChat']
});

export const DEFAULT_CHAT_APPEARANCE = Object.freeze({
  enabled: false,
  overall: {
    pageBackground: '#f3f7ed',
    conversationBackground: '#f3f7ed',
    headerBackground: '#fffaf0',
    headerText: '#183629',
    contentPadding: 20,
    headerAlign: 'center'
  },
  list: {
    rowHeight: 76,
    avatarSize: 48,
    avatarRadius: 12,
    divider: '#dbe4dc',
    nameColor: '#263b30',
    summaryColor: '#6f7f75',
    metaColor: '#99a39d',
    showRelationship: true,
    showArrow: true
  },
  bubbles: {
    maxWidth: 76,
    messageGap: 12,
    avatarSize: 28,
    avatarRadius: 9,
    showAvatar: true,
    showTime: true,
    showSessionTools: true,
    incomingBackground: '#fffdf6',
    incomingText: '#283b31',
    incomingRadius: 16,
    outgoingBackground: '#cfe7da',
    outgoingText: '#283b31',
    outgoingRadius: 16,
    paddingX: 13,
    paddingY: 10,
    tail: 'none'
  },
  composer: {
    background: '#fffdf6',
    inputBackground: '#f5f7f2',
    text: '#2c4034',
    accent: '#7fb59a',
    radius: 18,
    height: 48,
    floating: false,
    showQuickReplies: true,
    quickReplyBackground: '#fffdf6',
    quickReplyText: '#4d6758',
    quickReplyRadius: 20
  }
});

export const DEFAULT_CHARACTER_APPEARANCE = Object.freeze({
  enabled: false,
  overall: {
    pageBackground: '#f3f7ed',
    headerBackground: '#fffaf0',
    headerText: '#183629',
    contentPadding: 20,
    sectionGap: 12,
    headerAlign: 'center'
  },
  list: {
    containerBackground: '#fffdf6',
    containerRadius: 18,
    rowHeight: 68,
    avatarSize: 42,
    avatarRadius: 14,
    divider: '#dbe4dc',
    nameColor: '#31483b',
    summaryColor: '#66786d',
    metaColor: '#87958d',
    activeBackground: '#e8f3ec',
    showStatus: true,
    showMeta: true
  },
  detail: {
    profileBackground: '#fffdf6',
    profileText: '#31483b',
    profileMuted: '#5d7063',
    profileRadius: 18,
    profileAvatarSize: 54,
    profileAvatarRadius: 18,
    sectionBackground: '#fffdf6',
    sectionRadius: 18,
    fieldBackground: '#fffff7',
    fieldText: '#26382e',
    fieldRadius: 12,
    accent: '#7fb59a',
    actionRadius: 8,
    tagBackground: '#fffdf6',
    tagText: '#52695a',
    tagRadius: 20,
    showStatus: true,
    showTools: true,
    showManagement: true,
    showTags: true
  }
});

export const DEFAULT_SETTINGS_APPEARANCE = Object.freeze({
  enabled: false,
  overall: {
    pageBackground: '#f3f7ed',
    headerBackground: '#fffaf0',
    headerText: '#183629',
    contentPadding: 20,
    sectionGap: 12,
    headerAlign: 'center',
    showProfilePrelude: true
  },
  groups: {
    background: '#fffdf6',
    radius: 18,
    border: '#e2ddd0',
    headerHeight: 58,
    iconBackground: '#6f9f85',
    iconText: '#ffffff',
    iconSize: 32,
    iconRadius: 8,
    titleText: '#31483b',
    subtitleText: '#728178',
    divider: '#dbe4dc'
  },
  controls: {
    rowHeight: 48,
    labelText: '#31483b',
    mutedText: '#7c8a81',
    fieldBackground: '#ffffff',
    fieldText: '#31483b',
    fieldRadius: 7,
    accent: '#7fb59a',
    buttonBackground: '#ffffff',
    buttonText: '#40594b',
    buttonRadius: 7,
    noteBackground: '#f7efe2',
    noteText: '#8a7666',
    showSecurityNotes: true
  }
});

export const DEFAULT_MEMORY_APPEARANCE = Object.freeze({
  enabled: false,
  overall: {
    pageBackground: '#f3f7ed',
    headerBackground: '#fffaf0',
    headerText: '#183629',
    contentPadding: 20,
    sectionGap: 12,
    headerAlign: 'center',
    showSearch: true,
    showCount: true
  },
  editor: {
    background: '#fffdf6',
    titleText: '#30483a',
    radius: 14,
    fieldBackground: '#fffff9',
    fieldText: '#2f4337',
    fieldRadius: 9,
    accent: '#7fb59a',
    buttonText: '#ffffff',
    buttonRadius: 9
  },
  cards: {
    gap: 9,
    background: '#fffdf6',
    borderAccent: '#9fcab2',
    radius: 12,
    titleText: '#26382e',
    bodyText: '#52665a',
    metaText: '#708076',
    tagBackground: '#e8f3ec',
    tagText: '#456252',
    tagRadius: 20,
    actionText: '#4d7a61',
    showDate: true,
    showActions: true
  }
});

export const DEFAULT_MUSIC_APPEARANCE = Object.freeze({
  enabled: false,
  overall: {
    pageBackground: '#f7f7f7',
    headerText: '#242424',
    accent: '#e54843',
    contentPadding: 18,
    sectionGap: 14,
    headerAlign: 'center'
  },
  home: {
    searchBackground: '#ececec',
    searchText: '#222222',
    searchRadius: 19,
    heroRadius: 8,
    shortcutBackground: '#fde7e5',
    shortcutText: '#e64c47',
    shortcutSize: 39,
    sectionTitle: '#242424',
    mutedText: '#909090',
    coverRadius: 7,
    trackRowHeight: 58,
    divider: '#e7e7e7',
    showHero: true,
    showShortcuts: true
  },
  mini: {
    background: '#ffffff',
    text: '#242424',
    mutedText: '#888888',
    radius: 8,
    height: 64,
    progressBackground: '#e6e6e6',
    progressAccent: '#df4540',
    showTime: true
  },
  player: {
    background: '#231d1d',
    text: '#f8f3f1',
    mutedText: '#a9a09d',
    accent: '#f5f0ed',
    recordSize: 220,
    coverSize: 130,
    stageHeight: 240,
    mainControlBackground: '#f5f0ed',
    mainControlText: '#262020',
    showNeedle: true,
    showVolume: true,
    showQueue: true
  }
});

export const DEFAULT_COMPANION_APPEARANCE = Object.freeze({
  enabled: false,
  overall: {
    pageBackground: '#f3f7ed', headerBackground: '#fffaf0', headerText: '#183629',
    contentPadding: 20, sectionGap: 12, headerAlign: 'center', showHeaderMeta: true, showDecorations: true
  },
  editor: {
    background: '#fffdf6', titleText: '#30483a', radius: 14,
    fieldBackground: '#fffff9', fieldText: '#2f4337', fieldRadius: 9,
    accent: '#7fb59a', buttonText: '#ffffff', buttonRadius: 9
  },
  cards: {
    background: '#fffdf6', accent: '#9fcab2', radius: 12, gap: 9,
    titleText: '#26382e', bodyText: '#52665a', metaText: '#708076', actionText: '#4d7a61',
    showActions: true, showExtraPanels: true
  }
});

export const DEFAULT_APP_MEDIA = Object.freeze({
  backgroundImage: '',
  backgroundFit: 'cover',
  backgroundPosition: 'center',
  primaryButtonImage: '',
  primaryButtonMode: 'background',
  primaryButtonFit: 'cover',
  backButtonImage: ''
});

export const DEFAULT_CUSTOMIZATION = Object.freeze({
  version: CUSTOMIZATION_VERSION,
  developerMode: false,
  active: {
    basic: false,
    shell: false,
    palette: false,
    iconPack: false,
    desktop: false
  },
  tokens: {
    background: '#f3f7ed',
    surface: '#fffdf6',
    text: '#183629',
    muted: '#6f8178',
    secondary: '#d8eadf',
    accent: '#7fb59a',
    danger: '#c96565',
    radius: 16,
    borderWidth: 1,
    shadow: 18,
    opacity: 100,
    spacing: 8,
    fontSize: 14
  },
  phoneShell: {
    frameColor: '#252525',
    frameWidth: 8,
    radius: 46,
    screenInset: 0,
    islandWidth: 126,
    islandHeight: 36,
    indicatorWidth: 134
  },
  desktop: {
    columns: 4,
    gap: 8,
    iconSize: 52,
    labelSize: 12,
    dockOpacity: 88
  },
  iconPack: { name: '', icons: {} },
  appThemes: {},
  css: '',
  widgets: [],
  activePackageIds: []
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stringValue(value, fallback = '', maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function codeValue(value, fallback = '', maxLength = 12000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function numberValue(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function colorValue(value, fallback) {
  return HEX_COLOR.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

function idValue(value, fallback = '') {
  const id = stringValue(value, fallback, 80);
  return SAFE_ID.test(id) ? id : fallback;
}

function imageValue(value) {
  const source = typeof value === 'string' ? value.trim() : '';
  return IMAGE_DATA_URL.test(source) ? source : '';
}

function normalizeTokens(value = {}) {
  const source = objectValue(value);
  const base = DEFAULT_CUSTOMIZATION.tokens;
  return {
    background: colorValue(source.background, base.background),
    surface: colorValue(source.surface, base.surface),
    text: colorValue(source.text, base.text),
    muted: colorValue(source.muted, base.muted),
    secondary: colorValue(source.secondary, base.secondary),
    accent: colorValue(source.accent, base.accent),
    danger: colorValue(source.danger, base.danger),
    radius: numberValue(source.radius, base.radius, 0, 32),
    borderWidth: numberValue(source.borderWidth, base.borderWidth, 0, 4),
    shadow: numberValue(source.shadow, base.shadow, 0, 40),
    opacity: numberValue(source.opacity, base.opacity, 40, 100),
    spacing: numberValue(source.spacing, base.spacing, 2, 24),
    fontSize: numberValue(source.fontSize, base.fontSize, 11, 20)
  };
}

function normalizePhoneShell(value = {}) {
  const source = objectValue(value);
  const base = DEFAULT_CUSTOMIZATION.phoneShell;
  return {
    frameColor: colorValue(source.frameColor, base.frameColor),
    frameWidth: numberValue(source.frameWidth, base.frameWidth, 2, 18),
    radius: numberValue(source.radius, base.radius, 24, 64),
    screenInset: numberValue(source.screenInset, base.screenInset, 0, 12),
    islandWidth: numberValue(source.islandWidth, base.islandWidth, 72, 170),
    islandHeight: numberValue(source.islandHeight, base.islandHeight, 22, 48),
    indicatorWidth: numberValue(source.indicatorWidth, base.indicatorWidth, 72, 180)
  };
}

function normalizeDesktop(value = {}) {
  const source = objectValue(value);
  const base = DEFAULT_CUSTOMIZATION.desktop;
  return {
    columns: Math.round(numberValue(source.columns, base.columns, 3, 6)),
    gap: numberValue(source.gap, base.gap, 2, 20),
    iconSize: numberValue(source.iconSize, base.iconSize, 36, 72),
    labelSize: numberValue(source.labelSize, base.labelSize, 10, 16),
    dockOpacity: numberValue(source.dockOpacity, base.dockOpacity, 30, 100)
  };
}

function normalizeIconPack(value = {}) {
  const source = objectValue(value);
  const icons = {};
  Object.entries(objectValue(source.icons)).slice(0, 80).forEach(([appId, image]) => {
    const safeId = idValue(appId);
    const safeImage = imageValue(image);
    if (safeId && safeImage) icons[safeId] = safeImage;
  });
  return { name: stringValue(source.name, '', 60), icons };
}

export function validateCustomCss(value) {
  const css = typeof value === 'string' ? value.trim() : '';
  if (!css) return { valid: true, css: '', errors: [] };
  const errors = [];
  const forbidden = [
    [/@import\b/i, 'CSS cannot use @import.'],
    [/@font-face\b/i, 'CSS cannot declare fonts.'],
    [/@(?:supports|document|page|keyframes|layer|property)\b/i, 'CSS at-rules are not supported.'],
    [/<\/?style\b|<\/?[a-z][^>]*>/i, 'HTML is not allowed in CSS.'],
    [/\b(?:javascript|vbscript)\s*:/i, 'Script URLs are not allowed.'],
    [/\bexpression\s*\(|\b(?:behavior|-moz-binding)\s*:/i, 'Executable CSS is not allowed.'],
    [/url\s*\(\s*['"]?\s*(?:https?:|\/\/|data:|blob:)/i, 'External or embedded URLs are not allowed.']
  ];
  forbidden.forEach(([pattern, message]) => {
    if (pattern.test(css)) errors.push(message);
  });
  if (css.length > 20000) errors.push('CSS is larger than 20 KB.');
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) {
    errors.push('CSS braces are not balanced.');
  }
  return { valid: errors.length === 0, css: errors.length ? '' : css, errors };
}

export function validateCustomWidgetCode(value = {}) {
  const source = objectValue(value);
  const html = codeValue(source.html, '', 8000);
  const css = codeValue(source.css, '', 12000);
  const js = codeValue(source.js, '', 12000);
  const errors = [];
  const htmlForbidden = [
    [/<\s*\/?\s*(?:script|style|link|meta|base|iframe|object|embed|form)\b/i, 'HTML 不能包含脚本、外链、框架或表单标签。'],
    [/\son[a-z]+\s*=/i, 'HTML 事件请写在 JavaScript 区域，不能使用 onClick 等属性。'],
    [/(?:https?:|\/\/|javascript:|vbscript:)/i, 'HTML 不能引用外部地址或脚本地址。']
  ];
  const jsForbidden = [
    [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|importScripts)\b/, 'JavaScript 不能访问网络或创建后台线程。'],
    [/\b(?:localStorage|sessionStorage|indexedDB|cookie|sendBeacon)\b/, 'JavaScript 不能读取浏览器存储或 Cookie。'],
    [/\b(?:parent|top|opener|frames)\b|window\s*\.\s*open\b/, 'JavaScript 不能访问父页面或打开新窗口。'],
    [/\b(?:location|history)\b/, 'JavaScript 不能跳转页面或修改浏览历史。'],
    [/\b(?:eval|Function)\s*\(/, 'JavaScript 不能再次动态执行代码。']
  ];
  htmlForbidden.forEach(([pattern, message]) => {
    if (pattern.test(html)) errors.push(message);
  });
  jsForbidden.forEach(([pattern, message]) => {
    if (pattern.test(js)) errors.push(message);
  });
  const cssResult = validateCustomCss(css);
  if (!cssResult.valid) errors.push(...cssResult.errors);
  if (String(source.html || '').length > 8000) errors.push('HTML 不能超过 8 KB。');
  if (String(source.css || '').length > 12000) errors.push('CSS 不能超过 12 KB。');
  if (String(source.js || '').length > 12000) errors.push('JavaScript 不能超过 12 KB。');
  return {
    valid: errors.length === 0,
    errors,
    code: errors.length ? { html: '', css: '', js: '' } : { html, css, js }
  };
}

function normalizeVariables(value = {}) {
  const variables = {};
  Object.entries(objectValue(value)).slice(0, 40).forEach(([key, rawValue]) => {
    const safeKey = idValue(key);
    const safeValue = stringValue(rawValue, '', 20);
    if (safeKey && HEX_COLOR.test(safeValue)) variables[safeKey] = safeValue.toLowerCase();
  });
  return variables;
}

function booleanValue(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}

export function normalizeChatAppearance(value = {}) {
  const source = objectValue(value);
  const overall = objectValue(source.overall);
  const list = objectValue(source.list);
  const bubbles = objectValue(source.bubbles);
  const composer = objectValue(source.composer);
  const base = DEFAULT_CHAT_APPEARANCE;
  return {
    enabled: booleanValue(source.enabled, base.enabled),
    overall: {
      pageBackground: colorValue(overall.pageBackground, base.overall.pageBackground),
      conversationBackground: colorValue(overall.conversationBackground, base.overall.conversationBackground),
      headerBackground: colorValue(overall.headerBackground, base.overall.headerBackground),
      headerText: colorValue(overall.headerText, base.overall.headerText),
      contentPadding: numberValue(overall.contentPadding, base.overall.contentPadding, 10, 30),
      headerAlign: enumValue(overall.headerAlign, ['left', 'center', 'right'], base.overall.headerAlign)
    },
    list: {
      rowHeight: numberValue(list.rowHeight, base.list.rowHeight, 58, 104),
      avatarSize: numberValue(list.avatarSize, base.list.avatarSize, 36, 64),
      avatarRadius: numberValue(list.avatarRadius, base.list.avatarRadius, 0, 32),
      divider: colorValue(list.divider, base.list.divider),
      nameColor: colorValue(list.nameColor, base.list.nameColor),
      summaryColor: colorValue(list.summaryColor, base.list.summaryColor),
      metaColor: colorValue(list.metaColor, base.list.metaColor),
      showRelationship: booleanValue(list.showRelationship, base.list.showRelationship),
      showArrow: booleanValue(list.showArrow, base.list.showArrow)
    },
    bubbles: {
      maxWidth: numberValue(bubbles.maxWidth, base.bubbles.maxWidth, 45, 92),
      messageGap: numberValue(bubbles.messageGap, base.bubbles.messageGap, 2, 28),
      avatarSize: numberValue(bubbles.avatarSize, base.bubbles.avatarSize, 20, 44),
      avatarRadius: numberValue(bubbles.avatarRadius, base.bubbles.avatarRadius, 0, 22),
      showAvatar: booleanValue(bubbles.showAvatar, base.bubbles.showAvatar),
      showTime: booleanValue(bubbles.showTime, base.bubbles.showTime),
      showSessionTools: booleanValue(bubbles.showSessionTools, base.bubbles.showSessionTools),
      incomingBackground: colorValue(bubbles.incomingBackground, base.bubbles.incomingBackground),
      incomingText: colorValue(bubbles.incomingText, base.bubbles.incomingText),
      incomingRadius: numberValue(bubbles.incomingRadius, base.bubbles.incomingRadius, 0, 30),
      outgoingBackground: colorValue(bubbles.outgoingBackground, base.bubbles.outgoingBackground),
      outgoingText: colorValue(bubbles.outgoingText, base.bubbles.outgoingText),
      outgoingRadius: numberValue(bubbles.outgoingRadius, base.bubbles.outgoingRadius, 0, 30),
      paddingX: numberValue(bubbles.paddingX, base.bubbles.paddingX, 7, 22),
      paddingY: numberValue(bubbles.paddingY, base.bubbles.paddingY, 5, 18),
      tail: enumValue(bubbles.tail, ['none', 'soft', 'sharp'], base.bubbles.tail)
    },
    composer: {
      background: colorValue(composer.background, base.composer.background),
      inputBackground: colorValue(composer.inputBackground, base.composer.inputBackground),
      text: colorValue(composer.text, base.composer.text),
      accent: colorValue(composer.accent, base.composer.accent),
      radius: numberValue(composer.radius, base.composer.radius, 0, 30),
      height: numberValue(composer.height, base.composer.height, 42, 76),
      floating: booleanValue(composer.floating, base.composer.floating),
      showQuickReplies: booleanValue(composer.showQuickReplies, base.composer.showQuickReplies),
      quickReplyBackground: colorValue(composer.quickReplyBackground, base.composer.quickReplyBackground),
      quickReplyText: colorValue(composer.quickReplyText, base.composer.quickReplyText),
      quickReplyRadius: numberValue(composer.quickReplyRadius, base.composer.quickReplyRadius, 0, 30)
    }
  };
}

export function normalizeCharacterAppearance(value = {}) {
  const source = objectValue(value);
  const overall = objectValue(source.overall);
  const list = objectValue(source.list);
  const detail = objectValue(source.detail);
  const base = DEFAULT_CHARACTER_APPEARANCE;
  return {
    enabled: booleanValue(source.enabled, base.enabled),
    overall: {
      pageBackground: colorValue(overall.pageBackground, base.overall.pageBackground),
      headerBackground: colorValue(overall.headerBackground, base.overall.headerBackground),
      headerText: colorValue(overall.headerText, base.overall.headerText),
      contentPadding: numberValue(overall.contentPadding, base.overall.contentPadding, 10, 30),
      sectionGap: numberValue(overall.sectionGap, base.overall.sectionGap, 4, 24),
      headerAlign: enumValue(overall.headerAlign, ['left', 'center', 'right'], base.overall.headerAlign)
    },
    list: {
      containerBackground: colorValue(list.containerBackground, base.list.containerBackground),
      containerRadius: numberValue(list.containerRadius, base.list.containerRadius, 0, 30),
      rowHeight: numberValue(list.rowHeight, base.list.rowHeight, 54, 104),
      avatarSize: numberValue(list.avatarSize, base.list.avatarSize, 30, 64),
      avatarRadius: numberValue(list.avatarRadius, base.list.avatarRadius, 0, 32),
      divider: colorValue(list.divider, base.list.divider),
      nameColor: colorValue(list.nameColor, base.list.nameColor),
      summaryColor: colorValue(list.summaryColor, base.list.summaryColor),
      metaColor: colorValue(list.metaColor, base.list.metaColor),
      activeBackground: colorValue(list.activeBackground, base.list.activeBackground),
      showStatus: booleanValue(list.showStatus, base.list.showStatus),
      showMeta: booleanValue(list.showMeta, base.list.showMeta)
    },
    detail: {
      profileBackground: colorValue(detail.profileBackground, base.detail.profileBackground),
      profileText: colorValue(detail.profileText, base.detail.profileText),
      profileMuted: colorValue(detail.profileMuted, base.detail.profileMuted),
      profileRadius: numberValue(detail.profileRadius, base.detail.profileRadius, 0, 30),
      profileAvatarSize: numberValue(detail.profileAvatarSize, base.detail.profileAvatarSize, 36, 76),
      profileAvatarRadius: numberValue(detail.profileAvatarRadius, base.detail.profileAvatarRadius, 0, 38),
      sectionBackground: colorValue(detail.sectionBackground, base.detail.sectionBackground),
      sectionRadius: numberValue(detail.sectionRadius, base.detail.sectionRadius, 0, 30),
      fieldBackground: colorValue(detail.fieldBackground, base.detail.fieldBackground),
      fieldText: colorValue(detail.fieldText, base.detail.fieldText),
      fieldRadius: numberValue(detail.fieldRadius, base.detail.fieldRadius, 0, 24),
      accent: colorValue(detail.accent, base.detail.accent),
      actionRadius: numberValue(detail.actionRadius, base.detail.actionRadius, 0, 20),
      tagBackground: colorValue(detail.tagBackground, base.detail.tagBackground),
      tagText: colorValue(detail.tagText, base.detail.tagText),
      tagRadius: numberValue(detail.tagRadius, base.detail.tagRadius, 0, 24),
      showStatus: booleanValue(detail.showStatus, base.detail.showStatus),
      showTools: booleanValue(detail.showTools, base.detail.showTools),
      showManagement: booleanValue(detail.showManagement, base.detail.showManagement),
      showTags: booleanValue(detail.showTags, base.detail.showTags)
    }
  };
}

export function normalizeSettingsAppearance(value = {}) {
  const source = objectValue(value);
  const overall = objectValue(source.overall);
  const groups = objectValue(source.groups);
  const controls = objectValue(source.controls);
  const base = DEFAULT_SETTINGS_APPEARANCE;
  return {
    enabled: booleanValue(source.enabled, base.enabled),
    overall: {
      pageBackground: colorValue(overall.pageBackground, base.overall.pageBackground),
      headerBackground: colorValue(overall.headerBackground, base.overall.headerBackground),
      headerText: colorValue(overall.headerText, base.overall.headerText),
      contentPadding: numberValue(overall.contentPadding, base.overall.contentPadding, 10, 30),
      sectionGap: numberValue(overall.sectionGap, base.overall.sectionGap, 4, 24),
      headerAlign: enumValue(overall.headerAlign, ['left', 'center', 'right'], base.overall.headerAlign),
      showProfilePrelude: booleanValue(overall.showProfilePrelude, base.overall.showProfilePrelude)
    },
    groups: {
      background: colorValue(groups.background, base.groups.background),
      radius: numberValue(groups.radius, base.groups.radius, 0, 30),
      border: colorValue(groups.border, base.groups.border),
      headerHeight: numberValue(groups.headerHeight, base.groups.headerHeight, 46, 84),
      iconBackground: colorValue(groups.iconBackground, base.groups.iconBackground),
      iconText: colorValue(groups.iconText, base.groups.iconText),
      iconSize: numberValue(groups.iconSize, base.groups.iconSize, 24, 46),
      iconRadius: numberValue(groups.iconRadius, base.groups.iconRadius, 0, 22),
      titleText: colorValue(groups.titleText, base.groups.titleText),
      subtitleText: colorValue(groups.subtitleText, base.groups.subtitleText),
      divider: colorValue(groups.divider, base.groups.divider)
    },
    controls: {
      rowHeight: numberValue(controls.rowHeight, base.controls.rowHeight, 40, 76),
      labelText: colorValue(controls.labelText, base.controls.labelText),
      mutedText: colorValue(controls.mutedText, base.controls.mutedText),
      fieldBackground: colorValue(controls.fieldBackground, base.controls.fieldBackground),
      fieldText: colorValue(controls.fieldText, base.controls.fieldText),
      fieldRadius: numberValue(controls.fieldRadius, base.controls.fieldRadius, 0, 20),
      accent: colorValue(controls.accent, base.controls.accent),
      buttonBackground: colorValue(controls.buttonBackground, base.controls.buttonBackground),
      buttonText: colorValue(controls.buttonText, base.controls.buttonText),
      buttonRadius: numberValue(controls.buttonRadius, base.controls.buttonRadius, 0, 20),
      noteBackground: colorValue(controls.noteBackground, base.controls.noteBackground),
      noteText: colorValue(controls.noteText, base.controls.noteText),
      showSecurityNotes: booleanValue(controls.showSecurityNotes, base.controls.showSecurityNotes)
    }
  };
}

export function normalizeMemoryAppearance(value = {}) {
  const source = objectValue(value);
  const overall = objectValue(source.overall);
  const editor = objectValue(source.editor);
  const cards = objectValue(source.cards);
  const base = DEFAULT_MEMORY_APPEARANCE;
  return {
    enabled: booleanValue(source.enabled, base.enabled),
    overall: {
      pageBackground: colorValue(overall.pageBackground, base.overall.pageBackground),
      headerBackground: colorValue(overall.headerBackground, base.overall.headerBackground),
      headerText: colorValue(overall.headerText, base.overall.headerText),
      contentPadding: numberValue(overall.contentPadding, base.overall.contentPadding, 10, 30),
      sectionGap: numberValue(overall.sectionGap, base.overall.sectionGap, 4, 24),
      headerAlign: enumValue(overall.headerAlign, ['left', 'center', 'right'], base.overall.headerAlign),
      showSearch: booleanValue(overall.showSearch, base.overall.showSearch),
      showCount: booleanValue(overall.showCount, base.overall.showCount)
    },
    editor: {
      background: colorValue(editor.background, base.editor.background),
      titleText: colorValue(editor.titleText, base.editor.titleText),
      radius: numberValue(editor.radius, base.editor.radius, 0, 30),
      fieldBackground: colorValue(editor.fieldBackground, base.editor.fieldBackground),
      fieldText: colorValue(editor.fieldText, base.editor.fieldText),
      fieldRadius: numberValue(editor.fieldRadius, base.editor.fieldRadius, 0, 20),
      accent: colorValue(editor.accent, base.editor.accent),
      buttonText: colorValue(editor.buttonText, base.editor.buttonText),
      buttonRadius: numberValue(editor.buttonRadius, base.editor.buttonRadius, 0, 20)
    },
    cards: {
      gap: numberValue(cards.gap, base.cards.gap, 0, 24),
      background: colorValue(cards.background, base.cards.background),
      borderAccent: colorValue(cards.borderAccent, base.cards.borderAccent),
      radius: numberValue(cards.radius, base.cards.radius, 0, 30),
      titleText: colorValue(cards.titleText, base.cards.titleText),
      bodyText: colorValue(cards.bodyText, base.cards.bodyText),
      metaText: colorValue(cards.metaText, base.cards.metaText),
      tagBackground: colorValue(cards.tagBackground, base.cards.tagBackground),
      tagText: colorValue(cards.tagText, base.cards.tagText),
      tagRadius: numberValue(cards.tagRadius, base.cards.tagRadius, 0, 24),
      actionText: colorValue(cards.actionText, base.cards.actionText),
      showDate: booleanValue(cards.showDate, base.cards.showDate),
      showActions: booleanValue(cards.showActions, base.cards.showActions)
    }
  };
}

export function normalizeMusicAppearance(value = {}) {
  const source = objectValue(value);
  const overall = objectValue(source.overall);
  const home = objectValue(source.home);
  const mini = objectValue(source.mini);
  const player = objectValue(source.player);
  const base = DEFAULT_MUSIC_APPEARANCE;
  return {
    enabled: booleanValue(source.enabled, base.enabled),
    overall: {
      pageBackground: colorValue(overall.pageBackground, base.overall.pageBackground),
      headerText: colorValue(overall.headerText, base.overall.headerText),
      accent: colorValue(overall.accent, base.overall.accent),
      contentPadding: numberValue(overall.contentPadding, base.overall.contentPadding, 10, 28),
      sectionGap: numberValue(overall.sectionGap, base.overall.sectionGap, 4, 24),
      headerAlign: enumValue(overall.headerAlign, ['left', 'center', 'right'], base.overall.headerAlign)
    },
    home: {
      searchBackground: colorValue(home.searchBackground, base.home.searchBackground),
      searchText: colorValue(home.searchText, base.home.searchText),
      searchRadius: numberValue(home.searchRadius, base.home.searchRadius, 0, 24),
      heroRadius: numberValue(home.heroRadius, base.home.heroRadius, 0, 24),
      shortcutBackground: colorValue(home.shortcutBackground, base.home.shortcutBackground),
      shortcutText: colorValue(home.shortcutText, base.home.shortcutText),
      shortcutSize: numberValue(home.shortcutSize, base.home.shortcutSize, 30, 52),
      sectionTitle: colorValue(home.sectionTitle, base.home.sectionTitle),
      mutedText: colorValue(home.mutedText, base.home.mutedText),
      coverRadius: numberValue(home.coverRadius, base.home.coverRadius, 0, 20),
      trackRowHeight: numberValue(home.trackRowHeight, base.home.trackRowHeight, 48, 78),
      divider: colorValue(home.divider, base.home.divider),
      showHero: booleanValue(home.showHero, base.home.showHero),
      showShortcuts: booleanValue(home.showShortcuts, base.home.showShortcuts)
    },
    mini: {
      background: colorValue(mini.background, base.mini.background),
      text: colorValue(mini.text, base.mini.text),
      mutedText: colorValue(mini.mutedText, base.mini.mutedText),
      radius: numberValue(mini.radius, base.mini.radius, 0, 24),
      height: numberValue(mini.height, base.mini.height, 52, 82),
      progressBackground: colorValue(mini.progressBackground, base.mini.progressBackground),
      progressAccent: colorValue(mini.progressAccent, base.mini.progressAccent),
      showTime: booleanValue(mini.showTime, base.mini.showTime)
    },
    player: {
      background: colorValue(player.background, base.player.background),
      text: colorValue(player.text, base.player.text),
      mutedText: colorValue(player.mutedText, base.player.mutedText),
      accent: colorValue(player.accent, base.player.accent),
      recordSize: numberValue(player.recordSize, base.player.recordSize, 160, 260),
      coverSize: numberValue(player.coverSize, base.player.coverSize, 90, 170),
      stageHeight: numberValue(player.stageHeight, base.player.stageHeight, 210, 310),
      mainControlBackground: colorValue(player.mainControlBackground, base.player.mainControlBackground),
      mainControlText: colorValue(player.mainControlText, base.player.mainControlText),
      showNeedle: booleanValue(player.showNeedle, base.player.showNeedle),
      showVolume: booleanValue(player.showVolume, base.player.showVolume),
      showQueue: booleanValue(player.showQueue, base.player.showQueue)
    }
  };
}

export function normalizeCompanionAppearance(value = {}) {
  const source = objectValue(value);
  const overall = objectValue(source.overall);
  const editor = objectValue(source.editor);
  const cards = objectValue(source.cards);
  const base = DEFAULT_COMPANION_APPEARANCE;
  return {
    enabled: booleanValue(source.enabled, base.enabled),
    overall: {
      pageBackground: colorValue(overall.pageBackground, base.overall.pageBackground),
      headerBackground: colorValue(overall.headerBackground, base.overall.headerBackground),
      headerText: colorValue(overall.headerText, base.overall.headerText),
      contentPadding: numberValue(overall.contentPadding, base.overall.contentPadding, 10, 30),
      sectionGap: numberValue(overall.sectionGap, base.overall.sectionGap, 4, 24),
      headerAlign: enumValue(overall.headerAlign, ['left', 'center', 'right'], base.overall.headerAlign),
      showHeaderMeta: booleanValue(overall.showHeaderMeta, base.overall.showHeaderMeta),
      showDecorations: booleanValue(overall.showDecorations, base.overall.showDecorations)
    },
    editor: {
      background: colorValue(editor.background, base.editor.background),
      titleText: colorValue(editor.titleText, base.editor.titleText),
      radius: numberValue(editor.radius, base.editor.radius, 0, 30),
      fieldBackground: colorValue(editor.fieldBackground, base.editor.fieldBackground),
      fieldText: colorValue(editor.fieldText, base.editor.fieldText),
      fieldRadius: numberValue(editor.fieldRadius, base.editor.fieldRadius, 0, 20),
      accent: colorValue(editor.accent, base.editor.accent),
      buttonText: colorValue(editor.buttonText, base.editor.buttonText),
      buttonRadius: numberValue(editor.buttonRadius, base.editor.buttonRadius, 0, 20)
    },
    cards: {
      background: colorValue(cards.background, base.cards.background),
      accent: colorValue(cards.accent, base.cards.accent),
      radius: numberValue(cards.radius, base.cards.radius, 0, 30),
      gap: numberValue(cards.gap, base.cards.gap, 0, 24),
      titleText: colorValue(cards.titleText, base.cards.titleText),
      bodyText: colorValue(cards.bodyText, base.cards.bodyText),
      metaText: colorValue(cards.metaText, base.cards.metaText),
      actionText: colorValue(cards.actionText, base.cards.actionText),
      showActions: booleanValue(cards.showActions, base.cards.showActions),
      showExtraPanels: booleanValue(cards.showExtraPanels, base.cards.showExtraPanels)
    }
  };
}

export function normalizeAppMedia(value = {}) {
  const source = objectValue(value);
  const base = DEFAULT_APP_MEDIA;
  return {
    backgroundImage: imageValue(source.backgroundImage),
    backgroundFit: enumValue(source.backgroundFit, ['cover', 'contain', 'tile'], base.backgroundFit),
    backgroundPosition: enumValue(source.backgroundPosition, ['center', 'top', 'bottom'], base.backgroundPosition),
    primaryButtonImage: imageValue(source.primaryButtonImage),
    primaryButtonMode: enumValue(source.primaryButtonMode, ['background', 'replace'], base.primaryButtonMode),
    primaryButtonFit: enumValue(source.primaryButtonFit, ['cover', 'contain'], base.primaryButtonFit),
    backButtonImage: imageValue(source.backButtonImage)
  };
}

function normalizeAppThemes(value = {}) {
  const themes = {};
  Object.entries(objectValue(value)).slice(0, 30).forEach(([appId, rawTheme]) => {
    const safeId = idValue(appId);
    if (!safeId) return;
    const source = objectValue(rawTheme);
    const checkedCss = validateCustomCss(source.css);
    themes[safeId] = {
      enabled: Boolean(source.enabled),
      name: stringValue(source.name, '', 60),
      icon: imageValue(source.icon),
      media: normalizeAppMedia(source.media),
      variables: normalizeVariables(source.variables),
      css: checkedCss.css,
      ...(safeId === 'chat' ? { chat: normalizeChatAppearance(source.chat) } : {}),
      ...(safeId === 'character' ? { character: normalizeCharacterAppearance(source.character) } : {}),
      ...(safeId === 'settings' ? { settings: normalizeSettingsAppearance(source.settings) } : {}),
      ...(safeId === 'memory' ? { memory: normalizeMemoryAppearance(source.memory) } : {}),
      ...(safeId === 'music' ? { music: normalizeMusicAppearance(source.music) } : {}),
      ...(['diary', 'anniversary', 'goodnight'].includes(safeId)
        ? { companion: normalizeCompanionAppearance(source.companion) }
        : {})
    };
  });
  return themes;
}

function normalizeWidget(value, index) {
  const source = objectValue(value);
  const layout = objectValue(source.layout);
  const style = objectValue(source.style);
  const rawCode = objectValue(source.code);
  const codeResult = validateCustomWidgetCode(rawCode);
  const assets = Object.fromEntries(Object.entries(objectValue(source.assets)).slice(0, 8).flatMap(([name, image]) => {
    const safeName = SAFE_ID.test(name) ? name : '';
    const safeImage = imageValue(image);
    return safeName && safeImage ? [[safeName, safeImage]] : [];
  }));
  const templateId = CUSTOM_WIDGET_TEMPLATE_IDS.has(source.templateId) ? source.templateId : 'custom';
  return {
    id: idValue(source.id, `custom-widget-${index + 1}`),
    name: stringValue(source.name, `Widget ${index + 1}`, 60),
    enabled: source.enabled !== false,
    templateId,
    mode: source.mode === 'code' ? 'code' : 'visual',
    type: CUSTOM_WIDGET_TYPES.includes(source.type) ? source.type : 'text',
    dataSource: CUSTOM_WIDGET_SOURCES.includes(source.dataSource) ? source.dataSource : 'time',
    action: CUSTOM_WIDGET_ACTIONS.includes(source.action) ? source.action : 'none',
    actionTarget: idValue(source.actionTarget),
    image: imageValue(source.image),
    assets,
    prefix: stringValue(source.prefix, '', 40),
    suffix: stringValue(source.suffix, '', 40),
    layout: {
      x: Math.round(numberValue(layout.x, 0, 0, 5)),
      y: Math.round(numberValue(layout.y, index * 2, 0, 100)),
      w: Math.round(numberValue(layout.w, 2, 1, 6)),
      h: Math.round(numberValue(layout.h, 2, 1, 6))
    },
    style: {
      background: colorValue(style.background, DEFAULT_CUSTOMIZATION.tokens.surface),
      text: colorValue(style.text, DEFAULT_CUSTOMIZATION.tokens.text),
      accent: colorValue(style.accent, DEFAULT_CUSTOMIZATION.tokens.accent),
      radius: numberValue(style.radius, DEFAULT_CUSTOMIZATION.tokens.radius, 0, 32)
    },
    code: {
      html: codeResult.code.html,
      css: codeResult.code.css,
      js: codeResult.code.js,
      dataPermissions: Array.isArray(rawCode.dataPermissions)
        ? [...new Set(rawCode.dataPermissions.filter(item => CUSTOM_WIDGET_SOURCES.includes(item)))].slice(0, 12)
        : [],
      actionPermissions: Array.isArray(rawCode.actionPermissions)
        ? [...new Set(rawCode.actionPermissions.filter(item => CUSTOM_WIDGET_ACTIONS.includes(item)))].slice(0, 12)
        : []
    }
  };
}

export function createCustomWidgetFromTemplate(templateId, index = 0, id = `custom-widget-${Date.now()}`) {
  const template = CUSTOM_WIDGET_TEMPLATES.find(item => item.id === templateId)
    || CUSTOM_WIDGET_TEMPLATES[0];
  return normalizeWidget({
    id,
    name: template.name,
    templateId: template.id,
    mode: 'visual',
    type: template.type,
    dataSource: template.dataSource,
    action: template.action,
    actionTarget: template.actionTarget || '',
    layout: { x: 0, y: index * 2, w: template.size[0], h: template.size[1] },
    style: {
      background: template.tone[0],
      text: template.tone[1],
      accent: '#7fb59a',
      radius: 16
    },
    code: DEFAULT_WIDGET_CODE
  }, index);
}

function normalizeWidgets(value) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();
  return value.slice(0, 24).map((item, index) => {
    const widget = normalizeWidget(item, index);
    if (usedIds.has(widget.id)) widget.id = `custom-widget-${index + 1}`;
    usedIds.add(widget.id);
    return widget;
  });
}

export function normalizeCustomization(value) {
  const source = objectValue(value);
  const active = objectValue(source.active);
  const checkedCss = validateCustomCss(source.css);
  return {
    version: CUSTOMIZATION_VERSION,
    developerMode: Boolean(source.developerMode),
    active: {
      basic: Boolean(active.basic),
      shell: Boolean(active.shell),
      palette: Boolean(active.palette),
      iconPack: Boolean(active.iconPack),
      desktop: Boolean(active.desktop)
    },
    tokens: normalizeTokens(source.tokens),
    phoneShell: normalizePhoneShell(source.phoneShell),
    desktop: normalizeDesktop(source.desktop),
    iconPack: normalizeIconPack(source.iconPack),
    appThemes: normalizeAppThemes(source.appThemes),
    css: checkedCss.css,
    widgets: normalizeWidgets(source.widgets),
    activePackageIds: Array.isArray(source.activePackageIds)
      ? [...new Set(source.activePackageIds.map(id => idValue(id)).filter(Boolean))].slice(0, 30)
      : []
  };
}

export function cloneCustomization(value = DEFAULT_CUSTOMIZATION) {
  return clone(normalizeCustomization(value));
}
