import { getEnabledApps } from '../system/appRegistry.js?v=app-config-62';
import { iconMap } from '../system/icons.js';
import { fontStyles, phoneFrames } from '../system/options.js';
import { escapeHtml } from '../system/html.js';
import { APP_UI_THEMES, getAppIcon, getAppLook } from '../system/appAppearance.js?v=app-config-71';
import { WIDGET_CATALOG } from '../system/widgetCatalog.js';
import {
  readOptimizedImage,
  readSquareImage
} from '../services/imageUploadService.js?v=app-config-60';
import {
  bindCustomizationDrawer
} from './CustomizationDrawer.js?v=app-config-83';

const colors = ['#7fb59a', '#6b9ec9', '#9a88b8', '#d39c77', '#d98fa5'];

const iconSets = [
  { id: 'soft', label: '柔光圆角', desc: '保留现在的浅色圆角底，适合基础版。' },
  { id: 'glass', label: '玻璃拟态', desc: '图标更透明，适合桌面挂件感。' },
  { id: 'sticker', label: '贴纸风', desc: '边框更明显，像手账贴纸。' },
  { id: 'mono', label: '极简线框', desc: '弱化装饰，更像系统工具。' }
];

const widgetOptions = WIDGET_CATALOG.map(widget => ({
  ...widget,
  path: `theme.widgets.${widget.id}.enabled`
}));

const widgetStyles = [
  { id: 'colorful', label: '彩色卡片' },
  { id: 'glass', label: '通透玻璃' },
  { id: 'minimal', label: '黑白极简' }
];

function getPath(source, path) {
  return path.split('.').reduce((cursor, key) => cursor?.[key], source);
}

function renderSwitch(path, checked) {
  return `
    <label class="feature-switch" aria-label="开关">
      <input type="checkbox" data-beautify-toggle="${path}" ${checked ? 'checked' : ''} />
      <span class="feature-switch-track"></span>
    </label>
  `;
}

function renderImagePicker(widget, config) {
  if (!widget.imagePath) return '';
  const value = getPath(config, widget.imagePath);
  return `
    <div class="beautify-upload">
      <div class="beautify-upload-preview">
        ${value
          ? `<img src="${escapeHtml(value)}" alt="" />`
          : '<span>图片位</span>'}
      </div>
      <label class="beautify-upload-button">
        上传图片
        <input type="file" accept="image/*" data-beautify-file="${widget.imagePath}" />
      </label>
    </div>
  `;
}

function renderWidgetFields(widget, config) {
  if (widget.id !== 'weather') return '';
  const weather = config.theme.widgets.weather;
  return `
    <div class="widget-inline-fields">
      <label><span>城市名</span><input type="text" value="${escapeHtml(weather.city || '')}" data-beautify-value="theme.widgets.weather.city" /></label>
      <label><span>纬度</span><input type="number" step="0.0001" value="${Number(weather.latitude)}" data-beautify-number="theme.widgets.weather.latitude" /></label>
      <label><span>经度</span><input type="number" step="0.0001" value="${Number(weather.longitude)}" data-beautify-number="theme.widgets.weather.longitude" /></label>
    </div>
  `;
}

function renderWidgetDemo(widget) {
  const content = {
    clock: '<b>12:36</b><small>7月23日</small>',
    weather: '<b>24°</b><small>晴间多云</small>',
    vinyl: '<i class="widget-demo-disc"></i><small>正在播放</small>',
    photo: '<i class="widget-demo-photo"></i><small>今日照片</small>',
    calendar: '<small>星期四</small><b>23</b>',
    anniversary: '<i class="widget-demo-heart">♥</i><b>365<small>天</small></b>',
    characterStatus: '<i class="widget-demo-avatar">满</i><small>正在想你</small>',
    dailyNote: '<b>“</b><small>今天也会陪着你</small>',
    mood: '<span class="widget-demo-bars"><i></i><i></i><i></i><i></i></span><small>这周心情</small>',
    quickActions: '<span class="widget-demo-actions"><i>✦</i><i>♪</i><i>＋</i><i>♡</i></span>'
  };
  return `<span class="widget-config-demo widget-config-demo-${widget.tone}">${content[widget.id] || ''}</span>`;
}

function renderAppearanceTabs(activePage) {
  return `
    <nav class="beautify-substeps" aria-label="美化步骤">
      <button class="${activePage === 'phone' ? 'active' : ''}" type="button" data-appearance-page="phone">
        <span>1</span>
        整机美化
      </button>
      <button class="${activePage === 'apps' ? 'active' : ''}" type="button" data-appearance-page="apps">
        <span>2</span>
        App 美化
      </button>
    </nav>
  `;
}

function renderPhoneAppearance(config) {
  const activeIconSet = config.theme.iconSet || 'soft';
  return `
    <div class="beautify-page" data-beautify-page="phone">
      <div class="field">
        <span>基础样式</span>
        <div class="chip-row">
          ${fontStyles.map(item => `
            <button class="chip ${config.theme.fontStyle === item.id ? 'active' : ''}" type="button" data-set="theme.fontStyle" data-value="${item.id}">${item.label}</button>
          `).join('')}
          <button class="chip custom-entry-chip" type="button" data-open-custom="basic">+ 自定义</button>
        </div>
      </div>
      <div class="field">
        <span>手机壳</span>
        <div class="chip-row">
          ${phoneFrames.map(item => `
            <button class="chip ${config.theme.phoneFrame === item.id ? 'active' : ''}" type="button" data-set="theme.phoneFrame" data-value="${item.id}">${item.label}</button>
          `).join('')}
          <button class="chip custom-entry-chip" type="button" data-open-custom="shell">+ 自定义</button>
        </div>
      </div>
      <div class="field">
        <span>主色</span>
        <div class="swatch-row">
          ${colors.map(color => `
            <button class="swatch ${config.theme.primaryColor.toLowerCase() === color ? 'active' : ''}" type="button" data-set="theme.primaryColor" data-value="${color}" style="--swatch:${color}" aria-label="${color}"></button>
          `).join('')}
          <button class="swatch custom-swatch" type="button" data-open-custom="palette" aria-label="自定义配色">+</button>
        </div>
      </div>

      <div class="beautify-block">
        <div class="setting-group-title">
          <strong>图标套装</strong>
          <small>先提供几套预设图标表现，后面可以继续扩展成自定义上传每个 App 图标。</small>
        </div>
        <div class="icon-style-grid">
          ${iconSets.map(item => `
            <button class="icon-style-card ${activeIconSet === item.id ? 'active' : ''}" type="button" data-set="theme.iconSet" data-value="${item.id}">
              <span class="icon-demo icon-demo-${item.id}"><img src="${iconMap.chat}" alt="" /></span>
              <strong>${item.label}</strong>
              <small>${item.desc}</small>
            </button>
          `).join('')}
          <button class="icon-style-card custom-entry-card" type="button" data-open-custom="iconPack">
            <span class="custom-entry-symbol">+</span>
            <strong>自定义图标套装</strong>
            <small>分别上传并映射每一个 App 图标。</small>
          </button>
        </div>
      </div>

      <div class="beautify-block">
        <div class="setting-group-title">
          <strong>小组件系统</strong>
          <small>选择组件后会立即出现在右侧桌面，可以像手机图标一样拖动排列。</small>
        </div>
        <div class="widget-style-picker" aria-label="小组件外观">
          ${widgetStyles.map(style => `
            <button class="chip ${config.theme.widgetStyle === style.id ? 'active' : ''}" type="button" data-set="theme.widgetStyle" data-value="${style.id}">${style.label}</button>
          `).join('')}
          <button class="chip custom-entry-chip" type="button" data-open-custom="desktop">+ 自定义桌面</button>
        </div>
        <div class="widget-config-list">
          ${widgetOptions.map(widget => `
            <article class="widget-config-row ${getPath(config, widget.path) ? 'active' : ''}">
              ${renderWidgetDemo(widget)}
              <div class="widget-config-copy">
                <strong>${widget.name}</strong>
                <small>${widget.desc} · ${widget.size}</small>
              </div>
              ${renderSwitch(widget.path, Boolean(getPath(config, widget.path)))}
              ${renderImagePicker(widget, config)}
              ${renderWidgetFields(widget, config)}
            </article>
          `).join('')}
          <button class="widget-config-row custom-widget-entry" type="button" data-open-custom="widgets">
            <span class="custom-entry-symbol">+</span>
            <span><strong>自定义小组件</strong><small>选择数据来源、显示形式和点击动作。</small></span>
          </button>
        </div>
      </div>

      <div class="flow-actions">
        <button type="button" data-next-step="apps">上一步</button>
        <button class="primary-action" type="button" data-appearance-page="apps">下一步：App 美化</button>
      </div>
    </div>
  `;
}

function renderAppAppearance(config, selectedAppId) {
  const apps = getEnabledApps(config);
  const selectedApp = apps.find(app => app.id === selectedAppId) || apps[0];
  const selectedLook = selectedApp ? getAppLook(config, selectedApp.id) : null;
  const selectedIcon = selectedApp ? getAppIcon(config, selectedApp) : '';

  return `
    <div class="beautify-page" data-beautify-page="apps">
      <div class="beautify-app-picker" role="tablist" aria-label="选择要美化的 App">
        ${apps.map(app => `
          <button
            class="beautify-app-choice ${selectedApp?.id === app.id ? 'active' : ''}"
            type="button"
            data-appearance-app="${app.id}"
            role="tab"
            aria-selected="${selectedApp?.id === app.id}"
          >
            <span class="beautify-app-icon"><img src="${escapeHtml(getAppIcon(config, app))}" alt="" /></span>
            <span>${escapeHtml(app.name)}</span>
          </button>
        `).join('')}
      </div>

      ${selectedApp ? `
        <article class="beautify-app-editor">
          <div class="beautify-app-editor-heading">
            <span class="beautify-app-icon beautify-app-icon-large"><img src="${escapeHtml(selectedIcon)}" alt="" /></span>
            <span>
              <small>正在美化</small>
              <strong>${escapeHtml(selectedApp.name)} App</strong>
            </span>
            <button type="button" data-open-phone-app="${selectedApp.id}">在右侧打开</button>
          </div>
          <div class="app-look-section">
            <div class="setting-group-title">
              <strong>1. 图标美化</strong>
              <small>上传方形图片后，桌面和底部 Dock 会同步替换，并优先于整机图标套装。</small>
            </div>
            <div class="app-icon-uploader">
              <span class="app-icon-preview"><img src="${escapeHtml(selectedIcon)}" alt="" /></span>
              <label class="beautify-upload-button">
                上传图标
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-app-icon-upload="${selectedApp.id}" />
              </label>
              <button type="button" data-app-icon-reset="${selectedApp.id}" ${selectedLook.icon.mode === 'preset' ? 'disabled' : ''}>恢复默认</button>
            </div>
            <p class="app-icon-upload-hint" data-app-icon-upload-status>支持 PNG、JPG、WebP、GIF，最大 5MB；上传后自动居中裁成方形。</p>
          </div>

          <div class="app-look-section">
            <div class="setting-group-title app-theme-heading">
              <span>
                <strong>2. 界面主题</strong>
                <small>主题会改变 App 的顶部栏、列表、气泡、按钮和设置分组。</small>
              </span>
              <button type="button" data-apply-app-theme="${selectedLook.uiTheme}">应用到全部 App</button>
            </div>
            <div class="app-theme-grid">
              ${APP_UI_THEMES.map(theme => `
                <button
                  class="app-theme-card app-theme-card-${theme.id} ${selectedLook.uiTheme === theme.id ? 'active' : ''}"
                  type="button"
                  data-app-theme="${theme.id}"
                  data-app-id="${selectedApp.id}"
                >
                  <span class="app-theme-demo" aria-hidden="true">
                    <i></i><i></i><i></i>
                  </span>
                  <strong>${theme.label}</strong>
                  <small>${theme.desc}</small>
                </button>
              `).join('')}
              <button
                class="app-theme-card custom-entry-card"
                type="button"
                data-open-custom="app"
                data-custom-app="${selectedApp.id}"
              >
                <span class="custom-entry-symbol">+</span>
                <strong>自定义主题</strong>
                <small>编辑变量与当前 App 的限定 CSS。</small>
              </button>
            </div>
          </div>
        </article>
      ` : ''}

      <div class="flow-actions">
        <button type="button" data-appearance-page="phone">上一步：整机美化</button>
        <button class="primary-action" type="button" data-next-step="save">下一步：完成</button>
      </div>
    </div>
  `;
}

export function renderAppearancePanel(config, ui = {}) {
  const activePage = ui.appearancePage === 'apps' ? 'apps' : 'phone';
  const apps = getEnabledApps(config);
  return `
    <section class="panel-section beautify-panel">
      <div class="section-heading">
        <span>第二步</span>
        <h2>美化小手机</h2>
        <p>${activePage === 'phone'
          ? '先统一调整整台小手机的样式、图标和桌面小组件。'
          : '再选择一个 App，单独设计它自己的界面。'}</p>
      </div>
      <div class="beautify-package-toolbar">
        <span>可视化美化</span>
        <button type="button" data-open-custom="packages">导入 / 导出主题包</button>
      </div>
      ${renderAppearanceTabs(activePage)}
      ${activePage === 'phone'
        ? renderPhoneAppearance(config)
        : renderAppAppearance(config, ui.appearanceAppId)}
    </section>
  `;
}

export function bindAppearancePanel(root, handlers) {
  bindCustomizationDrawer(root, handlers);
  root.querySelectorAll('[data-appearance-page]').forEach(button => {
    button.addEventListener('click', () => handlers.setAppearancePage?.(button.dataset.appearancePage));
  });

  root.querySelectorAll('[data-appearance-app]').forEach(button => {
    button.addEventListener('click', () => handlers.selectAppearanceApp?.(button.dataset.appearanceApp));
  });

  root.querySelectorAll('[data-app-theme]').forEach(button => {
    button.addEventListener('click', () => {
      handlers.setAppTheme?.(button.dataset.appId, button.dataset.appTheme);
    });
  });

  root.querySelectorAll('[data-apply-app-theme]').forEach(button => {
    button.addEventListener('click', () => handlers.applyAppThemeToAll?.(button.dataset.applyAppTheme));
  });

  root.querySelectorAll('[data-app-icon-reset]').forEach(button => {
    button.addEventListener('click', () => handlers.resetAppIcon?.(button.dataset.appIconReset));
  });

  root.querySelectorAll('[data-app-icon-upload]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const status = root.querySelector('[data-app-icon-upload-status]');
      if (status) status.textContent = '正在裁剪和压缩图标…';
      try {
        const image = await readSquareImage(file);
        handlers.updateAppIcon?.(input.dataset.appIconUpload, image);
      } catch (error) {
        input.value = '';
        if (status) status.textContent = error.message || '图标处理失败。';
      }
    });
  });

  root.querySelectorAll('[data-set]').forEach(button => {
    button.addEventListener('click', () => handlers.updatePath(button.dataset.set, button.dataset.value));
  });

  root.querySelectorAll('[data-beautify-toggle]').forEach(input => {
    input.addEventListener('change', () => handlers.updatePath(input.dataset.beautifyToggle, input.checked));
  });

  root.querySelectorAll('[data-beautify-value]').forEach(input => {
    input.addEventListener('change', () => handlers.updatePath(input.dataset.beautifyValue, input.value));
  });

  root.querySelectorAll('[data-beautify-number]').forEach(input => {
    input.addEventListener('change', () => handlers.updatePath(input.dataset.beautifyNumber, Number(input.value)));
  });

  root.querySelectorAll('[data-beautify-file]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      input.setCustomValidity('');
      try {
        const image = await readOptimizedImage(file);
        handlers.updatePath(input.dataset.beautifyFile, image);
      } catch (error) {
        input.value = '';
        input.setCustomValidity(error.message || '图片处理失败。');
        input.reportValidity();
      }
    });
  });

  root.querySelectorAll('[data-open-phone-app]').forEach(button => {
    button.addEventListener('click', () => handlers.openPhoneApp?.(button.dataset.openPhoneApp));
  });
}
