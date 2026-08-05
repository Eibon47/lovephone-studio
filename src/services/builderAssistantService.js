import { cloneConfig } from '../config/defaultConfig.js';
import { getEnabledApps } from '../system/appRegistry.js';
import { WIDGET_CATALOG, WIDGET_IDS } from '../system/widgetCatalog.js';
import {
  CUSTOM_WIDGET_TEMPLATES,
  createCustomWidgetFromTemplate,
  normalizeCustomization
} from './customizationModel.js';

const APP_IDS = new Set(['character', 'chat', 'memory', 'music', 'diary', 'anniversary', 'goodnight', 'settings']);
const APP_THEMES = new Set(['lovephone', 'wechat', 'qq', 'instagram', 'x']);
const FONT_STYLES = new Set(['wenkai', 'clean', 'serif']);
const PHONE_FRAMES = new Set(['dark', 'graphite', 'cream', 'midnight']);
const ICON_SETS = new Set(['soft', 'glass', 'sticker', 'mono']);
const WIDGET_STYLES = new Set(['colorful', 'glass', 'minimal']);
const CUSTOM_TEMPLATE_IDS = new Set(CUSTOM_WIDGET_TEMPLATES.map(item => item.id));
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_OPERATIONS = 12;

const TOOL_NAMES = {
  setPhoneStyle: '调整整机外观',
  setAppStyle: '调整 App 外观',
  addWidget: '添加小组件',
  removeWidget: '移除小组件',
  moveWidget: '移动小组件',
  openPreview: '切换右侧预览'
};

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, max = 80) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanColor(value) {
  const color = cleanText(value, 7);
  return HEX_COLOR.test(color) ? color.toLowerCase() : '';
}

function numberInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
}

function layoutFrom(value = {}) {
  if (!isObject(value)) return null;
  const x = numberInRange(value.x, 0, 5);
  const y = numberInRange(value.y, 0, 100);
  const w = numberInRange(value.w, 1, 6);
  const h = numberInRange(value.h, 1, 6);
  if ([x, y, w, h].some(item => item === null)) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

function safeAppStyle(values = {}) {
  if (!isObject(values)) return null;
  const result = {};
  if (APP_THEMES.has(values.uiTheme)) result.uiTheme = values.uiTheme;
  const variables = {};
  ['background', 'surface', 'text', 'accent'].forEach(key => {
    const color = cleanColor(values[key]);
    if (color) variables[key] = color;
  });
  if (Object.keys(variables).length) result.variables = variables;
  return Object.keys(result).length ? result : null;
}

export function createBuilderAssistantContext(config, phone = {}) {
  const customization = config.theme?.customization || {};
  return {
    currentPreview: APP_IDS.has(phone.currentApp) ? phone.currentApp : 'home',
    enabledApps: getEnabledApps(config).map(app => ({ id: app.id, name: app.name })),
    phone: {
      fontStyle: config.theme?.fontStyle,
      phoneFrame: config.theme?.phoneFrame,
      iconSet: config.theme?.iconSet,
      widgetStyle: config.theme?.widgetStyle,
      colors: {
        primary: config.theme?.primaryColor,
        background: customization.tokens?.background,
        surface: customization.tokens?.surface,
        text: customization.tokens?.text,
        accent: customization.tokens?.accent
      }
    },
    appLooks: Object.fromEntries(
      Object.entries(config.theme?.appLooks || {}).map(([appId, look]) => [appId, {
        uiTheme: look?.uiTheme || 'lovephone',
        hasCustomIcon: Boolean(look?.icon?.value)
      }])
    ),
    builtinWidgets: WIDGET_CATALOG.map(widget => ({
      id: widget.id,
      name: widget.name,
      enabled: Boolean(config.theme?.widgets?.[widget.id]?.enabled),
      layout: config.theme?.widgets?.[widget.id]?.layout || null
    })),
    customWidgetTemplates: CUSTOM_WIDGET_TEMPLATES.map(template => ({ id: template.id, name: template.name })),
    customWidgets: (customization.widgets || []).map(widget => ({
      id: widget.id,
      name: widget.name,
      templateId: widget.templateId,
      enabled: Boolean(widget.enabled),
      layout: widget.layout
    }))
  };
}

export function buildBuilderAssistantSystemPrompt(context) {
  return `你是 LovePhone Studio 的 AI 美化助手。你只能帮助用户美化小手机和管理桌面小组件，不处理角色资料、聊天内容、记忆、API Key、文件、网络链接或任意代码。\n\n你必须只输出一个 JSON 对象，不要 Markdown，不要解释 JSON 以外的内容。格式：\n{"reply":"给用户看的简短中文说明","operations":[{"tool":"setPhoneStyle","args":{}}]}\n\n允许工具：\n1. setPhoneStyle args 可用：primaryColor、background、surface、text、accent（#RRGGBB）、fontStyle（wenkai/clean/serif）、phoneFrame（dark/graphite/cream/midnight）、iconSet（soft/glass/sticker/mono）、widgetStyle（colorful/glass/minimal）、radius（0-32）、shadow（0-40）、iconSize（36-72）。\n2. setAppStyle args：appId（已启用 App），values 可用 uiTheme（lovephone/wechat/qq/instagram/x）与 background/surface/text/accent（#RRGGBB）。\n3. addWidget args：kind（builtin 或 custom），id（上下文中的组件或模板 id）。\n4. removeWidget args：kind（builtin 或 custom），id（上下文中的组件 id）。\n5. moveWidget args：kind（builtin 或 custom），id，layout（x 0-5,y 0-100,w 1-6,h 1-6）。\n6. openPreview args：appId（home 或已启用 App）。\n\n每次最多 ${MAX_OPERATIONS} 个操作。用户需要上传图片、导入资源、写 CSS/JS 时，说明这需要在现有编辑器中手动完成，operations 留空。\n\n当前小手机的安全摘要：\n${JSON.stringify(context)}`;
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return isObject(parsed) ? parsed : null;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      return isObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export function validateBuilderAssistantOperation(operation, config) {
  if (!isObject(operation) || typeof operation.tool !== 'string' || !isObject(operation.args)) return null;
  const { tool, args } = operation;

  if (tool === 'setPhoneStyle') {
    const values = {};
    ['primaryColor', 'background', 'surface', 'text', 'accent'].forEach(key => {
      const color = cleanColor(args[key]);
      if (color) values[key] = color;
    });
    if (FONT_STYLES.has(args.fontStyle)) values.fontStyle = args.fontStyle;
    if (PHONE_FRAMES.has(args.phoneFrame)) values.phoneFrame = args.phoneFrame;
    if (ICON_SETS.has(args.iconSet)) values.iconSet = args.iconSet;
    if (WIDGET_STYLES.has(args.widgetStyle)) values.widgetStyle = args.widgetStyle;
    const radius = numberInRange(args.radius, 0, 32);
    const shadow = numberInRange(args.shadow, 0, 40);
    const iconSize = numberInRange(args.iconSize, 36, 72);
    if (radius !== null) values.radius = radius;
    if (shadow !== null) values.shadow = shadow;
    if (iconSize !== null) values.iconSize = iconSize;
    return Object.keys(values).length ? { tool, args: values } : null;
  }

  if (tool === 'setAppStyle') {
    const appId = cleanText(args.appId, 32);
    if (!APP_IDS.has(appId) || !config.apps?.[appId]?.enabled) return null;
    const values = safeAppStyle(args.values);
    return values ? { tool, args: { appId, values } } : null;
  }

  if (tool === 'addWidget') {
    const kind = args.kind === 'custom' ? 'custom' : args.kind === 'builtin' ? 'builtin' : '';
    const id = cleanText(args.id, 80);
    const valid = kind === 'builtin' ? WIDGET_IDS.includes(id) : CUSTOM_TEMPLATE_IDS.has(id);
    return valid ? { tool, args: { kind, id } } : null;
  }

  if (tool === 'removeWidget') {
    const kind = args.kind === 'custom' ? 'custom' : args.kind === 'builtin' ? 'builtin' : '';
    const id = cleanText(args.id, 80);
    const exists = kind === 'builtin'
      ? WIDGET_IDS.includes(id)
      : (config.theme?.customization?.widgets || []).some(widget => widget.id === id);
    return kind && exists ? { tool, args: { kind, id } } : null;
  }

  if (tool === 'moveWidget') {
    const kind = args.kind === 'custom' ? 'custom' : args.kind === 'builtin' ? 'builtin' : '';
    const id = cleanText(args.id, 80);
    const layout = layoutFrom(args.layout);
    const exists = kind === 'builtin'
      ? WIDGET_IDS.includes(id)
      : (config.theme?.customization?.widgets || []).some(widget => widget.id === id);
    return kind && exists && layout ? { tool, args: { kind, id, layout } } : null;
  }

  if (tool === 'openPreview') {
    const appId = cleanText(args.appId, 32);
    return appId === 'home' || (APP_IDS.has(appId) && config.apps?.[appId]?.enabled)
      ? { tool, args: { appId } }
      : null;
  }

  return null;
}

export function parseBuilderAssistantResponse(text, config) {
  const parsed = parseJsonObject(text);
  if (!parsed) {
    return {
      reply: '我没有收到可安全执行的美化方案。请换一种描述，例如“做成深色玻璃风，并加一个时钟组件”。',
      operations: []
    };
  }
  const operations = Array.isArray(parsed.operations)
    ? parsed.operations.slice(0, MAX_OPERATIONS)
      .map(operation => validateBuilderAssistantOperation(operation, config))
      .filter(Boolean)
    : [];
  return {
    reply: cleanText(parsed.reply, 500) || (operations.length ? '我准备好了这组预览修改。' : '这次不需要改动现有配置。'),
    operations
  };
}

export function applyBuilderAssistantOperations(config, operations = []) {
  const next = cloneConfig(config);
  const accepted = [];
  let previewAppId = null;

  operations.forEach(operation => {
    const safe = validateBuilderAssistantOperation(operation, next);
    if (!safe) return;
    const { tool, args } = safe;

    if (tool === 'setPhoneStyle') {
      if (args.primaryColor) next.theme.primaryColor = args.primaryColor;
      if (args.background) next.theme.customization.tokens.background = args.background;
      if (args.surface) next.theme.customization.tokens.surface = args.surface;
      if (args.text) next.theme.customization.tokens.text = args.text;
      if (args.accent) next.theme.customization.tokens.accent = args.accent;
      if (args.fontStyle) next.theme.fontStyle = args.fontStyle;
      if (args.phoneFrame) next.theme.phoneFrame = args.phoneFrame;
      if (args.iconSet) next.theme.iconSet = args.iconSet;
      if (args.widgetStyle) next.theme.widgetStyle = args.widgetStyle;
      if (args.radius !== undefined) next.theme.customization.tokens.radius = args.radius;
      if (args.shadow !== undefined) next.theme.customization.tokens.shadow = args.shadow;
      if (args.iconSize !== undefined) next.theme.customization.desktop.iconSize = args.iconSize;
    }

    if (tool === 'setAppStyle') {
      const look = next.theme.appLooks[args.appId] || {};
      next.theme.appLooks[args.appId] = { ...look, ...(args.values.uiTheme ? { uiTheme: args.values.uiTheme } : {}) };
      if (args.values.variables) {
        const current = next.theme.customization.appThemes[args.appId] || {};
        next.theme.customization.appThemes[args.appId] = {
          ...current,
          enabled: true,
          variables: { ...(current.variables || {}), ...args.values.variables }
        };
      }
    }

    if (tool === 'addWidget') {
      if (args.kind === 'builtin') next.theme.widgets[args.id].enabled = true;
      if (args.kind === 'custom') {
        const widgets = next.theme.customization.widgets;
        if (widgets.length < 24) widgets.push(createCustomWidgetFromTemplate(args.id, widgets.length));
      }
    }

    if (tool === 'removeWidget') {
      if (args.kind === 'builtin') next.theme.widgets[args.id].enabled = false;
      if (args.kind === 'custom') {
        next.theme.customization.widgets = next.theme.customization.widgets.filter(widget => widget.id !== args.id);
      }
    }

    if (tool === 'moveWidget') {
      if (args.kind === 'builtin') next.theme.widgets[args.id].layout = args.layout;
      if (args.kind === 'custom') {
        const widget = next.theme.customization.widgets.find(item => item.id === args.id);
        if (widget) widget.layout = args.layout;
      }
    }

    if (tool === 'openPreview') previewAppId = args.appId;
    accepted.push(safe);
  });

  next.theme.customization = normalizeCustomization(next.theme.customization);
  return { config: next, operations: accepted, previewAppId };
}

export function describeBuilderAssistantOperation(operation) {
  const safe = operation && typeof operation === 'object' ? operation : {};
  const args = safe.args || {};
  if (safe.tool === 'setPhoneStyle') return `${TOOL_NAMES[safe.tool]}：${Object.keys(args).join('、')}`;
  if (safe.tool === 'setAppStyle') return `${TOOL_NAMES[safe.tool]}：${args.appId}`;
  if (safe.tool === 'addWidget') return `${TOOL_NAMES[safe.tool]}：${args.id}`;
  if (safe.tool === 'removeWidget') return `${TOOL_NAMES[safe.tool]}：${args.id}`;
  if (safe.tool === 'moveWidget') return `${TOOL_NAMES[safe.tool]}：${args.id}`;
  if (safe.tool === 'openPreview') return `${TOOL_NAMES[safe.tool]}：${args.appId}`;
  return '已准备一项修改';
}
