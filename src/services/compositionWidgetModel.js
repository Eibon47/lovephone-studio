const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/;

export const COMPOSITION_ELEMENT_TYPES = [
  'text', 'image', 'shape', 'button', 'progress', 'musicControl', 'group'
];

export const COMPOSITION_DATA_FIELDS = {
  static: ['text', 'image', 'value'],
  time: ['primary', 'secondary', 'progress'],
  date: ['primary', 'secondary', 'progress'],
  weather: ['primary', 'secondary', 'progress'],
  activeCharacter: ['primary', 'secondary', 'image', 'progress'],
  music: ['primary', 'secondary', 'image', 'progress', 'playing'],
  anniversary: ['primary', 'secondary', 'progress'],
  diary: ['primary', 'secondary', 'progress'],
  memory: ['primary', 'secondary', 'progress'],
  mood: ['primary', 'secondary', 'progress']
};

export const COMPOSITION_ACTIONS = [
  'none', 'openApp', 'openChat', 'openAnniversary', 'createDiary', 'switchCharacter',
  'musicPlayPause', 'musicPrevious', 'musicNext'
];

const TYPE_DEFAULTS = {
  text: { content: '双击编辑文字', fontSize: 54, fontWeight: 600, color: '#183629', background: 'transparent' },
  image: { content: '', fontSize: 20, fontWeight: 400, color: '#183629', background: '#eef3ec' },
  shape: { content: '', fontSize: 20, fontWeight: 400, color: '#183629', background: '#d8eadf' },
  button: { content: '按钮', fontSize: 36, fontWeight: 600, color: '#ffffff', background: '#7fb59a' },
  progress: { content: '', fontSize: 20, fontWeight: 400, color: '#183629', background: '#dfe8e1' },
  musicControl: { content: '▶', fontSize: 44, fontWeight: 700, color: '#ffffff', background: '#222629' },
  group: { content: '', fontSize: 20, fontWeight: 400, color: '#183629', background: 'transparent' }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, fallback = '', max = 160) {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function id(value, fallback) {
  const next = text(value, fallback, 80).trim();
  return SAFE_ID.test(next) ? next : fallback;
}

function color(value, fallback) {
  const next = String(value || '');
  return /^#[0-9a-f]{6}$/i.test(next) || next === 'transparent' ? next.toLowerCase() : fallback;
}

function image(value) {
  const next = String(value || '').trim();
  return IMAGE_DATA_URL.test(next) ? next : '';
}

function frame(value = {}, fallback = {}) {
  const source = objectValue(value);
  return {
    x: Math.round(number(source.x, fallback.x ?? 80, -1000, 2000)),
    y: Math.round(number(source.y, fallback.y ?? 80, -1000, 2000)),
    w: Math.round(number(source.w, fallback.w ?? 360, 20, 2000)),
    h: Math.round(number(source.h, fallback.h ?? 220, 20, 2000)),
    rotation: number(source.rotation, fallback.rotation ?? 0, -180, 180),
    zIndex: Math.round(number(source.zIndex, fallback.zIndex ?? 1, 0, 200))
  };
}

export function normalizeCompositionElement(value, index = 0) {
  const source = objectValue(value);
  const type = COMPOSITION_ELEMENT_TYPES.includes(source.type) ? source.type : 'text';
  const defaults = TYPE_DEFAULTS[type];
  const binding = objectValue(source.binding);
  const action = objectValue(source.action);
  const style = objectValue(source.style);
  const sourceName = Object.hasOwn(COMPOSITION_DATA_FIELDS, binding.source) ? binding.source : 'static';
  const fields = COMPOSITION_DATA_FIELDS[sourceName];
  return {
    id: id(source.id, `element-${index + 1}`),
    type,
    name: text(source.name, type === 'group' ? '分组' : `元素 ${index + 1}`, 60),
    parentId: id(source.parentId, ''),
    locked: Boolean(source.locked),
    hidden: Boolean(source.hidden),
    frame: frame(source.frame, { x: 80 + (index % 4) * 36, y: 80 + (index % 5) * 36, zIndex: index + 1 }),
    content: text(source.content, defaults.content, 500),
    asset: image(source.asset),
    binding: {
      source: sourceName,
      field: fields.includes(binding.field) ? binding.field : fields[0]
    },
    action: {
      type: COMPOSITION_ACTIONS.includes(action.type) ? action.type : 'none',
      target: id(action.target, '')
    },
    style: {
      color: color(style.color, defaults.color),
      background: color(style.background, defaults.background),
      borderColor: color(style.borderColor, '#ffffff'),
      borderWidth: number(style.borderWidth, 0, 0, 20),
      radius: number(style.radius, type === 'image' ? 24 : 12, 0, 500),
      opacity: number(style.opacity, 100, 0, 100),
      shadow: number(style.shadow, 0, 0, 80),
      fontSize: number(style.fontSize, defaults.fontSize, 8, 220),
      fontWeight: Math.round(number(style.fontWeight, defaults.fontWeight, 100, 900) / 100) * 100,
      lineHeight: number(style.lineHeight, 1.25, 0.8, 3),
      textAlign: ['left', 'center', 'right'].includes(style.textAlign) ? style.textAlign : 'center',
      objectFit: ['cover', 'contain', 'fill'].includes(style.objectFit) ? style.objectFit : 'cover',
      shape: ['rectangle', 'circle', 'line'].includes(style.shape) ? style.shape : 'rectangle'
    }
  };
}

export function normalizeCompositionWidget(value, index = 0) {
  const source = objectValue(value);
  const layout = objectValue(source.layout);
  const canvas = objectValue(source.canvas);
  const usedIds = new Set();
  let imageCount = 0;
  const elements = (Array.isArray(source.elements) ? source.elements : [])
    .slice(0, 40)
    .map((item, elementIndex) => {
      const normalized = normalizeCompositionElement(item, elementIndex);
      if (usedIds.has(normalized.id)) normalized.id = `element-${elementIndex + 1}`;
      usedIds.add(normalized.id);
      return normalized;
    })
    .filter(element => element.type !== 'image' || ++imageCount <= 8);
  const validIds = new Set(elements.map(item => item.id));
  elements.forEach(item => {
    if (!validIds.has(item.parentId) || item.parentId === item.id) item.parentId = '';
  });
  const dataPermissions = [...new Set(elements.map(item => item.binding.source).filter(item => item !== 'static'))];
  const actionPermissions = [...new Set(elements.map(item => item.action.type).filter(item => item !== 'none'))];
  const gridWidth = Math.round(number(layout.w, 6, 2, 12));
  const savedHeight = Math.round(number(layout.h, 9, 2, 24));
  const collapsedPhotoLayout = savedHeight === 2
    && Number(layout.y) >= 36
    && elements.filter(element => element.type === 'image').length >= 2;
  const gridHeight = collapsedPhotoLayout
    ? Math.min(24, Math.max(8, Math.round(gridWidth * 1.15)))
    : savedHeight;
  return {
    id: id(source.id, `composition-widget-${index + 1}`),
    kind: 'composition',
    gridVersion: 12,
    mode: 'visual',
    enabled: source.enabled !== false,
    name: text(source.name, `自由组件 ${index + 1}`, 60),
    templateId: id(source.templateId, 'free'),
    layout: {
      x: Math.round(number(layout.x, 0, 0, 12 - gridWidth)),
      y: Math.round(number(layout.y, Math.min(index * 6, 96 - gridHeight), 0, 96 - gridHeight)),
      w: gridWidth,
      h: gridHeight
    },
    canvas: {
      background: color(canvas.background, '#fffdf6'),
      radius: number(canvas.radius, 20, 0, 160),
      opacity: number(canvas.opacity, 100, 0, 100),
      overflow: canvas.overflow === 'visible' ? 'visible' : 'hidden'
    },
    elements,
    permissions: { data: dataPermissions, actions: actionPermissions }
  };
}

function element(type, name, x, y, w, h, options = {}) {
  return {
    id: options.id || `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type, name, frame: { x, y, w, h, rotation: options.rotation || 0, zIndex: options.zIndex || 1 },
    content: options.content || '', asset: options.asset || '',
    binding: options.binding || { source: 'static', field: type === 'image' ? 'image' : 'text' },
    action: options.action || { type: 'none', target: '' }, style: options.style || {}
  };
}

const template = (idValue, name, size, canvas, elements) => ({ id: idValue, name, size, canvas, elements });

export const COMPOSITION_WIDGET_TEMPLATES = [
  template('free', '空白画布', [6, 9], { background: '#fffdf6', radius: 20 }, []),
  template('photo-row', '双图横排', [12, 9], { background: '#fffdf6', radius: 20 }, [
    element('image', '照片 1', 40, 80, 440, 760, { id: 'photo-1', zIndex: 1 }),
    element('image', '照片 2', 520, 80, 440, 760, { id: 'photo-2', zIndex: 2 })
  ]),
  template('photo-column', '双图竖排', [6, 14], { background: '#fffdf6', radius: 20 }, [
    element('image', '照片 1', 80, 40, 840, 430, { id: 'photo-1' }),
    element('image', '照片 2', 80, 530, 840, 430, { id: 'photo-2', zIndex: 2 })
  ]),
  template('photo-collage', '错位拼贴', [8, 11], { background: '#f6eee8', radius: 28 }, [
    element('image', '主照片', 70, 90, 570, 700, { id: 'photo-main', rotation: -4 }),
    element('image', '叠放照片', 510, 300, 410, 560, { id: 'photo-side', rotation: 7, zIndex: 2 })
  ]),
  template('photo-three', '三图相册', [12, 9], { background: '#fffdf6', radius: 20 }, [
    element('image', '照片 1', 30, 80, 300, 760, { id: 'photo-1' }),
    element('image', '照片 2', 350, 80, 300, 760, { id: 'photo-2', zIndex: 2 }),
    element('image', '照片 3', 670, 80, 300, 760, { id: 'photo-3', zIndex: 3 })
  ]),
  template('text-columns', '三列文字', [12, 6], { background: '#eef4ee', radius: 20 }, [
    element('text', '文字 1', 30, 160, 300, 680, { id: 'text-1', content: '第一行', style: { fontSize: 52 } }),
    element('text', '文字 2', 350, 160, 300, 680, { id: 'text-2', content: '第二行', style: { fontSize: 52 } }),
    element('text', '文字 3', 670, 160, 300, 680, { id: 'text-3', content: '第三行', style: { fontSize: 52 } })
  ]),
  template('quote', '语录排版', [12, 7], { background: '#fff1c9', radius: 24 }, [
    element('text', '引号', 40, 80, 130, 220, { id: 'quote-mark', content: '“', style: { fontSize: 140, color: '#c5a45e' } }),
    element('text', '正文', 150, 160, 790, 480, { id: 'quote-text', content: '今天也会好好陪着你。', style: { fontSize: 48, textAlign: 'left' } }),
    element('text', '署名', 650, 700, 290, 130, { id: 'quote-author', content: '来自角色', style: { fontSize: 30, color: '#725f3e' } })
  ]),
  template('music-player', '完整唱片机', [12, 9], { background: '#25282b', radius: 24 }, [
    element('image', '专辑封面', 60, 100, 400, 650, { id: 'music-cover', binding: { source: 'music', field: 'image' }, style: { radius: 500 } }),
    element('text', '歌曲名', 500, 180, 440, 150, { id: 'music-title', binding: { source: 'music', field: 'primary' }, style: { color: '#ffffff', fontSize: 52, textAlign: 'left' } }),
    element('text', '歌手', 500, 330, 440, 100, { id: 'music-artist', binding: { source: 'music', field: 'secondary' }, style: { color: '#c8ceca', fontSize: 32, textAlign: 'left' } }),
    element('musicControl', '上一首', 520, 540, 110, 150, { id: 'music-prev', content: '‹', action: { type: 'musicPrevious', target: '' } }),
    element('musicControl', '播放暂停', 675, 510, 150, 210, { id: 'music-toggle', content: '▶', action: { type: 'musicPlayPause', target: '' } }),
    element('musicControl', '下一首', 870, 540, 90, 150, { id: 'music-next', content: '›', action: { type: 'musicNext', target: '' } }),
    element('progress', '播放进度', 500, 770, 440, 48, { id: 'music-progress', binding: { source: 'music', field: 'progress' }, style: { background: '#555b5e', color: '#ffffff' } })
  ]),
  template('music-mini', '迷你播放器', [12, 5], { background: '#25282b', radius: 24 }, [
    element('image', '封面', 40, 100, 220, 650, { id: 'cover', binding: { source: 'music', field: 'image' }, style: { radius: 28 } }),
    element('text', '歌曲名', 300, 180, 430, 220, { id: 'title', binding: { source: 'music', field: 'primary' }, style: { color: '#ffffff', fontSize: 58, textAlign: 'left' } }),
    element('musicControl', '播放暂停', 790, 190, 160, 420, { id: 'play', content: '▶', action: { type: 'musicPlayPause', target: '' } })
  ]),
  template('clock', '时间与日期', [12, 6], { background: '#cfe7da', radius: 22 }, [
    element('text', '时间', 50, 90, 500, 440, { id: 'clock-time', binding: { source: 'time', field: 'primary' }, style: { fontSize: 130, textAlign: 'left' } }),
    element('text', '日期', 50, 580, 500, 170, { id: 'clock-date', binding: { source: 'date', field: 'primary' }, style: { fontSize: 42, textAlign: 'left' } }),
    element('text', '短句', 580, 300, 370, 250, { id: 'clock-note', content: '保持一点点靠近', style: { fontSize: 38 } })
  ]),
  template('weather', '天气卡片', [6, 8], { background: '#dcecf5', radius: 24 }, [
    element('text', '温度', 80, 160, 840, 360, { id: 'weather-temp', binding: { source: 'weather', field: 'primary' }, style: { fontSize: 150 } }),
    element('text', '天气', 80, 570, 840, 220, { id: 'weather-detail', binding: { source: 'weather', field: 'secondary' }, style: { fontSize: 42 } })
  ]),
  template('anniversary', '纪念日', [6, 8], { background: '#f8e8e8', radius: 24 }, [
    element('text', '纪念日名称', 80, 140, 840, 220, { id: 'anniversary-title', binding: { source: 'anniversary', field: 'primary' }, style: { fontSize: 48 } }),
    element('text', '天数', 80, 420, 840, 300, { id: 'anniversary-days', binding: { source: 'anniversary', field: 'secondary' }, style: { fontSize: 100 } })
  ]),
  template('character', '角色状态', [12, 6], { background: '#f3e8f5', radius: 24 }, [
    element('image', '角色头像', 50, 140, 280, 560, { id: 'character-avatar', binding: { source: 'activeCharacter', field: 'image' }, style: { radius: 500 } }),
    element('text', '角色名', 380, 170, 540, 220, { id: 'character-name', binding: { source: 'activeCharacter', field: 'primary' }, style: { fontSize: 68, textAlign: 'left' } }),
    element('text', '角色状态', 380, 440, 540, 180, { id: 'character-status', binding: { source: 'activeCharacter', field: 'secondary' }, style: { fontSize: 36, textAlign: 'left' } })
  ]),
  template('actions', '快捷按钮', [12, 6], { background: '#edf1f5', radius: 24 }, [
    element('button', '聊天', 40, 180, 280, 520, { id: 'action-chat', content: '聊天', action: { type: 'openApp', target: 'chat' } }),
    element('button', '日记', 360, 180, 280, 520, { id: 'action-diary', content: '日记', action: { type: 'openApp', target: 'diary' } }),
    element('button', '音乐', 680, 180, 280, 520, { id: 'action-music', content: '音乐', action: { type: 'openApp', target: 'music' } })
  ])
];

export function createCompositionWidget(templateId = 'free', index = 0, widgetId = '') {
  const source = COMPOSITION_WIDGET_TEMPLATES.find(item => item.id === templateId)
    || COMPOSITION_WIDGET_TEMPLATES[0];
  return normalizeCompositionWidget({
    id: widgetId || `composition-${Date.now()}-${index}`,
    name: source.name,
    templateId: source.id,
    enabled: true,
    layout: { x: 0, y: index * 6, w: source.size[0], h: source.size[1] },
    canvas: source.canvas,
    elements: clone(source.elements)
  }, index);
}

const LEGACY_TEMPLATE_MAP = {
  clock: 'clock', weather: 'weather', vinyl: 'music-player', photo: 'photo-collage',
  calendar: 'clock', anniversary: 'anniversary', characterStatus: 'character',
  mood: 'weather', quickActions: 'actions'
};

export function migrateLegacyBuiltinWidgets(theme, widgets = []) {
  const next = [...widgets];
  const existing = new Set(next.map(item => item.id));
  Object.entries(theme?.widgets || {}).forEach(([legacyId, legacy]) => {
    if (!legacy?.enabled || !LEGACY_TEMPLATE_MAP[legacyId]) return;
    const widgetId = `builtin-${legacyId}`;
    if (existing.has(widgetId)) return;
    const created = createCompositionWidget(LEGACY_TEMPLATE_MAP[legacyId], next.length, widgetId);
    const old = objectValue(legacy.layout);
    created.layout = {
      x: Math.min(11, Math.max(0, Math.round((Number(old.x) || 0) * 3))),
      y: Math.max(0, Math.round((Number(old.y) || 0) * 3)),
      w: Math.min(12, Math.max(2, Math.round((Number(old.w) || 2) * 3))),
      h: Math.min(36, Math.max(2, Math.round((Number(old.h) || 2) * 3)))
    };
    if (legacyId === 'photo' && legacy.image) {
      const photo = created.elements.find(item => item.type === 'image');
      if (photo) photo.asset = image(legacy.image);
    }
    if (legacyId === 'vinyl' && legacy.image) {
      const cover = created.elements.find(item => item.binding?.field === 'image');
      if (cover) cover.asset = image(legacy.image);
    }
    if (legacyId === 'clock' && legacy.subtitle) {
      const note = created.elements.find(item => item.id === 'clock-note');
      if (note) note.content = text(legacy.subtitle, note.content, 500);
    }
    next.push(normalizeCompositionWidget(created, next.length));
    existing.add(widgetId);
  });
  return next;
}

export function createCompositionElement(type, index = 0) {
  const safeType = COMPOSITION_ELEMENT_TYPES.includes(type) && type !== 'group' ? type : 'text';
  return normalizeCompositionElement({
    id: `${safeType}-${Date.now()}-${index}`,
    type: safeType,
    name: TYPE_DEFAULTS[safeType].content || safeType,
    frame: { x: 180 + (index % 4) * 30, y: 180 + (index % 5) * 30, w: 420, h: safeType === 'text' ? 180 : 360, zIndex: index + 1 },
    action: safeType === 'musicControl' ? { type: 'musicPlayPause', target: '' } : { type: 'none', target: '' }
  }, index);
}

export function compositionSelectionBounds(elements, selectedIds) {
  const selected = elements.filter(item => selectedIds.includes(item.id) && item.type !== 'group');
  if (!selected.length) return null;
  const left = Math.min(...selected.map(item => item.frame.x));
  const top = Math.min(...selected.map(item => item.frame.y));
  const right = Math.max(...selected.map(item => item.frame.x + item.frame.w));
  const bottom = Math.max(...selected.map(item => item.frame.y + item.frame.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
