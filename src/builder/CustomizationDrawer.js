import { escapeHtml } from '../system/html.js';
import {
  CUSTOM_WIDGET_ACTIONS,
  CUSTOM_WIDGET_SOURCES,
  CUSTOM_WIDGET_TEMPLATES,
  CUSTOM_WIDGET_TYPES,
  normalizeCharacterAppearance,
  normalizeChatAppearance,
  normalizeCompanionAppearance,
  normalizeMemoryAppearance,
  normalizeMusicAppearance,
  normalizeAppMedia,
  normalizeSettingsAppearance,
  validateCustomCss,
  validateCustomWidgetCode
} from '../services/customizationModel.js?v=app-config-83';
import { readOptimizedImage, readSquareImage } from '../services/imageUploadService.js?v=app-config-60';
import {
  COMPOSITION_ACTIONS,
  COMPOSITION_DATA_FIELDS,
  COMPOSITION_ELEMENT_TYPES,
  COMPOSITION_WIDGET_TEMPLATES
} from '../services/compositionWidgetModel.js?v=app-config-104';

const TITLES = {
  basic: ['基础样式', '调整字体大小、圆角、边框、阴影和整体透明度。'],
  shell: ['手机壳', '调整手机边框、圆角、灵动岛与底部指示条。'],
  palette: ['配色', '建立整台手机统一使用的语义颜色。'],
  iconPack: ['图标套装', '批量设置整机图标；App 美化中单独上传的图标会优先显示。'],
  desktop: ['桌面布局', '调整桌面列数、间距、图标、文字和 Dock。'],
  widgets: ['自定义小组件', '使用允许的数据源和动作组合新组件，不运行外部代码。'],
  app: ['App 界面主题', '调整当前 App 的图标、变量和限定作用域 CSS。'],
  packages: ['主题包', '导入、预检或导出不依赖外部网络的 ZIP 主题包。']
};

const SOURCE_LABELS = {
  static: '静态内容',
  time: '当前时间',
  date: '当前日期',
  weather: '天气',
  activeCharacter: '当前角色',
  music: '正在播放',
  anniversary: '纪念日',
  diary: '最近日记',
  memory: '记忆数量',
  mood: '心情'
};

const ACTION_LABELS = {
  none: '无动作',
  openApp: '打开指定 App',
  musicPlayPause: '播放 / 暂停',
  musicPrevious: '上一首',
  musicNext: '下一首',
  switchCharacter: '切换角色',
  createDiary: '写日记',
  openChat: '打开聊天',
  openAnniversary: '打开纪念日'
};

function field(label, path, value, type = 'number', options = {}) {
  const min = options.min ?? '';
  const max = options.max ?? '';
  const step = options.step ?? 1;
  return `
    <label class="custom-field">
      <span>${label}${options.unit ? `<small>${options.unit}</small>` : ''}</span>
      <input
        type="${type}"
        value="${escapeHtml(value)}"
        ${type === 'number' || type === 'range' ? `min="${min}" max="${max}" step="${step}"` : ''}
        data-custom-${type === 'color' ? 'color' : type === 'text' ? 'value' : 'number'}="${path}"
      />
    </label>
  `;
}

function compositionField(label, path, value, type = 'number', options = {}, elementId = '') {
  const min = options.min ?? '';
  const max = options.max ?? '';
  const step = options.step ?? 1;
  const scope = elementId ? 'element' : 'canvas';
  const attribute = `data-composition-${scope}-${type === 'color' ? 'color' : type === 'text' ? 'value' : 'number'}="${path}"`;
  return `<label class="custom-field"><span>${label}${options.unit ? `<small>${options.unit}</small>` : ''}</span><input type="${type}" value="${escapeHtml(value)}" ${type === 'number' || type === 'range' ? `min="${min}" max="${max}" step="${step}"` : ''} ${attribute} ${elementId ? `data-composition-element-id="${escapeHtml(elementId)}"` : ''}></label>`;
}

function renderBasic(customization) {
  const tokens = customization.tokens;
  return `
    <div class="custom-field-grid">
      ${field('字体大小', 'tokens.fontSize', tokens.fontSize, 'range', { min: 11, max: 20, unit: 'px' })}
      ${field('组件间距', 'tokens.spacing', tokens.spacing, 'range', { min: 2, max: 24, unit: 'px' })}
      ${field('圆角', 'tokens.radius', tokens.radius, 'range', { min: 0, max: 32, unit: 'px' })}
      ${field('边框', 'tokens.borderWidth', tokens.borderWidth, 'range', { min: 0, max: 4, unit: 'px' })}
      ${field('阴影', 'tokens.shadow', tokens.shadow, 'range', { min: 0, max: 40 })}
      ${field('透明度', 'tokens.opacity', tokens.opacity, 'range', { min: 40, max: 100, unit: '%' })}
    </div>
    ${customization.developerMode ? `
      <label class="custom-field custom-field-wide">
        <span>整机限定 CSS <small>仅能影响右侧手机，禁止外链、HTML、@import 和脚本。</small></span>
        <textarea rows="10" spellcheck="false" data-custom-global-css>${escapeHtml(customization.css)}</textarea>
      </label>
      <p class="custom-validation ${validateCustomCss(customization.css).valid ? 'is-valid' : 'is-error'}" data-custom-css-status>
        ${validateCustomCss(customization.css).valid ? 'CSS 安全检查通过' : escapeHtml(validateCustomCss(customization.css).errors[0])}
      </p>
    ` : '<p class="custom-empty">打开右上角“开发者”后可编辑整机限定 CSS。</p>'}
  `;
}

function renderPalette(customization) {
  const tokens = customization.tokens;
  return `
    <div class="custom-color-grid">
      ${field('背景色', 'tokens.background', tokens.background, 'color')}
      ${field('卡片色', 'tokens.surface', tokens.surface, 'color')}
      ${field('文字色', 'tokens.text', tokens.text, 'color')}
      ${field('弱文字', 'tokens.muted', tokens.muted, 'color')}
      ${field('辅助色', 'tokens.secondary', tokens.secondary, 'color')}
      ${field('主色', 'tokens.accent', tokens.accent, 'color')}
      ${field('危险色', 'tokens.danger', tokens.danger, 'color')}
    </div>
  `;
}

function renderShell(customization) {
  const shell = customization.phoneShell;
  return `
    <div class="custom-field-grid">
      ${field('边框颜色', 'phoneShell.frameColor', shell.frameColor, 'color')}
      ${field('边框宽度', 'phoneShell.frameWidth', shell.frameWidth, 'range', { min: 2, max: 18, unit: 'px' })}
      ${field('机身圆角', 'phoneShell.radius', shell.radius, 'range', { min: 24, max: 64, unit: 'px' })}
      ${field('屏幕内缩', 'phoneShell.screenInset', shell.screenInset, 'range', { min: 0, max: 12, unit: 'px' })}
      ${field('灵动岛宽度', 'phoneShell.islandWidth', shell.islandWidth, 'range', { min: 72, max: 170, unit: 'px' })}
      ${field('灵动岛高度', 'phoneShell.islandHeight', shell.islandHeight, 'range', { min: 22, max: 48, unit: 'px' })}
      ${field('底部横条宽度', 'phoneShell.indicatorWidth', shell.indicatorWidth, 'range', { min: 72, max: 180, unit: 'px' })}
    </div>
  `;
}

function renderDesktop(customization) {
  const desktop = customization.desktop;
  return `
    <div class="custom-field-grid">
      ${field('桌面列数', 'desktop.columns', desktop.columns, 'range', { min: 3, max: 6 })}
      ${field('图标间距', 'desktop.gap', desktop.gap, 'range', { min: 2, max: 20, unit: 'px' })}
      ${field('图标大小', 'desktop.iconSize', desktop.iconSize, 'range', { min: 36, max: 72, unit: 'px' })}
      ${field('名称大小', 'desktop.labelSize', desktop.labelSize, 'range', { min: 10, max: 16, unit: 'px' })}
      ${field('Dock 透明度', 'desktop.dockOpacity', desktop.dockOpacity, 'range', { min: 30, max: 100, unit: '%' })}
    </div>
  `;
}

function renderIconPack(customization, apps) {
  return `
    <label class="custom-field custom-field-wide">
      <span>套装名称</span>
      <input type="text" value="${escapeHtml(customization.iconPack.name)}" data-custom-value="iconPack.name" />
    </label>
    <div class="custom-icon-list">
      ${apps.map(app => {
        const icon = customization.iconPack.icons[app.id];
        return `
          <div class="custom-icon-row">
            <span>${icon ? `<img src="${escapeHtml(icon)}" alt="" />` : '<i></i>'}</span>
            <strong>${escapeHtml(app.name)}</strong>
            <label>
              上传
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-custom-icon="${app.id}" />
            </label>
            <button type="button" data-custom-icon-remove="${app.id}" ${icon ? '' : 'disabled'}>移除</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function widgetSelect(label, attribute, values, current, labels = {}) {
  return `
    <label class="custom-field">
      <span>${label}</span>
      <select ${attribute}>
        ${values.map(value => `<option value="${value}" ${current === value ? 'selected' : ''}>${labels[value] || value}</option>`).join('')}
      </select>
    </label>
  `;
}

function checkField(label, description, path, checked) {
  return `
    <label class="custom-check-row">
      <span><strong>${label}</strong><small>${description}</small></span>
      <span class="feature-switch">
        <input type="checkbox" data-custom-check="${path}" ${checked ? 'checked' : ''} />
        <span class="feature-switch-track"></span>
      </span>
    </label>
  `;
}

function selectedWidget(customization, ui) {
  const widgets = customization.widgets || [];
  const index = Math.max(0, Math.min(widgets.length - 1, Number(ui.customWidgetIndex) || 0));
  return { widget: widgets[index], index };
}

function renderWidgetTabs(ui, hasWidget, showCode) {
  const active = ['templates', 'layers', 'style', 'data', 'code'].includes(ui.customWidgetTab)
    ? ui.customWidgetTab
    : 'templates';
  return `
    <nav class="custom-widget-tabs" aria-label="小组件编辑步骤">
      <button class="${active === 'templates' ? 'active' : ''}" type="button" data-custom-widget-tab="templates">模板库</button>
      <button class="${active === 'layers' ? 'active' : ''}" type="button" data-custom-widget-tab="layers" ${hasWidget ? '' : 'disabled'}>图层</button>
      <button class="${active === 'style' ? 'active' : ''}" type="button" data-custom-widget-tab="style" ${hasWidget ? '' : 'disabled'}>属性</button>
      <button class="${active === 'data' ? 'active' : ''}" type="button" data-custom-widget-tab="data" ${hasWidget ? '' : 'disabled'}>数据与动作</button>
      ${showCode ? `<button class="${active === 'code' ? 'active' : ''}" type="button" data-custom-widget-tab="code" ${hasWidget ? '' : 'disabled'}>代码</button>` : ''}
    </nav>
  `;
}

function renderWidgetInstanceList(customization, selectedIndex) {
  if (!customization.widgets.length) return '<p class="custom-empty">还没有自定义组件，请从模板库创建一个。</p>';
  return `
    <div class="custom-widget-instance-list">
      ${customization.widgets.map((widget, index) => `
        <button class="${selectedIndex === index ? 'active' : ''}" type="button" data-custom-widget-select="${index}" data-widget-id="${escapeHtml(widget.id)}">
            <span>${escapeHtml(widget.name)}</span><small>${widget.mode === 'code' ? '代码' : '自由画布'}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderWidgetTemplates(customization) {
  return `
    <div class="custom-widget-template-grid">
      ${COMPOSITION_WIDGET_TEMPLATES.map(template => `
        <button class="custom-widget-template-card template-${template.id}" type="button" data-custom-widget-template="${template.id}">
          <span class="custom-widget-template-demo"><i></i><b>${template.id.startsWith('music') ? '♪' : template.id === 'weather' ? '24°' : template.id === 'clock' ? '09:41' : template.id.startsWith('photo') ? '▧' : '✦'}</b></span>
          <strong>${template.name}</strong>
          <small>${template.elements.length} 个图层 · ${template.size[0]}×${template.size[1]}</small>
        </button>
      `).join('')}
    </div>
    ${customization.widgets.length ? '<p class="custom-widget-template-hint">选择模板会新增一个组件，不会覆盖已有组件。</p>' : ''}
  `;
}

function selectedCompositionElement(widget, ui) {
  if (widget?.kind !== 'composition') return null;
  const ids = ui.widgetEditorElementIds || [];
  return widget.elements.find(element => ids.includes(element.id)) || null;
}

function renderWidgetLayers(customization, ui) {
  const { widget } = selectedWidget(customization, ui);
  if (!widget) return '<p class="custom-empty">请先从模板库创建一个组件。</p>';
  if (widget.kind !== 'composition') return '<p class="custom-empty">代码组件只能编辑外框；打开开发者模式可查看代码。</p>';
  const selectedIds = ui.widgetEditorElementIds || [];
  const typeLabels = { text: '文字', image: '图片', shape: '形状', button: '按钮', progress: '进度条', musicControl: '音乐控件' };
  return `
    <div class="composition-history-bar">
      <button type="button" data-composition-undo title="撤销">↶</button>
      <button type="button" data-composition-redo title="重做">↷</button>
      <span>右侧直接拖动、拉伸或旋转</span>
    </div>
    <div class="composition-add-bar">
      ${COMPOSITION_ELEMENT_TYPES.filter(type => type !== 'group').map(type => `<button type="button" data-composition-add="${type}">${typeLabels[type] || type}</button>`).join('')}
    </div>
    <div class="composition-layer-actions">
      <button type="button" data-composition-duplicate ${selectedIds.length ? '' : 'disabled'}>复制</button>
      <button type="button" data-composition-group ${selectedIds.length > 1 ? '' : 'disabled'}>分组</button>
      <button type="button" data-composition-ungroup ${selectedIds.length ? '' : 'disabled'}>取消分组</button>
      <button type="button" data-composition-remove ${selectedIds.length ? '' : 'disabled'}>删除</button>
    </div>
    <div class="composition-align-bar">
      ${[['left','左对齐'],['center','水平居中'],['right','右对齐'],['top','顶对齐'],['middle','垂直居中'],['bottom','底对齐'],['distributeX','横向均分'],['distributeY','纵向均分'],['front','置顶'],['back','置底']].map(([id,label]) => `<button type="button" data-composition-arrange="${id}" ${selectedIds.length ? '' : 'disabled'}>${label}</button>`).join('')}
    </div>
    <div class="composition-layer-list">
      ${[...widget.elements].sort((a, b) => b.frame.zIndex - a.frame.zIndex).map(element => `
        <button type="button" class="${selectedIds.includes(element.id) ? 'active' : ''}" data-composition-layer="${element.id}">
          <span>${element.hidden ? '◌' : element.locked ? '◇' : '◆'}</span>
          <strong>${escapeHtml(element.name)}</strong>
          <small>${typeLabels[element.type] || '分组'}</small>
        </button>`).join('') || '<p class="custom-empty">这是空白画布，请添加第一个图层。</p>'}
    </div>`;
}

function renderWidgetStyle(customization, ui) {
  const { widget, index } = selectedWidget(customization, ui);
  if (!widget) return '<p class="custom-empty">请先从模板库创建一个组件。</p>';
  if (widget.kind !== 'composition') return renderWidgetCode(customization, ui);
  const element = selectedCompositionElement(widget, ui);
  if (!element) {
    return `
      <div class="custom-widget-editor-toolbar">
        <span><small>组件画布</small><strong>${escapeHtml(widget.name)}</strong></span>
        <button type="button" data-custom-widget-remove="${index}">删除组件</button>
      </div>
      ${field('组件名称', `widgets.${index}.name`, widget.name, 'text')}
      <div class="custom-field-grid">
        ${compositionField('桌面宽度', 'layout.w', widget.layout.w, 'range', { min: 2, max: 12, unit: '格' })}
        ${compositionField('桌面高度', 'layout.h', widget.layout.h, 'range', { min: 2, max: Math.min(24, 96 - widget.layout.y), unit: '格' })}
        ${compositionField('背景色', 'canvas.background', widget.canvas.background, 'color')}
        ${compositionField('圆角', 'canvas.radius', widget.canvas.radius, 'range', { min: 0, max: 160 })}
        ${compositionField('透明度', 'canvas.opacity', widget.canvas.opacity, 'range', { min: 0, max: 100, unit: '%' })}
        ${widgetSelect('边界处理', 'data-composition-canvas-value="canvas.overflow"', ['hidden', 'visible'], widget.canvas.overflow, { hidden: '裁切', visible: '允许溢出' })}
      </div>
      <p class="custom-empty">点击右侧组件中的文字、图片或按钮，可编辑该图层的详细属性。</p>`;
  }
  return `
    <div class="custom-widget-editor-toolbar">
      <span><small>正在编辑图层</small><strong>${escapeHtml(element.name)}</strong></span>
      <button type="button" data-composition-remove>删除</button>
    </div>
    <label class="custom-field"><span>图层名称</span><input type="text" value="${escapeHtml(element.name)}" data-composition-element-value="name" data-composition-element-id="${element.id}" /></label>
    ${['text', 'button', 'musicControl'].includes(element.type) ? `<label class="custom-field"><span>显示文字</span><textarea rows="3" data-composition-element-value="content" data-composition-element-id="${element.id}">${escapeHtml(element.content)}</textarea></label>` : ''}
    <div class="custom-field-grid">
      ${compositionField('X', 'frame.x', element.frame.x, 'number', { min: -1000, max: 2000 }, element.id)}
      ${compositionField('Y', 'frame.y', element.frame.y, 'number', { min: -1000, max: 2000 }, element.id)}
      ${compositionField('宽度', 'frame.w', element.frame.w, 'number', { min: 20, max: 2000 }, element.id)}
      ${compositionField('高度', 'frame.h', element.frame.h, 'number', { min: 20, max: 2000 }, element.id)}
      ${compositionField('旋转', 'frame.rotation', element.frame.rotation, 'range', { min: -180, max: 180, unit: '°' }, element.id)}
      ${compositionField('圆角', 'style.radius', element.style.radius, 'range', { min: 0, max: 500 }, element.id)}
      ${compositionField('透明度', 'style.opacity', element.style.opacity, 'range', { min: 0, max: 100, unit: '%' }, element.id)}
      ${compositionField('阴影', 'style.shadow', element.style.shadow, 'range', { min: 0, max: 80 }, element.id)}
      ${compositionField('文字颜色', 'style.color', element.style.color, 'color', {}, element.id)}
      ${compositionField('背景色', 'style.background', element.style.background === 'transparent' ? '#ffffff' : element.style.background, 'color', {}, element.id)}
      ${compositionField('边框颜色', 'style.borderColor', element.style.borderColor, 'color', {}, element.id)}
      ${compositionField('边框宽度', 'style.borderWidth', element.style.borderWidth, 'range', { min: 0, max: 20 }, element.id)}
      ${['text', 'button', 'musicControl'].includes(element.type) ? compositionField('字号', 'style.fontSize', element.style.fontSize, 'range', { min: 8, max: 220 }, element.id) : ''}
      ${['text', 'button', 'musicControl'].includes(element.type) ? compositionField('字重', 'style.fontWeight', element.style.fontWeight, 'range', { min: 100, max: 900, step: 100 }, element.id) : ''}
      ${['text', 'button'].includes(element.type) ? compositionField('行高', 'style.lineHeight', element.style.lineHeight, 'number', { min: 0.8, max: 3, step: 0.05 }, element.id) : ''}
      ${['text', 'button'].includes(element.type) ? widgetSelect('文字对齐', `data-composition-element-select="style.textAlign" data-composition-element-id="${element.id}"`, ['left', 'center', 'right'], element.style.textAlign, { left: '左对齐', center: '居中', right: '右对齐' }) : ''}
      ${element.type === 'image' ? widgetSelect('图片裁切', `data-composition-element-select="style.objectFit" data-composition-element-id="${element.id}"`, ['cover', 'contain', 'fill'], element.style.objectFit, { cover: '铺满裁切', contain: '完整显示', fill: '拉伸填满' }) : ''}
      ${element.type === 'shape' ? widgetSelect('形状', `data-composition-element-select="style.shape" data-composition-element-id="${element.id}"`, ['rectangle', 'circle', 'line'], element.style.shape, { rectangle: '矩形', circle: '圆形', line: '分割线' }) : ''}
    </div>
    <label class="custom-check-row"><span><strong>透明背景</strong><small>只显示文字、图片或边框</small></span><input type="checkbox" data-composition-background-transparent="${element.id}" ${element.style.background === 'transparent' ? 'checked' : ''}></label>
    <label class="custom-check-row"><span><strong>锁定图层</strong><small>锁定后不能在右侧拖动</small></span><input type="checkbox" data-composition-element-check="locked" data-composition-element-id="${element.id}" ${element.locked ? 'checked' : ''}></label>
    <label class="custom-check-row"><span><strong>隐藏图层</strong><small>保留图层但不在成品显示</small></span><input type="checkbox" data-composition-element-check="hidden" data-composition-element-id="${element.id}" ${element.hidden ? 'checked' : ''}></label>
    ${element.type === 'image' ? `<label class="custom-widget-image-upload">
      <span>${element.asset ? `<img src="${escapeHtml(element.asset)}" alt="" />` : '<i>＋</i>'}</span>
      <strong>${element.asset ? '替换图层图片' : '上传图层图片'}</strong>
      <small>仅保存在本地，自动压缩。</small>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-composition-element-image="${element.id}" />
    </label>` : ''}
  `;
}

function renderWidgetData(customization, ui) {
  const { widget } = selectedWidget(customization, ui);
  const element = selectedCompositionElement(widget, ui);
  if (!widget || widget.kind !== 'composition') return '<p class="custom-empty">请选择一个自由画布组件。</p>';
  if (!element) return '<p class="custom-empty">先在“图层”或右侧手机中选择一个元素，再连接数据与动作。</p>';
  const source = element.binding.source;
  const fields = COMPOSITION_DATA_FIELDS[source] || COMPOSITION_DATA_FIELDS.static;
  return `
    <section class="composition-binding-panel">
      <header><strong>${escapeHtml(element.name)}</strong><small>每个图层可以单独读取数据和执行动作。</small></header>
      ${widgetSelect('数据来源', `data-composition-element-select="binding.source" data-composition-element-id="${element.id}"`, Object.keys(COMPOSITION_DATA_FIELDS), source, SOURCE_LABELS)}
      ${widgetSelect('显示字段', `data-composition-element-select="binding.field" data-composition-element-id="${element.id}"`, fields, element.binding.field, { primary: '主要文字', secondary: '辅助文字', image: '图片', progress: '进度', playing: '播放状态', text: '静态文字', value: '静态数值' })}
      ${widgetSelect('点击动作', `data-composition-element-select="action.type" data-composition-element-id="${element.id}"`, COMPOSITION_ACTIONS, element.action.type, ACTION_LABELS)}
      <label class="custom-field"><span>动作目标 App / 角色 ID</span><input type="text" value="${escapeHtml(element.action.target)}" data-composition-element-value="action.target" data-composition-element-id="${element.id}"></label>
      ${source === 'weather' ? `
        <section class="composition-data-settings">
          <strong>天气位置</strong>
          <label class="custom-field"><span>城市</span><input type="text" value="${escapeHtml(customization.__weather?.city || '')}" data-composition-system-value="theme.widgets.weather.city"></label>
          <div class="custom-field-grid">
            <label class="custom-field"><span>纬度</span><input type="number" step="0.0001" value="${Number(customization.__weather?.latitude || 0)}" data-composition-system-number="theme.widgets.weather.latitude"></label>
            <label class="custom-field"><span>经度</span><input type="number" step="0.0001" value="${Number(customization.__weather?.longitude || 0)}" data-composition-system-number="theme.widgets.weather.longitude"></label>
          </div>
        </section>` : ''}
      <p class="custom-empty">当前组件需要的数据权限和动作权限会根据图层绑定自动计算，撤销绑定后立即停止访问。</p>
    </section>`;
}

function permissionChecks(values, selected, category) {
  return values.map(value => `
    <label class="custom-code-permission">
      <input type="checkbox" value="${value}" data-custom-widget-permission="${category}" ${selected.includes(value) ? 'checked' : ''} />
      <span>${category === 'data' ? SOURCE_LABELS[value] || value : ACTION_LABELS[value] || value}</span>
    </label>
  `).join('');
}

function renderWidgetCode(customization, ui) {
  const { widget, index } = selectedWidget(customization, ui);
  if (!widget) return '<p class="custom-empty">请先从模板库创建一个组件。</p>';
  if (!customization.developerMode) {
    return '<div class="custom-code-locked"><strong>开发者模式尚未开启</strong><p>打开抽屉右上角“开发者”，即可使用隔离的 HTML、CSS 和 JavaScript 编辑器。</p></div>';
  }
  const result = validateCustomWidgetCode(widget.code);
  return `
    <div class="custom-code-mode-toggle">
      <span><strong>使用代码渲染</strong><small>关闭后继续显示可视化模板。</small></span>
      <label class="feature-switch">
        <input type="checkbox" data-custom-widget-code-enabled="${index}" ${widget.mode === 'code' ? 'checked' : ''} />
        <span class="feature-switch-track"></span>
      </label>
    </div>
    <section class="custom-code-permissions">
      <header><strong>允许读取的数据</strong><small>未勾选的数据不会传入组件。</small></header>
      <div>${permissionChecks(CUSTOM_WIDGET_SOURCES, widget.code?.dataPermissions || [], 'data')}</div>
    </section>
    <section class="custom-code-permissions">
      <header><strong>允许执行的动作</strong><small>父页面会再次检查每次请求。</small></header>
      <div>${permissionChecks(CUSTOM_WIDGET_ACTIONS.filter(value => value !== 'none'), widget.code?.actionPermissions || [], 'action')}</div>
    </section>
    <label class="custom-code-field"><span>HTML</span><textarea rows="8" spellcheck="false" data-custom-widget-code="html" data-custom-widget-code-index="${index}">${escapeHtml(widget.code?.html || '')}</textarea></label>
    <label class="custom-code-field"><span>CSS</span><textarea rows="10" spellcheck="false" data-custom-widget-code="css" data-custom-widget-code-index="${index}">${escapeHtml(widget.code?.css || '')}</textarea></label>
    <label class="custom-code-field"><span>JavaScript</span><textarea rows="12" spellcheck="false" data-custom-widget-code="js" data-custom-widget-code-index="${index}">${escapeHtml(widget.code?.js || '')}</textarea></label>
    <p class="custom-validation ${result.valid ? 'is-valid' : 'is-error'}" data-custom-widget-code-status>${result.valid ? '代码安全检查通过，右侧正在沙箱中预览。' : escapeHtml(result.errors[0])}</p>
  `;
}

function renderWidgets(customization, ui) {
  const { widget, index } = selectedWidget(customization, ui);
  const active = ['templates', 'layers', 'style', 'data', 'code'].includes(ui.customWidgetTab)
    ? ui.customWidgetTab
    : 'templates';
  return `
    <div class="custom-widget-list">
      ${renderWidgetTabs(ui, customization.widgets.length > 0, customization.developerMode && widget?.mode === 'code')}
      ${renderWidgetInstanceList(customization, index)}
      <div class="custom-widget-tab-panel">
        ${active === 'templates' ? renderWidgetTemplates(customization) : active === 'layers' ? renderWidgetLayers(customization, ui) : active === 'data' ? renderWidgetData(customization, ui) : active === 'code' ? renderWidgetCode(customization, ui) : renderWidgetStyle(customization, ui)}
      </div>
    </div>
  `;
}

function renderChatAppearance(theme, ui) {
  const chat = normalizeChatAppearance(theme.chat);
  const tab = ['overall', 'list', 'bubbles', 'composer'].includes(ui.chatAppearanceTab)
    ? ui.chatAppearanceTab
    : 'overall';
  const preview = ui.chatAppearancePreview === 'conversation' ? 'conversation' : 'list';
  const panels = {
    overall: `
      <div class="custom-color-grid">
        ${field('列表页背景', 'appThemes.chat.chat.overall.pageBackground', chat.overall.pageBackground, 'color')}
        ${field('聊天页背景', 'appThemes.chat.chat.overall.conversationBackground', chat.overall.conversationBackground, 'color')}
        ${field('顶部栏背景', 'appThemes.chat.chat.overall.headerBackground', chat.overall.headerBackground, 'color')}
        ${field('顶部栏文字', 'appThemes.chat.chat.overall.headerText', chat.overall.headerText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容左右留白', 'appThemes.chat.chat.overall.contentPadding', chat.overall.contentPadding, 'range', { min: 10, max: 30, unit: 'px' })}
        ${widgetSelect('标题位置', 'data-custom-widget-value="appThemes.chat.chat.overall.headerAlign"', ['left', 'center', 'right'], chat.overall.headerAlign, { left: '左侧', center: '居中', right: '右侧' })}
      </div>
    `,
    list: `
      <div class="custom-field-grid">
        ${field('每行高度', 'appThemes.chat.chat.list.rowHeight', chat.list.rowHeight, 'range', { min: 58, max: 104, unit: 'px' })}
        ${field('头像大小', 'appThemes.chat.chat.list.avatarSize', chat.list.avatarSize, 'range', { min: 36, max: 64, unit: 'px' })}
        ${field('头像圆角', 'appThemes.chat.chat.list.avatarRadius', chat.list.avatarRadius, 'range', { min: 0, max: 32, unit: 'px' })}
      </div>
      <div class="custom-color-grid">
        ${field('分隔线', 'appThemes.chat.chat.list.divider', chat.list.divider, 'color')}
        ${field('角色名称', 'appThemes.chat.chat.list.nameColor', chat.list.nameColor, 'color')}
        ${field('消息摘要', 'appThemes.chat.chat.list.summaryColor', chat.list.summaryColor, 'color')}
        ${field('时间与关系', 'appThemes.chat.chat.list.metaColor', chat.list.metaColor, 'color')}
      </div>
      ${checkField('显示角色关系', '在消息摘要下显示关系与会话数', 'appThemes.chat.chat.list.showRelationship', chat.list.showRelationship)}
      ${checkField('显示进入箭头', '保留列表右侧的方向提示', 'appThemes.chat.chat.list.showArrow', chat.list.showArrow)}
    `,
    bubbles: `
      <div class="custom-field-grid">
        ${field('气泡最大宽度', 'appThemes.chat.chat.bubbles.maxWidth', chat.bubbles.maxWidth, 'range', { min: 48, max: 92, unit: '%' })}
        ${field('消息间距', 'appThemes.chat.chat.bubbles.messageGap', chat.bubbles.messageGap, 'range', { min: 4, max: 28, unit: 'px' })}
        ${field('消息头像', 'appThemes.chat.chat.bubbles.avatarSize', chat.bubbles.avatarSize, 'range', { min: 20, max: 44, unit: 'px' })}
        ${field('头像圆角', 'appThemes.chat.chat.bubbles.avatarRadius', chat.bubbles.avatarRadius, 'range', { min: 0, max: 22, unit: 'px' })}
        ${field('气泡横向留白', 'appThemes.chat.chat.bubbles.paddingX', chat.bubbles.paddingX, 'range', { min: 7, max: 22, unit: 'px' })}
        ${field('气泡纵向留白', 'appThemes.chat.chat.bubbles.paddingY', chat.bubbles.paddingY, 'range', { min: 5, max: 18, unit: 'px' })}
        ${widgetSelect('气泡尾巴', 'data-custom-widget-value="appThemes.chat.chat.bubbles.tail"', ['none', 'soft', 'sharp'], chat.bubbles.tail, { none: '无', soft: '柔和', sharp: '尖角' })}
      </div>
      <section class="chat-bubble-color-section">
        <header><strong>角色消息</strong><small>左侧收到的消息</small></header>
        <div class="custom-color-grid">
          ${field('气泡颜色', 'appThemes.chat.chat.bubbles.incomingBackground', chat.bubbles.incomingBackground, 'color')}
          ${field('文字颜色', 'appThemes.chat.chat.bubbles.incomingText', chat.bubbles.incomingText, 'color')}
          ${field('圆角', 'appThemes.chat.chat.bubbles.incomingRadius', chat.bubbles.incomingRadius, 'range', { min: 0, max: 30, unit: 'px' })}
        </div>
      </section>
      <section class="chat-bubble-color-section">
        <header><strong>我的消息</strong><small>右侧发出的消息</small></header>
        <div class="custom-color-grid">
          ${field('气泡颜色', 'appThemes.chat.chat.bubbles.outgoingBackground', chat.bubbles.outgoingBackground, 'color')}
          ${field('文字颜色', 'appThemes.chat.chat.bubbles.outgoingText', chat.bubbles.outgoingText, 'color')}
          ${field('圆角', 'appThemes.chat.chat.bubbles.outgoingRadius', chat.bubbles.outgoingRadius, 'range', { min: 0, max: 30, unit: 'px' })}
        </div>
      </section>
      ${checkField('显示角色头像', '隐藏后气泡会自动对齐', 'appThemes.chat.chat.bubbles.showAvatar', chat.bubbles.showAvatar)}
      ${checkField('显示消息时间', '保留每条消息下方的时间', 'appThemes.chat.chat.bubbles.showTime', chat.bubbles.showTime)}
      ${checkField('显示会话工具栏', '显示会话、当前模型和清空按钮', 'appThemes.chat.chat.bubbles.showSessionTools', chat.bubbles.showSessionTools)}
    `,
    composer: `
      <div class="custom-color-grid">
        ${field('输入栏背景', 'appThemes.chat.chat.composer.background', chat.composer.background, 'color')}
        ${field('输入框背景', 'appThemes.chat.chat.composer.inputBackground', chat.composer.inputBackground, 'color')}
        ${field('输入文字', 'appThemes.chat.chat.composer.text', chat.composer.text, 'color')}
        ${field('发送按钮', 'appThemes.chat.chat.composer.accent', chat.composer.accent, 'color')}
        ${field('快捷回复背景', 'appThemes.chat.chat.composer.quickReplyBackground', chat.composer.quickReplyBackground, 'color')}
        ${field('快捷回复文字', 'appThemes.chat.chat.composer.quickReplyText', chat.composer.quickReplyText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('输入栏圆角', 'appThemes.chat.chat.composer.radius', chat.composer.radius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('输入栏高度', 'appThemes.chat.chat.composer.height', chat.composer.height, 'range', { min: 42, max: 76, unit: 'px' })}
        ${field('快捷回复圆角', 'appThemes.chat.chat.composer.quickReplyRadius', chat.composer.quickReplyRadius, 'range', { min: 0, max: 30, unit: 'px' })}
      </div>
      ${checkField('悬浮输入栏', '与屏幕边缘留出距离并增加阴影', 'appThemes.chat.chat.composer.floating', chat.composer.floating)}
      ${checkField('显示快捷回复', '显示输入栏上方的常用短句', 'appThemes.chat.chat.composer.showQuickReplies', chat.composer.showQuickReplies)}
    `
  };
  return `
    <section class="chat-appearance-studio">
      ${checkField('启用聊天细节美化', '在当前界面主题上覆盖聊天细节', 'appThemes.chat.chat.enabled', chat.enabled)}
      <div class="chat-appearance-preview-switch" aria-label="聊天预览页面">
        <span>右侧预览</span>
        <div>
          <button type="button" class="${preview === 'list' ? 'active' : ''}" data-chat-appearance-preview="list">角色列表</button>
          <button type="button" class="${preview === 'conversation' ? 'active' : ''}" data-chat-appearance-preview="conversation">聊天对话</button>
        </div>
      </div>
      <nav class="chat-appearance-tabs" aria-label="聊天美化分类">
        <button type="button" class="${tab === 'overall' ? 'active' : ''}" data-chat-appearance-tab="overall">整体</button>
        <button type="button" class="${tab === 'list' ? 'active' : ''}" data-chat-appearance-tab="list">角色列表</button>
        <button type="button" class="${tab === 'bubbles' ? 'active' : ''}" data-chat-appearance-tab="bubbles">聊天气泡</button>
        <button type="button" class="${tab === 'composer' ? 'active' : ''}" data-chat-appearance-tab="composer">输入栏</button>
      </nav>
      <div class="chat-appearance-panel">${panels[tab]}</div>
    </section>
  `;
}

function renderCharacterAppearance(theme, ui) {
  const character = normalizeCharacterAppearance(theme.character);
  const tab = ['overall', 'list', 'detail'].includes(ui.characterAppearanceTab)
    ? ui.characterAppearanceTab
    : 'overall';
  const preview = ui.characterAppearancePreview === 'detail' ? 'detail' : 'list';
  const panels = {
    overall: `
      <div class="custom-color-grid">
        ${field('页面背景', 'appThemes.character.character.overall.pageBackground', character.overall.pageBackground, 'color')}
        ${field('顶部栏背景', 'appThemes.character.character.overall.headerBackground', character.overall.headerBackground, 'color')}
        ${field('顶部栏文字', 'appThemes.character.character.overall.headerText', character.overall.headerText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容左右留白', 'appThemes.character.character.overall.contentPadding', character.overall.contentPadding, 'range', { min: 10, max: 30, unit: 'px' })}
        ${field('区块间距', 'appThemes.character.character.overall.sectionGap', character.overall.sectionGap, 'range', { min: 4, max: 24, unit: 'px' })}
        ${widgetSelect('标题位置', 'data-custom-widget-value="appThemes.character.character.overall.headerAlign"', ['left', 'center', 'right'], character.overall.headerAlign, { left: '左侧', center: '居中', right: '右侧' })}
      </div>
    `,
    list: `
      <div class="custom-color-grid">
        ${field('列表背景', 'appThemes.character.character.list.containerBackground', character.list.containerBackground, 'color')}
        ${field('选中角色背景', 'appThemes.character.character.list.activeBackground', character.list.activeBackground, 'color')}
        ${field('分隔线', 'appThemes.character.character.list.divider', character.list.divider, 'color')}
        ${field('角色名称', 'appThemes.character.character.list.nameColor', character.list.nameColor, 'color')}
        ${field('角色摘要', 'appThemes.character.character.list.summaryColor', character.list.summaryColor, 'color')}
        ${field('状态文字', 'appThemes.character.character.list.metaColor', character.list.metaColor, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('列表圆角', 'appThemes.character.character.list.containerRadius', character.list.containerRadius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('每行高度', 'appThemes.character.character.list.rowHeight', character.list.rowHeight, 'range', { min: 54, max: 104, unit: 'px' })}
        ${field('头像大小', 'appThemes.character.character.list.avatarSize', character.list.avatarSize, 'range', { min: 30, max: 64, unit: 'px' })}
        ${field('头像圆角', 'appThemes.character.character.list.avatarRadius', character.list.avatarRadius, 'range', { min: 0, max: 32, unit: 'px' })}
      </div>
      ${checkField('显示角色状态栏', '保留列表顶部的角色状态标签', 'appThemes.character.character.list.showStatus', character.list.showStatus)}
      ${checkField('显示创建数量', '显示底部已创建角色数量', 'appThemes.character.character.list.showMeta', character.list.showMeta)}
    `,
    detail: `
      <section class="chat-bubble-color-section">
        <header><strong>角色资料卡</strong><small>头像、名称与关系</small></header>
        <div class="custom-color-grid">
          ${field('资料卡背景', 'appThemes.character.character.detail.profileBackground', character.detail.profileBackground, 'color')}
          ${field('名称文字', 'appThemes.character.character.detail.profileText', character.detail.profileText, 'color')}
          ${field('关系文字', 'appThemes.character.character.detail.profileMuted', character.detail.profileMuted, 'color')}
        </div>
        <div class="custom-field-grid">
          ${field('资料卡圆角', 'appThemes.character.character.detail.profileRadius', character.detail.profileRadius, 'range', { min: 0, max: 30, unit: 'px' })}
          ${field('头像大小', 'appThemes.character.character.detail.profileAvatarSize', character.detail.profileAvatarSize, 'range', { min: 36, max: 76, unit: 'px' })}
          ${field('头像圆角', 'appThemes.character.character.detail.profileAvatarRadius', character.detail.profileAvatarRadius, 'range', { min: 0, max: 38, unit: 'px' })}
        </div>
      </section>
      <section class="chat-bubble-color-section">
        <header><strong>编辑区与按钮</strong><small>角色设定表单</small></header>
        <div class="custom-color-grid">
          ${field('区块背景', 'appThemes.character.character.detail.sectionBackground', character.detail.sectionBackground, 'color')}
          ${field('输入框背景', 'appThemes.character.character.detail.fieldBackground', character.detail.fieldBackground, 'color')}
          ${field('输入文字', 'appThemes.character.character.detail.fieldText', character.detail.fieldText, 'color')}
          ${field('强调颜色', 'appThemes.character.character.detail.accent', character.detail.accent, 'color')}
        </div>
        <div class="custom-field-grid">
          ${field('区块圆角', 'appThemes.character.character.detail.sectionRadius', character.detail.sectionRadius, 'range', { min: 0, max: 30, unit: 'px' })}
          ${field('输入框圆角', 'appThemes.character.character.detail.fieldRadius', character.detail.fieldRadius, 'range', { min: 0, max: 24, unit: 'px' })}
          ${field('按钮圆角', 'appThemes.character.character.detail.actionRadius', character.detail.actionRadius, 'range', { min: 0, max: 20, unit: 'px' })}
        </div>
      </section>
      <section class="chat-bubble-color-section">
        <header><strong>性格标签</strong><small>详情页底部标签</small></header>
        <div class="custom-color-grid">
          ${field('标签背景', 'appThemes.character.character.detail.tagBackground', character.detail.tagBackground, 'color')}
          ${field('标签文字', 'appThemes.character.character.detail.tagText', character.detail.tagText, 'color')}
          ${field('标签圆角', 'appThemes.character.character.detail.tagRadius', character.detail.tagRadius, 'range', { min: 0, max: 24, unit: 'px' })}
        </div>
      </section>
      ${checkField('显示角色状态栏', '显示详情页顶部状态标签', 'appThemes.character.character.detail.showStatus', character.detail.showStatus)}
      ${checkField('显示 AI 与语音提示', '显示角色当前使用的 AI 与语音状态', 'appThemes.character.character.detail.showTools', character.detail.showTools)}
      ${checkField('显示管理按钮', '显示上移、下移和复制角色', 'appThemes.character.character.detail.showManagement', character.detail.showManagement)}
      ${checkField('显示性格标签', '显示详情页底部的性格标签', 'appThemes.character.character.detail.showTags', character.detail.showTags)}
    `
  };
  return `
    <section class="chat-appearance-studio character-appearance-studio">
      ${checkField('启用角色细节美化', '调整任意细节时会自动开启', 'appThemes.character.character.enabled', character.enabled)}
      <div class="chat-appearance-preview-switch" aria-label="角色预览页面">
        <span>右侧预览</span>
        <div>
          <button type="button" class="${preview === 'list' ? 'active' : ''}" data-character-appearance-preview="list">角色列表</button>
          <button type="button" class="${preview === 'detail' ? 'active' : ''}" data-character-appearance-preview="detail">角色详情</button>
        </div>
      </div>
      <nav class="chat-appearance-tabs character-appearance-tabs" aria-label="角色美化分类">
        <button type="button" class="${tab === 'overall' ? 'active' : ''}" data-character-appearance-tab="overall">整体</button>
        <button type="button" class="${tab === 'list' ? 'active' : ''}" data-character-appearance-tab="list">角色列表</button>
        <button type="button" class="${tab === 'detail' ? 'active' : ''}" data-character-appearance-tab="detail">角色详情</button>
      </nav>
      <div class="chat-appearance-panel">${panels[tab]}</div>
    </section>
  `;
}

function renderSettingsAppearance(theme, ui) {
  const settings = normalizeSettingsAppearance(theme.settings);
  const tab = ['overall', 'groups', 'controls'].includes(ui.settingsAppearanceTab)
    ? ui.settingsAppearanceTab
    : 'overall';
  const preview = ['top', 'groups', 'controls'].includes(ui.settingsAppearancePreview)
    ? ui.settingsAppearancePreview
    : 'top';
  const panels = {
    overall: `
      <div class="custom-color-grid">
        ${field('页面背景', 'appThemes.settings.settings.overall.pageBackground', settings.overall.pageBackground, 'color')}
        ${field('顶部栏背景', 'appThemes.settings.settings.overall.headerBackground', settings.overall.headerBackground, 'color')}
        ${field('顶部栏文字', 'appThemes.settings.settings.overall.headerText', settings.overall.headerText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容左右留白', 'appThemes.settings.settings.overall.contentPadding', settings.overall.contentPadding, 'range', { min: 10, max: 30, unit: 'px' })}
        ${field('区块间距', 'appThemes.settings.settings.overall.sectionGap', settings.overall.sectionGap, 'range', { min: 4, max: 24, unit: 'px' })}
        ${widgetSelect('标题位置', 'data-custom-widget-value="appThemes.settings.settings.overall.headerAlign"', ['left', 'center', 'right'], settings.overall.headerAlign, { left: '左侧', center: '居中', right: '右侧' })}
      </div>
      ${checkField('显示主题资料区', '保留不同界面主题顶部的资料卡或搜索区', 'appThemes.settings.settings.overall.showProfilePrelude', settings.overall.showProfilePrelude)}
    `,
    groups: `
      <div class="custom-color-grid">
        ${field('分组背景', 'appThemes.settings.settings.groups.background', settings.groups.background, 'color')}
        ${field('分组边框', 'appThemes.settings.settings.groups.border', settings.groups.border, 'color')}
        ${field('图标背景', 'appThemes.settings.settings.groups.iconBackground', settings.groups.iconBackground, 'color')}
        ${field('图标文字', 'appThemes.settings.settings.groups.iconText', settings.groups.iconText, 'color')}
        ${field('标题文字', 'appThemes.settings.settings.groups.titleText', settings.groups.titleText, 'color')}
        ${field('说明文字', 'appThemes.settings.settings.groups.subtitleText', settings.groups.subtitleText, 'color')}
        ${field('分隔线', 'appThemes.settings.settings.groups.divider', settings.groups.divider, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('分组圆角', 'appThemes.settings.settings.groups.radius', settings.groups.radius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('分组标题高度', 'appThemes.settings.settings.groups.headerHeight', settings.groups.headerHeight, 'range', { min: 46, max: 84, unit: 'px' })}
        ${field('图标大小', 'appThemes.settings.settings.groups.iconSize', settings.groups.iconSize, 'range', { min: 24, max: 46, unit: 'px' })}
        ${field('图标圆角', 'appThemes.settings.settings.groups.iconRadius', settings.groups.iconRadius, 'range', { min: 0, max: 22, unit: 'px' })}
      </div>
    `,
    controls: `
      <div class="custom-color-grid">
        ${field('标签文字', 'appThemes.settings.settings.controls.labelText', settings.controls.labelText, 'color')}
        ${field('辅助文字', 'appThemes.settings.settings.controls.mutedText', settings.controls.mutedText, 'color')}
        ${field('输入框背景', 'appThemes.settings.settings.controls.fieldBackground', settings.controls.fieldBackground, 'color')}
        ${field('输入框文字', 'appThemes.settings.settings.controls.fieldText', settings.controls.fieldText, 'color')}
        ${field('强调颜色', 'appThemes.settings.settings.controls.accent', settings.controls.accent, 'color')}
        ${field('按钮背景', 'appThemes.settings.settings.controls.buttonBackground', settings.controls.buttonBackground, 'color')}
        ${field('按钮文字', 'appThemes.settings.settings.controls.buttonText', settings.controls.buttonText, 'color')}
        ${field('安全提示背景', 'appThemes.settings.settings.controls.noteBackground', settings.controls.noteBackground, 'color')}
        ${field('安全提示文字', 'appThemes.settings.settings.controls.noteText', settings.controls.noteText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('每行最小高度', 'appThemes.settings.settings.controls.rowHeight', settings.controls.rowHeight, 'range', { min: 40, max: 76, unit: 'px' })}
        ${field('输入框圆角', 'appThemes.settings.settings.controls.fieldRadius', settings.controls.fieldRadius, 'range', { min: 0, max: 20, unit: 'px' })}
        ${field('按钮圆角', 'appThemes.settings.settings.controls.buttonRadius', settings.controls.buttonRadius, 'range', { min: 0, max: 20, unit: 'px' })}
      </div>
      ${checkField('显示安全提示', '显示密钥与本机服务相关的安全说明', 'appThemes.settings.settings.controls.showSecurityNotes', settings.controls.showSecurityNotes)}
    `
  };
  return `
    <section class="chat-appearance-studio settings-appearance-studio">
      ${checkField('启用设置细节美化', '调整任意细节时会自动开启', 'appThemes.settings.settings.enabled', settings.enabled)}
      <div class="chat-appearance-preview-switch settings-appearance-preview-switch" aria-label="设置预览区域">
        <span>右侧定位</span>
        <div>
          <button type="button" class="${preview === 'top' ? 'active' : ''}" data-settings-appearance-preview="top">顶部</button>
          <button type="button" class="${preview === 'groups' ? 'active' : ''}" data-settings-appearance-preview="groups">分组</button>
          <button type="button" class="${preview === 'controls' ? 'active' : ''}" data-settings-appearance-preview="controls">控件</button>
        </div>
      </div>
      <nav class="chat-appearance-tabs settings-appearance-tabs" aria-label="设置美化分类">
        <button type="button" class="${tab === 'overall' ? 'active' : ''}" data-settings-appearance-tab="overall">整体</button>
        <button type="button" class="${tab === 'groups' ? 'active' : ''}" data-settings-appearance-tab="groups">分组</button>
        <button type="button" class="${tab === 'controls' ? 'active' : ''}" data-settings-appearance-tab="controls">控件</button>
      </nav>
      <div class="chat-appearance-panel">${panels[tab]}</div>
    </section>
  `;
}

function renderMemoryAppearance(theme, ui) {
  const memory = normalizeMemoryAppearance(theme.memory);
  const tab = ['overall', 'editor', 'cards'].includes(ui.memoryAppearanceTab)
    ? ui.memoryAppearanceTab
    : 'overall';
  const preview = ['top', 'editor', 'cards'].includes(ui.memoryAppearancePreview)
    ? ui.memoryAppearancePreview
    : 'top';
  const panels = {
    overall: `
      <div class="custom-color-grid">
        ${field('页面背景', 'appThemes.memory.memory.overall.pageBackground', memory.overall.pageBackground, 'color')}
        ${field('顶部栏背景', 'appThemes.memory.memory.overall.headerBackground', memory.overall.headerBackground, 'color')}
        ${field('顶部栏文字', 'appThemes.memory.memory.overall.headerText', memory.overall.headerText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容左右留白', 'appThemes.memory.memory.overall.contentPadding', memory.overall.contentPadding, 'range', { min: 10, max: 30, unit: 'px' })}
        ${field('区块间距', 'appThemes.memory.memory.overall.sectionGap', memory.overall.sectionGap, 'range', { min: 4, max: 24, unit: 'px' })}
        ${widgetSelect('标题位置', 'data-custom-widget-value="appThemes.memory.memory.overall.headerAlign"', ['left', 'center', 'right'], memory.overall.headerAlign, { left: '左侧', center: '居中', right: '右侧' })}
      </div>
      ${checkField('显示搜索栏', '显示记忆搜索入口', 'appThemes.memory.memory.overall.showSearch', memory.overall.showSearch)}
      ${checkField('显示记忆数量', '显示顶部右侧的记忆条数', 'appThemes.memory.memory.overall.showCount', memory.overall.showCount)}
    `,
    editor: `
      <div class="custom-color-grid">
        ${field('表单背景', 'appThemes.memory.memory.editor.background', memory.editor.background, 'color')}
        ${field('表单标题', 'appThemes.memory.memory.editor.titleText', memory.editor.titleText, 'color')}
        ${field('输入框背景', 'appThemes.memory.memory.editor.fieldBackground', memory.editor.fieldBackground, 'color')}
        ${field('输入框文字', 'appThemes.memory.memory.editor.fieldText', memory.editor.fieldText, 'color')}
        ${field('按钮背景', 'appThemes.memory.memory.editor.accent', memory.editor.accent, 'color')}
        ${field('按钮文字', 'appThemes.memory.memory.editor.buttonText', memory.editor.buttonText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('表单圆角', 'appThemes.memory.memory.editor.radius', memory.editor.radius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('输入框圆角', 'appThemes.memory.memory.editor.fieldRadius', memory.editor.fieldRadius, 'range', { min: 0, max: 20, unit: 'px' })}
        ${field('按钮圆角', 'appThemes.memory.memory.editor.buttonRadius', memory.editor.buttonRadius, 'range', { min: 0, max: 20, unit: 'px' })}
      </div>
    `,
    cards: `
      <div class="custom-color-grid">
        ${field('卡片背景', 'appThemes.memory.memory.cards.background', memory.cards.background, 'color')}
        ${field('左侧强调线', 'appThemes.memory.memory.cards.borderAccent', memory.cards.borderAccent, 'color')}
        ${field('标题文字', 'appThemes.memory.memory.cards.titleText', memory.cards.titleText, 'color')}
        ${field('正文文字', 'appThemes.memory.memory.cards.bodyText', memory.cards.bodyText, 'color')}
        ${field('日期文字', 'appThemes.memory.memory.cards.metaText', memory.cards.metaText, 'color')}
        ${field('标签背景', 'appThemes.memory.memory.cards.tagBackground', memory.cards.tagBackground, 'color')}
        ${field('标签文字', 'appThemes.memory.memory.cards.tagText', memory.cards.tagText, 'color')}
        ${field('操作文字', 'appThemes.memory.memory.cards.actionText', memory.cards.actionText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('卡片间距', 'appThemes.memory.memory.cards.gap', memory.cards.gap, 'range', { min: 0, max: 24, unit: 'px' })}
        ${field('卡片圆角', 'appThemes.memory.memory.cards.radius', memory.cards.radius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('标签圆角', 'appThemes.memory.memory.cards.tagRadius', memory.cards.tagRadius, 'range', { min: 0, max: 24, unit: 'px' })}
      </div>
      ${checkField('显示日期', '显示每条记忆的记录日期', 'appThemes.memory.memory.cards.showDate', memory.cards.showDate)}
      ${checkField('显示编辑与删除', '显示记忆卡片底部操作', 'appThemes.memory.memory.cards.showActions', memory.cards.showActions)}
    `
  };
  return `
    <section class="chat-appearance-studio memory-appearance-studio">
      ${checkField('启用记忆细节美化', '调整任意细节时会自动开启', 'appThemes.memory.memory.enabled', memory.enabled)}
      <div class="chat-appearance-preview-switch settings-appearance-preview-switch" aria-label="记忆预览区域">
        <span>右侧定位</span>
        <div>
          <button type="button" class="${preview === 'top' ? 'active' : ''}" data-memory-appearance-preview="top">顶部</button>
          <button type="button" class="${preview === 'editor' ? 'active' : ''}" data-memory-appearance-preview="editor">表单</button>
          <button type="button" class="${preview === 'cards' ? 'active' : ''}" data-memory-appearance-preview="cards">卡片</button>
        </div>
      </div>
      <nav class="chat-appearance-tabs character-appearance-tabs" aria-label="记忆美化分类">
        <button type="button" class="${tab === 'overall' ? 'active' : ''}" data-memory-appearance-tab="overall">整体</button>
        <button type="button" class="${tab === 'editor' ? 'active' : ''}" data-memory-appearance-tab="editor">录入表单</button>
        <button type="button" class="${tab === 'cards' ? 'active' : ''}" data-memory-appearance-tab="cards">记忆卡片</button>
      </nav>
      <div class="chat-appearance-panel">${panels[tab]}</div>
    </section>
  `;
}

function renderMusicAppearance(theme, ui) {
  const music = normalizeMusicAppearance(theme.music);
  const tab = ['overall', 'home', 'mini', 'player'].includes(ui.musicAppearanceTab) ? ui.musicAppearanceTab : 'overall';
  const preview = ui.musicAppearancePreview === 'player' ? 'player' : 'home';
  const panels = {
    overall: `
      <div class="custom-color-grid">
        ${field('首页背景', 'appThemes.music.music.overall.pageBackground', music.overall.pageBackground, 'color')}
        ${field('标题文字', 'appThemes.music.music.overall.headerText', music.overall.headerText, 'color')}
        ${field('强调颜色', 'appThemes.music.music.overall.accent', music.overall.accent, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容左右留白', 'appThemes.music.music.overall.contentPadding', music.overall.contentPadding, 'range', { min: 10, max: 28, unit: 'px' })}
        ${field('内容区间距', 'appThemes.music.music.overall.sectionGap', music.overall.sectionGap, 'range', { min: 4, max: 24, unit: 'px' })}
        ${widgetSelect('标题位置', 'data-custom-widget-value="appThemes.music.music.overall.headerAlign"', ['left', 'center', 'right'], music.overall.headerAlign, { left: '左侧', center: '居中', right: '右侧' })}
      </div>
    `,
    home: `
      <div class="custom-color-grid">
        ${field('搜索框背景', 'appThemes.music.music.home.searchBackground', music.home.searchBackground, 'color')}
        ${field('搜索框文字', 'appThemes.music.music.home.searchText', music.home.searchText, 'color')}
        ${field('快捷入口背景', 'appThemes.music.music.home.shortcutBackground', music.home.shortcutBackground, 'color')}
        ${field('快捷入口图标', 'appThemes.music.music.home.shortcutText', music.home.shortcutText, 'color')}
        ${field('分区标题', 'appThemes.music.music.home.sectionTitle', music.home.sectionTitle, 'color')}
        ${field('辅助文字', 'appThemes.music.music.home.mutedText', music.home.mutedText, 'color')}
        ${field('列表分隔线', 'appThemes.music.music.home.divider', music.home.divider, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('搜索框圆角', 'appThemes.music.music.home.searchRadius', music.home.searchRadius, 'range', { min: 0, max: 24, unit: 'px' })}
        ${field('推荐卡圆角', 'appThemes.music.music.home.heroRadius', music.home.heroRadius, 'range', { min: 0, max: 24, unit: 'px' })}
        ${field('快捷入口大小', 'appThemes.music.music.home.shortcutSize', music.home.shortcutSize, 'range', { min: 30, max: 52, unit: 'px' })}
        ${field('封面圆角', 'appThemes.music.music.home.coverRadius', music.home.coverRadius, 'range', { min: 0, max: 20, unit: 'px' })}
        ${field('歌曲行高', 'appThemes.music.music.home.trackRowHeight', music.home.trackRowHeight, 'range', { min: 48, max: 78, unit: 'px' })}
      </div>
      ${checkField('显示今日推荐卡', '显示首页顶部的大幅推荐', 'appThemes.music.music.home.showHero', music.home.showHero)}
      ${checkField('显示快捷入口', '显示每日推荐、歌单和榜单入口', 'appThemes.music.music.home.showShortcuts', music.home.showShortcuts)}
    `,
    mini: `
      <div class="custom-color-grid">
        ${field('播放栏背景', 'appThemes.music.music.mini.background', music.mini.background, 'color')}
        ${field('歌曲文字', 'appThemes.music.music.mini.text', music.mini.text, 'color')}
        ${field('歌手与时间', 'appThemes.music.music.mini.mutedText', music.mini.mutedText, 'color')}
        ${field('进度槽', 'appThemes.music.music.mini.progressBackground', music.mini.progressBackground, 'color')}
        ${field('播放进度', 'appThemes.music.music.mini.progressAccent', music.mini.progressAccent, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('播放栏高度', 'appThemes.music.music.mini.height', music.mini.height, 'range', { min: 52, max: 82, unit: 'px' })}
        ${field('播放栏圆角', 'appThemes.music.music.mini.radius', music.mini.radius, 'range', { min: 0, max: 24, unit: 'px' })}
      </div>
      ${checkField('显示播放时间', '在播放按钮前显示当前时间', 'appThemes.music.music.mini.showTime', music.mini.showTime)}
    `,
    player: `
      <div class="custom-color-grid">
        ${field('播放页背景', 'appThemes.music.music.player.background', music.player.background, 'color')}
        ${field('主要文字', 'appThemes.music.music.player.text', music.player.text, 'color')}
        ${field('辅助文字', 'appThemes.music.music.player.mutedText', music.player.mutedText, 'color')}
        ${field('进度强调', 'appThemes.music.music.player.accent', music.player.accent, 'color')}
        ${field('主播放键背景', 'appThemes.music.music.player.mainControlBackground', music.player.mainControlBackground, 'color')}
        ${field('主播放键图标', 'appThemes.music.music.player.mainControlText', music.player.mainControlText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('唱片大小', 'appThemes.music.music.player.recordSize', music.player.recordSize, 'range', { min: 160, max: 260, unit: 'px' })}
        ${field('封面大小', 'appThemes.music.music.player.coverSize', music.player.coverSize, 'range', { min: 90, max: 170, unit: 'px' })}
        ${field('唱片区域高度', 'appThemes.music.music.player.stageHeight', music.player.stageHeight, 'range', { min: 210, max: 310, unit: 'px' })}
      </div>
      ${checkField('显示唱针', '显示唱片上方的唱针装饰', 'appThemes.music.music.player.showNeedle', music.player.showNeedle)}
      ${checkField('显示音量调节', '显示播放页底部音量滑杆', 'appThemes.music.music.player.showVolume', music.player.showVolume)}
      ${checkField('显示队列状态', '显示当前播放队列位置', 'appThemes.music.music.player.showQueue', music.player.showQueue)}
    `
  };
  return `
    <section class="chat-appearance-studio music-appearance-studio">
      ${checkField('启用音乐细节美化', '调整任意细节时会自动开启', 'appThemes.music.music.enabled', music.enabled)}
      <div class="chat-appearance-preview-switch" aria-label="音乐预览页面"><span>右侧预览</span><div>
        <button type="button" class="${preview === 'home' ? 'active' : ''}" data-music-appearance-preview="home">音乐首页</button>
        <button type="button" class="${preview === 'player' ? 'active' : ''}" data-music-appearance-preview="player">播放页面</button>
      </div></div>
      <nav class="chat-appearance-tabs" aria-label="音乐美化分类">
        <button type="button" class="${tab === 'overall' ? 'active' : ''}" data-music-appearance-tab="overall">整体</button>
        <button type="button" class="${tab === 'home' ? 'active' : ''}" data-music-appearance-tab="home">首页</button>
        <button type="button" class="${tab === 'mini' ? 'active' : ''}" data-music-appearance-tab="mini">播放栏</button>
        <button type="button" class="${tab === 'player' ? 'active' : ''}" data-music-appearance-tab="player">播放页</button>
      </nav>
      <div class="chat-appearance-panel">${panels[tab]}</div>
    </section>`;
}

function renderCompanionAppearance(theme, ui, appId, appName) {
  const value = normalizeCompanionAppearance(theme.companion);
  const base = `appThemes.${appId}.companion`;
  const tab = ['overall', 'editor', 'cards'].includes(ui.companionAppearanceTab) ? ui.companionAppearanceTab : 'overall';
  const preview = ['top', 'editor', 'cards'].includes(ui.companionAppearancePreview) ? ui.companionAppearancePreview : 'top';
  const decorationLabel = appId === 'diary' ? '显示心情与时间轴装饰' : appId === 'anniversary' ? '显示爱心装饰' : '显示星空装饰';
  const extraLabel = appId === 'diary' ? '显示 AI 小结' : appId === 'anniversary' ? '显示近期提醒' : '显示问候与通知区';
  const panels = {
    overall: `
      <div class="custom-color-grid">
        ${field('页面背景', `${base}.overall.pageBackground`, value.overall.pageBackground, 'color')}
        ${field('顶部栏背景', `${base}.overall.headerBackground`, value.overall.headerBackground, 'color')}
        ${field('顶部栏文字', `${base}.overall.headerText`, value.overall.headerText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容左右留白', `${base}.overall.contentPadding`, value.overall.contentPadding, 'range', { min: 10, max: 30, unit: 'px' })}
        ${field('区块间距', `${base}.overall.sectionGap`, value.overall.sectionGap, 'range', { min: 4, max: 24, unit: 'px' })}
        ${widgetSelect('标题位置', `data-custom-widget-value="${base}.overall.headerAlign"`, ['left', 'center', 'right'], value.overall.headerAlign, { left: '左侧', center: '居中', right: '右侧' })}
      </div>
      ${checkField('显示顶部数量或月亮', '保留顶部右侧的辅助信息', `${base}.overall.showHeaderMeta`, value.overall.showHeaderMeta)}
      ${checkField(decorationLabel, '控制当前 App 特有的视觉装饰', `${base}.overall.showDecorations`, value.overall.showDecorations)}
    `,
    editor: `
      <div class="custom-color-grid">
        ${field('录入区背景', `${base}.editor.background`, value.editor.background, 'color')}
        ${field('录入区标题', `${base}.editor.titleText`, value.editor.titleText, 'color')}
        ${field('输入框背景', `${base}.editor.fieldBackground`, value.editor.fieldBackground, 'color')}
        ${field('输入框文字', `${base}.editor.fieldText`, value.editor.fieldText, 'color')}
        ${field('按钮背景', `${base}.editor.accent`, value.editor.accent, 'color')}
        ${field('按钮文字', `${base}.editor.buttonText`, value.editor.buttonText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('录入区圆角', `${base}.editor.radius`, value.editor.radius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('输入框圆角', `${base}.editor.fieldRadius`, value.editor.fieldRadius, 'range', { min: 0, max: 20, unit: 'px' })}
        ${field('按钮圆角', `${base}.editor.buttonRadius`, value.editor.buttonRadius, 'range', { min: 0, max: 20, unit: 'px' })}
      </div>
    `,
    cards: `
      <div class="custom-color-grid">
        ${field('内容卡背景', `${base}.cards.background`, value.cards.background, 'color')}
        ${field('强调颜色', `${base}.cards.accent`, value.cards.accent, 'color')}
        ${field('标题文字', `${base}.cards.titleText`, value.cards.titleText, 'color')}
        ${field('正文文字', `${base}.cards.bodyText`, value.cards.bodyText, 'color')}
        ${field('日期与辅助文字', `${base}.cards.metaText`, value.cards.metaText, 'color')}
        ${field('操作文字', `${base}.cards.actionText`, value.cards.actionText, 'color')}
      </div>
      <div class="custom-field-grid">
        ${field('内容卡圆角', `${base}.cards.radius`, value.cards.radius, 'range', { min: 0, max: 30, unit: 'px' })}
        ${field('内容卡间距', `${base}.cards.gap`, value.cards.gap, 'range', { min: 0, max: 24, unit: 'px' })}
      </div>
      ${checkField('显示编辑与删除', '适用于支持编辑的内容卡片', `${base}.cards.showActions`, value.cards.showActions)}
      ${checkField(extraLabel, '控制当前 App 的附加信息面板', `${base}.cards.showExtraPanels`, value.cards.showExtraPanels)}
    `
  };
  return `
    <section class="chat-appearance-studio companion-appearance-studio">
      ${checkField(`启用${appName}细节美化`, '调整任意细节时会自动开启', `${base}.enabled`, value.enabled)}
      <div class="chat-appearance-preview-switch settings-appearance-preview-switch" aria-label="${appName}预览区域"><span>右侧定位</span><div>
        <button type="button" class="${preview === 'top' ? 'active' : ''}" data-companion-appearance-preview="top">顶部</button>
        <button type="button" class="${preview === 'editor' ? 'active' : ''}" data-companion-appearance-preview="editor">录入区</button>
        <button type="button" class="${preview === 'cards' ? 'active' : ''}" data-companion-appearance-preview="cards">内容卡</button>
      </div></div>
      <nav class="chat-appearance-tabs character-appearance-tabs" aria-label="${appName}美化分类">
        <button type="button" class="${tab === 'overall' ? 'active' : ''}" data-companion-appearance-tab="overall">整体</button>
        <button type="button" class="${tab === 'editor' ? 'active' : ''}" data-companion-appearance-tab="editor">录入区</button>
        <button type="button" class="${tab === 'cards' ? 'active' : ''}" data-companion-appearance-tab="cards">内容卡</button>
      </nav>
      <div class="chat-appearance-panel">${panels[tab]}</div>
    </section>`;
}

function renderAppMediaAsset(appId, slot, label, image, square = false) {
  return `
    <article class="custom-app-media-card">
      <span class="custom-app-media-preview ${square ? 'is-square' : 'is-background'}">
        ${image ? `<img src="${escapeHtml(image)}" alt="" />` : '<i>图片位</i>'}
      </span>
      <strong>${label}</strong>
      <div>
        <label>
          ${image ? '替换' : '上传'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            data-custom-app-image="${appId}"
            data-custom-app-image-slot="${slot}"
          />
        </label>
        <button
          type="button"
          data-custom-app-image-remove="${appId}"
          data-custom-app-image-slot="${slot}"
          ${image ? '' : 'disabled'}
        >移除</button>
      </div>
    </article>`;
}

function renderAppMedia(theme, appId) {
  const media = normalizeAppMedia(theme.media);
  const base = `appThemes.${appId}.media`;
  return `
    <section class="custom-app-media-studio">
      <header>
        <strong>内部图片</strong>
        <small>仅影响当前 App，图片会压缩后保存在本地。</small>
      </header>
      <div class="custom-app-media-grid">
        ${renderAppMediaAsset(appId, 'backgroundImage', '页面背景图', media.backgroundImage)}
        ${renderAppMediaAsset(appId, 'primaryButtonImage', '主按钮图片', media.primaryButtonImage, true)}
        ${renderAppMediaAsset(appId, 'backButtonImage', '返回按钮图片', media.backButtonImage, true)}
      </div>
      <div class="custom-field-grid">
        ${widgetSelect('背景缩放', `data-custom-widget-value="${base}.backgroundFit"`, ['cover', 'contain', 'tile'], media.backgroundFit, { cover: '铺满', contain: '完整显示', tile: '平铺' })}
        ${widgetSelect('背景位置', `data-custom-widget-value="${base}.backgroundPosition"`, ['center', 'top', 'bottom'], media.backgroundPosition, { center: '居中', top: '顶部', bottom: '底部' })}
        ${widgetSelect('主按钮用法', `data-custom-widget-value="${base}.primaryButtonMode"`, ['background', 'replace'], media.primaryButtonMode, { background: '作为底图并保留文字', replace: '整图替换按钮文字' })}
        ${widgetSelect('主按钮缩放', `data-custom-widget-value="${base}.primaryButtonFit"`, ['cover', 'contain'], media.primaryButtonFit, { cover: '铺满', contain: '完整显示' })}
      </div>
    </section>`;
}

function renderApp(customization, appId, apps, ui) {
  const app = apps.find(item => item.id === appId) || apps[0];
  const theme = customization.appThemes[app?.id] || {
    enabled: true,
    name: '',
    icon: '',
    variables: {},
    css: ''
  };
  const cssResult = validateCustomCss(theme.css);
  return `
    <div class="custom-app-heading">
      <strong>${escapeHtml(app?.name || '')}</strong>
      <label class="feature-switch">
        <input type="checkbox" data-custom-check="appThemes.${app?.id}.enabled" ${theme.enabled ? 'checked' : ''} />
        <span class="feature-switch-track"></span>
      </label>
    </div>
    ${field('主题名称', `appThemes.${app?.id}.name`, theme.name, 'text')}
    <div class="custom-color-grid">
      ${field('App 主色', `appThemes.${app?.id}.variables.accent`, theme.variables.accent || customization.tokens.accent, 'color')}
      ${field('App 背景', `appThemes.${app?.id}.variables.background`, theme.variables.background || customization.tokens.background, 'color')}
      ${field('App 卡片', `appThemes.${app?.id}.variables.surface`, theme.variables.surface || customization.tokens.surface, 'color')}
      ${field('App 文字', `appThemes.${app?.id}.variables.text`, theme.variables.text || customization.tokens.text, 'color')}
    </div>
    ${renderAppMedia(theme, app.id)}
    ${app?.id === 'chat' ? renderChatAppearance(theme, ui) : ''}
    ${app?.id === 'character' ? renderCharacterAppearance(theme, ui) : ''}
    ${app?.id === 'settings' ? renderSettingsAppearance(theme, ui) : ''}
    ${app?.id === 'memory' ? renderMemoryAppearance(theme, ui) : ''}
    ${app?.id === 'music' ? renderMusicAppearance(theme, ui) : ''}
    ${['diary', 'anniversary', 'goodnight'].includes(app?.id) ? renderCompanionAppearance(theme, ui, app.id, app.name) : ''}
    ${customization.developerMode ? `
      <label class="custom-field custom-field-wide">
        <span>限定作用域 CSS <small>仅能影响这个 App，禁止外链、HTML、@import 和脚本。</small></span>
        <textarea rows="10" spellcheck="false" data-custom-css="${app?.id}">${escapeHtml(theme.css)}</textarea>
      </label>
      <p class="custom-validation ${cssResult.valid ? 'is-valid' : 'is-error'}" data-custom-css-status>
        ${cssResult.valid ? 'CSS 安全检查通过' : escapeHtml(cssResult.errors[0])}
      </p>
    ` : '<p class="custom-empty">打开右上角“开发者”后可编辑这个 App 的限定 CSS。</p>'}
  `;
}

function renderPackages(ui) {
  const preview = ui.customImportPreview;
  return `
    <div class="package-actions">
      <label class="custom-add-button">
        导入主题 ZIP
        <input type="file" accept=".zip,.lptheme.zip,application/zip" data-custom-package-file />
      </label>
      <button type="button" data-custom-package-export>导出当前主题</button>
    </div>
    ${preview ? `
      <article class="package-preview">
        <span>导入预检</span>
        <h4>${escapeHtml(preview.manifest.name)}</h4>
        <dl>
          <div><dt>类型</dt><dd>${escapeHtml(preview.manifest.type)}</dd></div>
          <div><dt>版本</dt><dd>${escapeHtml(preview.manifest.version)}</dd></div>
          <div><dt>文件</dt><dd>${preview.summary.fileCount} 个</dd></div>
          <div><dt>大小</dt><dd>${Math.ceil(preview.summary.totalBytes / 1024)} KB</dd></div>
        </dl>
        <p>未发现外部网络资源。应用前不会改动当前主题。</p>
        <button class="primary-action" type="button" data-custom-package-apply>保存并应用</button>
      </article>
    ` : '<p class="custom-empty">选择 ZIP 后会先显示检查结果。</p>'}
  `;
}

function renderBody(config, ui, apps) {
  const kind = ui.customEditor?.kind;
  const customization = config.theme.customization;
  if (kind === 'basic') return renderBasic(customization);
  if (kind === 'shell') return renderShell(customization);
  if (kind === 'palette') return renderPalette(customization);
  if (kind === 'iconPack') return renderIconPack(customization, apps);
  if (kind === 'desktop') return renderDesktop(customization);
  if (kind === 'widgets') return renderWidgets({
    ...customization,
    __weather: config.theme.widgets?.weather || {}
  }, ui);
  if (kind === 'app') return renderApp(customization, ui.customEditor.appId, apps, ui);
  if (kind === 'packages') return renderPackages(ui);
  return '';
}

export function renderCustomizationDrawer(config, ui, apps) {
  const editor = ui.customEditor;
  if (!editor) return '';
  const [title, description] = TITLES[editor.kind] || ['自定义', ''];
  return `
    <aside class="customization-drawer" aria-label="${title}">
      <header class="customization-drawer-header">
        <button type="button" data-custom-cancel aria-label="关闭">←</button>
        <span>
          <small>自定义编辑</small>
          <strong>${title}</strong>
        </span>
        <label class="developer-toggle">
          <input type="checkbox" data-custom-developer ${config.theme.customization.developerMode ? 'checked' : ''} />
          <span>开发者</span>
        </label>
      </header>
      <p class="customization-drawer-description">${description}</p>
      <div class="customization-drawer-body">
        ${renderBody(config, ui, apps)}
      </div>
      ${ui.customEditor.kind !== 'packages' ? `
        <footer class="customization-drawer-actions">
          <button type="button" data-custom-reset>恢复默认</button>
          <button type="button" data-custom-cancel>取消</button>
          <button class="primary-action" type="button" data-custom-apply>应用</button>
        </footer>
      ` : `
        <footer class="customization-drawer-actions">
          <button type="button" data-custom-cancel>关闭</button>
        </footer>
      `}
      <p class="custom-drawer-status" data-custom-status>${escapeHtml(ui.customStatus || '')}</p>
    </aside>
  `;
}

export function bindCustomizationDrawer(root, handlers) {
  const pathForControl = control => control.dataset.customValue
    || control.dataset.customNumber
    || control.dataset.customColor
    || control.dataset.customCheck
    || control.dataset.customWidgetValue
    || '';
  const syncAppearancePreviewButtons = target => {
    if (!target) return;
    const appId = typeof target === 'string' ? 'chat' : target.appId;
    const view = typeof target === 'string' ? target : target.view;
    const attribute = appId === 'character'
      ? 'data-character-appearance-preview'
      : appId === 'settings'
        ? 'data-settings-appearance-preview'
        : appId === 'memory'
          ? 'data-memory-appearance-preview'
          : appId === 'music'
            ? 'data-music-appearance-preview'
            : ['diary', 'anniversary', 'goodnight'].includes(appId)
              ? 'data-companion-appearance-preview'
        : 'data-chat-appearance-preview';
    root.querySelectorAll(`[${attribute}]`).forEach(button => {
      button.classList.toggle('active', button.getAttribute(attribute) === view);
    });
  };
  const drawer = root.querySelector('.customization-drawer');
  const showAppDetailsEnabled = path => {
    const isChat = path.startsWith('appThemes.chat.chat.')
      && path !== 'appThemes.chat.chat.enabled';
    const isCharacter = path.startsWith('appThemes.character.character.')
      && path !== 'appThemes.character.character.enabled';
    const isSettings = path.startsWith('appThemes.settings.settings.')
      && path !== 'appThemes.settings.settings.enabled';
    const isMemory = path.startsWith('appThemes.memory.memory.')
      && path !== 'appThemes.memory.memory.enabled';
    const isMusic = path.startsWith('appThemes.music.music.')
      && path !== 'appThemes.music.music.enabled';
    const companionMatch = path.match(/^appThemes\.(diary|anniversary|goodnight)\.companion\./);
    const isCompanion = Boolean(companionMatch) && !path.endsWith('.companion.enabled');
    if (!isChat && !isCharacter && !isSettings && !isMemory && !isMusic && !isCompanion) return;
    const togglePath = isChat
      ? 'appThemes.chat.chat.enabled'
      : isCharacter
        ? 'appThemes.character.character.enabled'
        : isSettings
          ? 'appThemes.settings.settings.enabled'
          : isMemory
            ? 'appThemes.memory.memory.enabled'
            : isMusic
              ? 'appThemes.music.music.enabled'
              : `appThemes.${companionMatch[1]}.companion.enabled`;
    const toggle = root.querySelector(`input[data-custom-check="${togglePath}"]`);
    if (toggle) toggle.checked = true;
  };
  drawer?.addEventListener('focusin', event => {
    const path = pathForControl(event.target);
    if (!path) return;
    syncAppearancePreviewButtons(handlers.previewCustomizationPath?.(path));
  });
  drawer?.addEventListener('input', event => {
    showAppDetailsEnabled(pathForControl(event.target));
  }, true);
  drawer?.addEventListener('change', event => {
    showAppDetailsEnabled(pathForControl(event.target));
  }, true);
  root.querySelectorAll('[data-open-custom]').forEach(button => {
    button.addEventListener('click', () => handlers.openCustomization?.(
      button.dataset.openCustom,
      button.dataset.customApp || ''
    ));
  });
  root.querySelectorAll('[data-custom-cancel]').forEach(button => {
    button.addEventListener('click', () => handlers.cancelCustomization?.());
  });
  root.querySelector('[data-custom-apply]')?.addEventListener('click', () => handlers.applyCustomization?.());
  root.querySelector('[data-custom-reset]')?.addEventListener('click', () => handlers.resetCustomization?.());
  root.querySelector('[data-custom-developer]')?.addEventListener('change', event => {
    handlers.updateCustomization?.('developerMode', event.currentTarget.checked);
  });

  root.querySelectorAll('[data-custom-value]').forEach(input => {
    input.addEventListener('input', () => handlers.updateCustomization?.(input.dataset.customValue, input.value));
  });
  root.querySelectorAll('[data-custom-number]').forEach(input => {
    input.addEventListener('input', () => handlers.updateCustomization?.(
      input.dataset.customNumber,
      Number(input.value),
      { keepFocus: true }
    ));
  });
  root.querySelectorAll('[data-custom-color]').forEach(input => {
    input.addEventListener('input', () => handlers.updateCustomization?.(
      input.dataset.customColor,
      input.value,
      { keepFocus: true }
    ));
  });
  root.querySelectorAll('[data-custom-check]').forEach(input => {
    input.addEventListener('change', () => handlers.updateCustomization?.(
      input.dataset.customCheck,
      input.checked
    ));
  });
  root.querySelectorAll('[data-custom-widget-value]').forEach(input => {
    input.addEventListener('change', () => handlers.updateCustomization?.(
      input.dataset.customWidgetValue,
      input.value
    ));
  });
  root.querySelectorAll('[data-custom-widget-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setCustomWidgetTab?.(button.dataset.customWidgetTab));
  });
  root.querySelectorAll('[data-composition-layer]').forEach(button => {
    button.addEventListener('click', event => {
      const active = [...root.querySelectorAll('[data-composition-layer].active')].map(item => item.dataset.compositionLayer);
      const id = button.dataset.compositionLayer;
      const ids = event.shiftKey
        ? active.includes(id) ? active.filter(item => item !== id) : [...active, id]
        : [id];
      handlers.selectCompositionElements?.(
        root.querySelector('[data-custom-widget-select].active')?.dataset.widgetId || '',
        ids
      );
    });
  });
  root.querySelectorAll('[data-composition-add]').forEach(button => {
    button.addEventListener('click', () => handlers.addCompositionElement?.(button.dataset.compositionAdd));
  });
  root.querySelector('[data-composition-remove]')?.addEventListener('click', () => handlers.removeCompositionElements?.());
  root.querySelector('[data-composition-duplicate]')?.addEventListener('click', () => handlers.duplicateCompositionElements?.());
  root.querySelector('[data-composition-group]')?.addEventListener('click', () => handlers.groupCompositionElements?.(true));
  root.querySelector('[data-composition-ungroup]')?.addEventListener('click', () => handlers.groupCompositionElements?.(false));
  root.querySelectorAll('[data-composition-arrange]').forEach(button => {
    button.addEventListener('click', () => handlers.arrangeCompositionElements?.(button.dataset.compositionArrange));
  });
  root.querySelector('[data-composition-undo]')?.addEventListener('click', () => handlers.undoCustomWidget?.());
  root.querySelector('[data-composition-redo]')?.addEventListener('click', () => handlers.redoCustomWidget?.());
  root.querySelectorAll('[data-composition-canvas-number], [data-composition-canvas-color], [data-composition-canvas-value]').forEach(input => {
    input.addEventListener('change', () => {
      const path = input.dataset.compositionCanvasNumber || input.dataset.compositionCanvasColor || input.dataset.compositionCanvasValue;
      handlers.updateCompositionCanvas?.(path, input.type === 'range' || input.type === 'number' ? Number(input.value) : input.value);
    });
  });
  root.querySelectorAll('[data-composition-element-number], [data-composition-element-color], [data-composition-element-value], [data-composition-element-select], [data-composition-element-check]').forEach(input => {
    input.addEventListener('change', () => {
      const path = input.dataset.compositionElementNumber || input.dataset.compositionElementColor || input.dataset.compositionElementValue || input.dataset.compositionElementSelect || input.dataset.compositionElementCheck;
      const value = input.dataset.compositionElementCheck
        ? input.checked
        : input.type === 'range' || input.type === 'number' ? Number(input.value) : input.value;
      handlers.updateCompositionElement?.(input.dataset.compositionElementId, path, value);
    });
  });
  root.querySelectorAll('[data-composition-element-image]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        handlers.updateCompositionElement?.(input.dataset.compositionElementImage, 'asset', await readOptimizedImage(file, 1200));
      } catch (error) {
        handlers.setCustomizationStatus?.(error.message || '组件图片处理失败。');
      }
    });
  });
  root.querySelectorAll('[data-composition-background-transparent]').forEach(input => {
    input.addEventListener('change', () => handlers.updateCompositionElement?.(
      input.dataset.compositionBackgroundTransparent,
      'style.background',
      input.checked ? 'transparent' : '#ffffff'
    ));
  });
  root.querySelectorAll('[data-composition-system-value], [data-composition-system-number]').forEach(input => {
    input.addEventListener('change', () => handlers.updatePath?.(
      input.dataset.compositionSystemValue || input.dataset.compositionSystemNumber,
      input.dataset.compositionSystemNumber ? Number(input.value) : input.value
    ));
  });
  root.querySelectorAll('[data-chat-appearance-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setChatAppearanceTab?.(button.dataset.chatAppearanceTab));
  });
  root.querySelectorAll('[data-chat-appearance-preview]').forEach(button => {
    button.addEventListener('click', () => handlers.setChatAppearancePreview?.(button.dataset.chatAppearancePreview));
  });
  root.querySelectorAll('[data-character-appearance-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setCharacterAppearanceTab?.(button.dataset.characterAppearanceTab));
  });
  root.querySelectorAll('[data-character-appearance-preview]').forEach(button => {
    button.addEventListener('click', () => handlers.setCharacterAppearancePreview?.(button.dataset.characterAppearancePreview));
  });
  root.querySelectorAll('[data-settings-appearance-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setSettingsAppearanceTab?.(button.dataset.settingsAppearanceTab));
  });
  root.querySelectorAll('[data-settings-appearance-preview]').forEach(button => {
    button.addEventListener('click', () => handlers.setSettingsAppearancePreview?.(button.dataset.settingsAppearancePreview));
  });
  root.querySelectorAll('[data-memory-appearance-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setMemoryAppearanceTab?.(button.dataset.memoryAppearanceTab));
  });
  root.querySelectorAll('[data-memory-appearance-preview]').forEach(button => {
    button.addEventListener('click', () => handlers.setMemoryAppearancePreview?.(button.dataset.memoryAppearancePreview));
  });
  root.querySelectorAll('[data-music-appearance-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setMusicAppearanceTab?.(button.dataset.musicAppearanceTab));
  });
  root.querySelectorAll('[data-music-appearance-preview]').forEach(button => {
    button.addEventListener('click', () => handlers.setMusicAppearancePreview?.(button.dataset.musicAppearancePreview));
  });
  root.querySelectorAll('[data-companion-appearance-tab]').forEach(button => {
    button.addEventListener('click', () => handlers.setCompanionAppearanceTab?.(button.dataset.companionAppearanceTab));
  });
  root.querySelectorAll('[data-companion-appearance-preview]').forEach(button => {
    button.addEventListener('click', () => handlers.setCompanionAppearancePreview?.(button.dataset.companionAppearancePreview));
  });
  root.querySelectorAll('[data-custom-widget-template]').forEach(button => {
    button.addEventListener('click', () => handlers.addCustomWidget?.(button.dataset.customWidgetTemplate));
  });
  root.querySelectorAll('[data-custom-widget-select]').forEach(button => {
    button.addEventListener('click', () => handlers.selectCustomWidget?.(Number(button.dataset.customWidgetSelect)));
  });
  root.querySelectorAll('[data-custom-widget-code-enabled]').forEach(input => {
    input.addEventListener('change', () => handlers.setCustomWidgetCodeMode?.(
      Number(input.dataset.customWidgetCodeEnabled),
      input.checked
    ));
  });
  root.querySelectorAll('[data-custom-widget-permission]').forEach(input => {
    input.addEventListener('change', () => handlers.toggleCustomWidgetPermission?.(
      input.dataset.customWidgetPermission,
      input.value,
      input.checked
    ));
  });
  root.querySelectorAll('[data-custom-widget-code]').forEach(input => {
    input.addEventListener('input', () => {
      const index = Number(input.dataset.customWidgetCodeIndex);
      handlers.updateCustomization?.(
        `widgets.${index}.code.${input.dataset.customWidgetCode}`,
        input.value,
        { noRender: true }
      );
      const code = {};
      root.querySelectorAll('[data-custom-widget-code]').forEach(editor => {
        code[editor.dataset.customWidgetCode] = editor.value;
      });
      const result = validateCustomWidgetCode(code);
      const status = root.querySelector('[data-custom-widget-code-status]');
      if (status) {
        status.textContent = result.valid
          ? '代码安全检查通过，右侧正在沙箱中预览。'
          : result.errors[0];
        status.className = `custom-validation ${result.valid ? 'is-valid' : 'is-error'}`;
      }
    });
  });
  root.querySelectorAll('[data-custom-css]').forEach(input => {
    input.addEventListener('input', () => {
      const result = validateCustomCss(input.value);
      const status = root.querySelector('[data-custom-css-status]');
      if (status) {
        status.textContent = result.valid ? 'CSS 安全检查通过' : result.errors[0];
        status.className = `custom-validation ${result.valid ? 'is-valid' : 'is-error'}`;
      }
      handlers.updateCustomization?.(`appThemes.${input.dataset.customCss}.css`, input.value, {
        noRender: true,
        valid: result.valid
      });
    });
  });
  root.querySelector('[data-custom-global-css]')?.addEventListener('input', event => {
    const input = event.currentTarget;
    const result = validateCustomCss(input.value);
    const status = root.querySelector('[data-custom-css-status]');
    if (status) {
      status.textContent = result.valid ? 'CSS 安全检查通过' : result.errors[0];
      status.className = `custom-validation ${result.valid ? 'is-valid' : 'is-error'}`;
    }
    handlers.updateCustomization?.('css', input.value, {
      noRender: true,
      valid: result.valid
    });
  });
  root.querySelectorAll('[data-custom-icon]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        handlers.updateCustomization?.(
          `iconPack.icons.${input.dataset.customIcon}`,
          await readSquareImage(file)
        );
      } catch (error) {
        handlers.setCustomizationStatus?.(error.message || '图标处理失败。');
      }
    });
  });
  root.querySelectorAll('[data-custom-icon-remove]').forEach(button => {
    button.addEventListener('click', () => handlers.removeCustomizationPath?.(
      `iconPack.icons.${button.dataset.customIconRemove}`
    ));
  });
  root.querySelectorAll('[data-custom-app-image]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const appId = input.dataset.customAppImage;
      const slot = input.dataset.customAppImageSlot;
      try {
        const image = slot === 'backgroundImage'
          ? await readOptimizedImage(file, 1600)
          : await readSquareImage(file, 512);
        handlers.updateCustomization?.(`appThemes.${appId}.media.${slot}`, image);
      } catch (error) {
        handlers.setCustomizationStatus?.(error.message || 'App 图片处理失败。');
      }
    });
  });
  root.querySelectorAll('[data-custom-app-image-remove]').forEach(button => {
    button.addEventListener('click', () => handlers.removeCustomizationPath?.(
      `appThemes.${button.dataset.customAppImageRemove}.media.${button.dataset.customAppImageSlot}`
    ));
  });
  root.querySelectorAll('[data-custom-widget-remove]').forEach(button => {
    button.addEventListener('click', () => handlers.removeCustomWidget?.(
      Number(button.dataset.customWidgetRemove)
    ));
  });
  root.querySelectorAll('[data-custom-widget-image]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        handlers.updateCustomization?.(
          `widgets.${Number(input.dataset.customWidgetImage)}.image`,
          await readOptimizedImage(file, 1000)
        );
      } catch (error) {
        handlers.setCustomizationStatus?.(error.message || '组件图片处理失败。');
      }
    });
  });
  root.querySelector('[data-custom-package-file]')?.addEventListener('change', event => {
    const file = event.currentTarget.files?.[0];
    if (file) handlers.inspectThemePackage?.(file);
  });
  root.querySelector('[data-custom-package-apply]')?.addEventListener('click', () => {
    handlers.applyImportedThemePackage?.();
  });
  root.querySelector('[data-custom-package-export]')?.addEventListener('click', () => {
    handlers.exportThemePackage?.();
  });
}
