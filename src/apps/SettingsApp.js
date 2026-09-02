import { escapeHtml } from '../system/html.js';
import { fontStyles, phoneFrames } from '../system/options.js';
import { renderStatusBar } from '../system/StatusBar.js';
import { getAppTheme } from '../system/appAppearance.js?v=app-config-17';
import { getCharacterAvatar } from '../system/icons.js?v=app-config-61';
import { getAiProvider, selectedAiProviders } from '../config/aiProviderCatalog.js?v=app-config-35';
import {
  configureAiProvider,
  getAiProviderStatuses,
  testAiProvider
} from '../services/aiService.js?v=app-config-57';
import { friendlyAiError } from '../services/aiErrors.js?v=app-config-36';
import { activeCharacter } from './appData.js?v=app-config-38';
import {
  characterByScope,
  characterConfigPath,
  roleProfileId
} from '../services/aiProfileScope.js?v=app-config-45';
import {
  checkQrLogin,
  clearMusicCookie,
  musicBaseUrl,
  normalizeMusicApiUrl,
  startQrLogin,
  testMusicApi,
  usesBuiltInMusicGateway
} from '../services/musicService.js?v=app-config-91';
import { searchWeatherCity } from '../services/weatherService.js?v=app-config-52';
import { integrationRecordSummary } from '../services/companionPolicyService.js';

const colors = ['#7fb59a', '#6b9ec9', '#9a88b8', '#d39c77', '#d98fa5'];

function settingInput(path, label, value, options = {}) {
  return `
    <label class="settings-control-row">
      <span><strong>${label}</strong>${options.desc ? `<small>${options.desc}</small>` : ''}</span>
      <input
        type="${options.type || 'text'}"
        value="${escapeHtml(String(value ?? ''))}"
        placeholder="${escapeHtml(options.placeholder || '')}"
        ${options.step ? `step="${options.step}"` : ''}
        data-settings-${options.type === 'number' ? 'number' : 'value'}="${path}"
      />
    </label>
  `;
}

function settingToggle(path, label, checked, desc = '') {
  return `
    <label class="settings-control-row settings-toggle-row">
      <span><strong>${label}</strong>${desc ? `<small>${desc}</small>` : ''}</span>
      <input type="checkbox" data-settings-toggle="${path}" ${checked ? 'checked' : ''} />
      <i></i>
    </label>
  `;
}

function settingSelect(path, label, value, options) {
  return `
    <label class="settings-control-row">
      <span><strong>${label}</strong></span>
      <select data-settings-select="${path}">
        ${options.map(option => `<option value="${option.value}" ${value === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
      </select>
    </label>
  `;
}

function settingsGroup(icon, title, subtitle, content, className = '') {
  return `
    <section class="phone-setting-group settings-integration-group ${className}">
      <header class="settings-group-header">
        <i>${icon}</i>
        <span><strong>${title}</strong><small>${subtitle}</small></span>
      </header>
      <div class="settings-group-controls">${content}</div>
    </section>
  `;
}

const SETTINGS_CATEGORIES = [
  { id: 'runtime', icon: '⌂', title: '安装与运行', subtitle: '安装方式、运行环境与启动检查' },
  { id: 'services', icon: '◎', title: 'AI 与在线服务', subtitle: '大模型、网易云音乐与天气' },
  { id: 'appearance', icon: '◐', title: '外观与显示', subtitle: '字体、手机壳和整机主色' },
  { id: 'apps', icon: '▦', title: 'App 与陪伴数据', subtitle: '自定义 App、记忆、日记与问候' },
  { id: 'data', icon: '⇅', title: '备份与安全', subtitle: '备份、迁移和重置整台小手机' }
];

function renderSettingsCategories(config, osState = {}) {
  const aiReady = Object.values(config.aiProviders?.profiles || {}).some(profile => profile?.model);
  const categoryStatus = {
    runtime: osState.installAvailable ? '可安装' : '浏览器运行',
    services: aiReady || musicBaseUrl(config) ? '已配置' : '待配置',
    appearance: '当前主题',
    apps: `${(osState.customApps || []).length} 个扩展`,
    data: `${Number(osState.storageStatus?.backupCount) || 0} 份备份`
  };
  return `<div class="settings-category-list">${SETTINGS_CATEGORIES.map(category => `
    <button type="button" class="settings-category-row" data-settings-category="${category.id}">
      <i>${category.icon}</i>
      <span><strong>${category.title}</strong><small>${category.subtitle}</small></span>
      <em>${categoryStatus[category.id]}</em><b>›</b>
    </button>
  `).join('')}</div>`;
}

function renderSettingsCategory(page, config, osState) {
  if (page === 'runtime') return `${renderPhoneManagement(osState)}${renderRuntimeInfo(config, osState)}${renderStartupHealth(osState)}`;
  if (page === 'services') return `${config.apps.settings.apiProfiles ? renderAISettings(config, osState) : ''}${renderMusicSettings(config, osState)}${renderWeatherSettings(config)}`;
  if (page === 'appearance') return config.apps.settings.themeControls ? renderAppearanceSettings(config) : '<p class="settings-security-note">外观控制已在工坊中关闭。</p>';
  if (page === 'apps') return `${renderProactiveSettings(config)}${renderIntegrationSettings(config)}${renderCustomAppSettings(osState)}${renderMemorySettings(config)}${renderCompanionDataSettings(config)}`;
  if (page === 'data') return `${renderDataSettings(config)}${renderDangerSettings()}`;
  return renderSettingsCategories(config, osState);
}

function renderProactiveSettings(config) {
  const policy = config.companion?.proactive?.defaults || {};
  return settingsGroup('◌', '主动陪伴', '全局默认规则；每个角色还可以单独覆盖', `
    ${settingToggle('companion.proactive.defaults.enabled', '主动陪伴总开关', policy.enabled !== false, '只在网页打开或恢复前台时执行，不会在网页关闭时推送。')}
    ${settingToggle('companion.proactive.defaults.emotionFollowUp', '情绪回访', policy.emotionFollowUp !== false, '用户提到明显情绪后，稍后自然问候一次。')}
    ${settingInput('companion.proactive.defaults.emotionFollowUpMinutes', '回访等待时间', policy.emotionFollowUpMinutes || 30, { type: 'number', desc: '5–720 分钟' })}
    ${settingInput('companion.proactive.defaults.dailyLimit', '每个角色每天最多', policy.dailyLimit || 3, { type: 'number', desc: '包括普通关怀和纪念日提醒' })}
    ${settingToggle('companion.proactive.defaults.suppressWhileUnanswered', '上一条未回复时不连续关怀', policy.suppressWhileUnanswered !== false, '纪念日提醒仍可发送，但也受每日上限控制。')}
    ${settingToggle('companion.proactive.defaults.quietHours.enabled', '启用安静时段', policy.quietHours?.enabled !== false)}
    ${settingInput('companion.proactive.defaults.quietHours.start', '安静时段开始', policy.quietHours?.start || '23:00', { type: 'time' })}
    ${settingInput('companion.proactive.defaults.quietHours.end', '安静时段结束', policy.quietHours?.end || '08:00', { type: 'time' })}
    ${settingToggle('companion.proactive.defaults.morningGreeting', '早安问候', policy.morningGreeting !== false)}
    ${settingToggle('companion.proactive.defaults.nightGreeting', '晚安问候', policy.nightGreeting !== false)}
    ${settingToggle('companion.proactive.defaults.diaryResponse', '日记回应', policy.diaryResponse !== false, '还需单独授权“日记参与陪伴”。')}
    ${settingToggle('companion.proactive.defaults.anniversaryReminder', '纪念日提醒', policy.anniversaryReminder !== false, '还需单独授权“纪念日参与陪伴”。')}
  `);
}

function renderIntegrationSettings(config) {
  const items = [
    ['musicContext', '音乐参与聊天', '读取最近播放歌曲，作为本轮聊天的可选上下文，不自动发消息。'],
    ['diaryCompanion', '日记参与陪伴', '读取日记，生成待确认记忆和延迟回应。'],
    ['anniversaryCompanion', '纪念日参与陪伴', '读取纪念日，生成待确认记忆和聊天提醒。'],
    ['moodAwareGreetings', '心情影响问候', '读取最近心情，只用于调整早安和晚安语气。'],
    ['relationshipDesktop', '关系状态同步桌面', '让桌面角色状态和关系组件读取互动信号。']
  ];
  return settingsGroup('↔', 'App 联动授权', '启用 App 不等于授权；五项默认全部关闭', items.map(([key, label, desc]) => {
    const summary = integrationRecordSummary(config, key);
    const count = summary.events + summary.tasks + summary.memories;
    return `${settingToggle(`companion.integrations.${key}`, label, config.companion?.integrations?.[key] === true, desc)}
      ${count ? `<button class="settings-secondary-button" type="button" data-integration-clean="${key}">清理该联动产生的 ${count} 条记录</button>` : ''}`;
  }).join(''));
}

function renderCustomAppSettings(osState = {}) {
  const apps = osState.customApps || [];
  return settingsGroup('▦', '自定义 App 管理', apps.length ? `已安装 ${apps.length} 个自定义 App` : '尚未安装自定义 App', apps.length
    ? apps.map(app => `<div class="custom-app-settings-item"><div class="settings-control-row custom-app-settings-row"><span><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.manifest?.version || '')} · ${app.enabled === false ? '已禁用' : '已启用'}</small></span><input type="checkbox" data-settings-custom-app-toggle="${escapeHtml(app.id)}" ${app.enabled !== false ? 'checked' : ''}/><i></i><button type="button" data-settings-custom-app-remove="${escapeHtml(app.id)}">卸载</button></div><details><summary>权限与联网域名</summary><div class="custom-app-permission-list">${(app.manifest?.permissions || []).map(permission => `<label><input type="checkbox" data-settings-custom-app-permission="${escapeHtml(app.id)}" value="${escapeHtml(permission)}" ${(app.permissions || []).includes(permission) ? 'checked' : ''}/>${escapeHtml(permission)}</label>`).join('') || '<small>未申请系统权限</small>'}${app.manifest?.networkOrigins?.length ? `<small>联网：${escapeHtml(app.manifest.networkOrigins.join('、'))}</small>` : ''}</div></details></div>`).join('')
    : '<p class="settings-security-note">到工坊“功能”页导入 `.lovephone-app.zip` 后，会显示在这里和手机桌面。</p>', 'custom-apps-settings');
}

function renderAppearanceSettings(config) {
  return settingsGroup('◐', '外观与显示', '字体、手机壳和整机主色', `
    <div class="settings-choice-block">
      <span>字体</span>
      <div class="phone-chip-row">
        ${fontStyles.map(item => `
          <button class="phone-chip ${config.theme.fontStyle === item.id ? 'active' : ''}" type="button" data-phone-set="theme.fontStyle" data-value="${item.id}">${item.label}</button>
        `).join('')}
      </div>
    </div>
    <div class="settings-choice-block">
      <span>手机壳</span>
      <div class="phone-chip-row">
        ${phoneFrames.map(item => `
          <button class="phone-chip ${config.theme.phoneFrame === item.id ? 'active' : ''}" type="button" data-phone-set="theme.phoneFrame" data-value="${item.id}">${item.label}</button>
        `).join('')}
      </div>
    </div>
    <div class="settings-choice-block">
      <span>主色</span>
      <div class="phone-color-row">
        ${colors.map(color => `
          <button class="phone-color ${config.theme.primaryColor.toLowerCase() === color ? 'active' : ''}" type="button" data-phone-set="theme.primaryColor" data-value="${color}" style="--swatch:${color}" aria-label="${color}"></button>
        `).join('')}
      </div>
    </div>
  `);
}

function aiScopeDetails(config, osState = {}) {
  const requestedScope = config.apps?.settings?.perRoleApi
    ? (osState.aiSettingsScopeId || 'global')
    : 'global';
  const character = characterByScope(config, requestedScope);
  const scopeId = character ? requestedScope : 'global';
  const providerId = character?.aiProviderId || config.aiProviders?.activeId;
  const profileId = character ? roleProfileId(character) : providerId;
  const profile = character
    ? character.aiProfiles?.[providerId] || {}
    : config.aiProviders?.profiles?.[providerId] || {};
  return { scopeId, character, providerId, profileId, profile };
}

function renderAISettings(config, osState = {}) {
  const onlineRuntime = !['127.0.0.1', 'localhost'].includes(globalThis.location?.hostname || '');
  const providers = selectedAiProviders(config);
  const scope = aiScopeDetails(config, osState);
  const activeId = providers.some(provider => provider.id === scope.providerId)
    ? scope.providerId
    : providers[0]?.id;
  const provider = getAiProvider(activeId);
  const profile = scope.character
    ? scope.character.aiProfiles?.[activeId] || {}
    : config.aiProviders?.profiles?.[activeId] || {};
  const profileId = scope.character ? roleProfileId(scope.character) : activeId;
  const profileStatus = osState.aiProfileStatuses?.[profileId];
  const providerStatus = osState.aiProviderStatuses?.[activeId];
  const connected = Boolean(
    (profileStatus?.configured && profileStatus.providerId === activeId)
    || (!scope.character && providerStatus?.configured)
  );
  const statusText = osState.aiConnectionMessage
    || (connected ? `已连接 · ${profileStatus?.model || providerStatus?.model || profile.model || '等待模型'}` : '尚未连接');
  const characters = [config.character, ...(config.characters || [])];
  const scopeName = scope.character ? scope.character.name : '全局默认';

  if (!provider) {
    return settingsGroup('AI', 'AI 与模型', '左侧尚未选择服务商', `
      <p class="settings-security-note">请先在左侧“设置 App 配置”中勾选至少一个 AI 服务商。</p>
    `, 'needs-config');
  }

  return settingsGroup('AI', 'AI 与模型', statusText, `
    ${settingInput('aiProviders.bridgeUrl', 'AI 网关地址', config.aiProviders?.bridgeUrl, {
      type: 'url',
      placeholder: 'https://your-ai-gateway.example',
      desc: '开源版需填写自己部署的网关；如果当前网站已内置网关，可以留空。'
    })}
    ${config.apps?.settings?.perRoleApi ? `
      <label class="settings-control-row ai-scope-row">
        <span><strong>配置对象</strong><small>每个角色可以拥有完全独立的 Key 和模型</small></span>
        <select data-ai-scope-select>
          <option value="global" ${scope.scopeId === 'global' ? 'selected' : ''}>全局默认</option>
          ${characters.map(character => `
            <option value="role:${escapeHtml(character.id)}" ${scope.character?.id === character.id ? 'selected' : ''}>
              角色 · ${escapeHtml(character.name)}
            </option>
          `).join('')}
        </select>
      </label>
    ` : ''}
    <div class="ai-scope-summary">
      <span><strong>${escapeHtml(scopeName)}</strong><small>${scope.character ? '独立凭据，不会与其他角色共用' : '供未启用独立配置的角色使用'}</small></span>
      <b>${scope.character ? '角色配置' : '全局配置'}</b>
    </div>
    <label class="settings-control-row">
      <span><strong>服务商</strong><small>这里只显示左侧启用的选项</small></span>
      <select data-ai-provider-select>
        ${providers.map(item => `<option value="${item.id}" ${item.id === activeId ? 'selected' : ''}>${item.name}</option>`).join('')}
      </select>
    </label>
    <label class="settings-control-row">
      <span><strong>API Key</strong><small>${onlineRuntime ? '仅保存在当前浏览器会话，关闭浏览器后需重新填写' : `${scope.character ? '仅用于这个角色' : '仅用于全局默认'}，刷新页面不会回显`}</small></span>
      <input
        type="password"
        data-ai-api-key
        autocomplete="new-password"
        placeholder="${provider.apiKeyOptional ? '本地模型可不填' : '粘贴 API Key'}"
      />
    </label>
    <label class="settings-control-row">
      <span><strong>模型名称</strong><small>可以从建议中选择，也可以直接输入</small></span>
      <input
        type="text"
        data-ai-model
        list="ai-model-suggestions"
        value="${escapeHtml(profile.model || provider.models[0] || '')}"
        placeholder="输入模型 ID"
      />
      <datalist id="ai-model-suggestions">
        ${provider.models.map(model => `<option value="${escapeHtml(model)}"></option>`).join('')}
      </datalist>
    </label>
    ${provider.customBaseUrl ? `
      <label class="settings-control-row">
        <span><strong>接口地址</strong><small>填写到 /v1 层级，网关会调用 /chat/completions</small></span>
        <input type="url" data-ai-base-url value="${escapeHtml(profile.baseUrl || '')}" placeholder="https://api.example.com/v1" />
      </label>
    ` : ''}
    <div class="ai-connection-actions">
      <button type="button" data-ai-connect>连接并测试</button>
      <span data-ai-live-status>${escapeHtml(statusText)}</span>
    </div>
    <p class="settings-security-note">当前配置标识：${escapeHtml(profileId)}。密钥不会写入配置或导出 JSON。${onlineRuntime ? '在线版仅在当前浏览器会话中使用，并通过本站 AI 网关转发。' : '桌面版使用 Windows 当前用户加密保存。'}</p>
  `, connected ? 'is-connected' : 'needs-config');
}

function renderMusicSettings(config, osState = {}) {
  if (!config.apps?.music?.enabled) return '';
  const music = config.apps.music;
  const musicEndpoint = musicBaseUrl(config);
  const builtInMusic = usesBuiltInMusicGateway(config);
  const onlineReady = Boolean(music.onlineEnabled && musicEndpoint);
  const status = osState.musicConnectionMessage
    || (onlineReady ? (builtInMusic ? 'LovePhone 内置音乐服务已就绪' : '在线音乐已配置，建议先测试连接') : '本地音乐已可用');
  return settingsGroup('♪', '音乐服务', status, `
    ${settingToggle('apps.music.onlineEnabled', '启用在线音乐', music.onlineEnabled, '关闭后仅保留本地上传和浏览器播放。')}
    ${settingInput('apps.music.apiBaseUrl', '备用兼容 API 地址（可选）', music.apiBaseUrl, {
      type: 'url',
      placeholder: 'https://your-music-api.example',
      desc: builtInMusic
        ? '当前网站会自动使用 LovePhone 内置音乐服务；只有改用自己的服务时才需要填写。'
        : '内测站会自动使用已配置的音乐服务；本地预览或开源部署可填写自己的兼容 HTTPS 地址。'
    })}
    ${settingToggle('apps.music.showRecommendations', '首页推荐', music.showRecommendations)}
    ${settingToggle('apps.music.showLyrics', '歌词入口', music.showLyrics)}
    <div class="ai-connection-actions music-connection-actions">
      <button type="button" data-music-test>测试音乐连接</button>
      <button type="button" data-music-login ${onlineReady ? '' : 'disabled'}>扫码登录网易云</button>
      ${osState.musicLoggedIn ? '<button type="button" data-music-logout>退出音乐登录</button>' : ''}
      <span data-music-live-status>${escapeHtml(status)}</span>
    </div>
    ${osState.musicQrImage ? `<div class="music-qr-panel"><img src="${escapeHtml(osState.musicQrImage)}" alt="网易云登录二维码" /><small>${escapeHtml(osState.musicQrMessage || '请使用网易云音乐 App 扫码并确认')}</small></div>` : ''}
    <p class="settings-security-note">本地音乐只保存在当前设备。扫码登录凭证只保存在当前浏览器；内置服务不会保存它。${builtInMusic ? '' : '请不要使用不可信的公共音乐服务。'}</p>
  `, onlineReady ? 'is-connected' : 'needs-config');
}

function renderWeatherSettings(config) {
  const weather = config.theme?.widgets?.weather;
  if (!weather?.enabled) return '';
  return settingsGroup('☀', '天气位置', `${weather.city || '当前位置'} · Open-Meteo`, `
    ${settingInput('theme.widgets.weather.city', '城市名', weather.city, { placeholder: '例如：上海' })}
    <div class="weather-location-actions">
      <button type="button" data-weather-search>搜索并使用这个城市</button>
      <span data-weather-search-status>输入城市后自动匹配位置</span>
    </div>
    <details class="weather-coordinate-details">
      <summary>高级：手动调整经纬度</summary>
      <div class="settings-coordinate-row">
        ${settingInput('theme.widgets.weather.latitude', '纬度', weather.latitude, { type: 'number', step: '0.0001' })}
        ${settingInput('theme.widgets.weather.longitude', '经度', weather.longitude, { type: 'number', step: '0.0001' })}
      </div>
    </details>
  `, 'is-connected');
}

function renderMemorySettings(config) {
  if (!config.apps?.memory?.enabled) return '';
  const memory = config.apps.memory;
  const count = Array.isArray(memory.entries) ? memory.entries.length : 0;
  return settingsGroup('◇', '记忆与隐私', `仅保存在本机 · ${count} 条记忆`, `
    ${settingToggle('apps.memory.longTerm', '长期记忆', memory.longTerm)}
    ${settingToggle('apps.memory.autoWrite', '允许 AI 自动写入', memory.autoWrite, '会额外调用一次当前角色模型并自动去重')}
    ${settingToggle('apps.memory.userEditable', '允许手动修改', memory.userEditable)}
  `);
}

function renderCompanionDataSettings(config) {
  const enabled = ['diary', 'anniversary', 'goodnight'].filter(id => config.apps?.[id]?.enabled);
  if (!enabled.length) return '';
  const diaryCount = config.apps.diary?.entries?.length || 0;
  const anniversaryCount = config.apps.anniversary?.events?.length || 0;
  const nightCount = config.apps.goodnight?.entries?.length || 0;
  return settingsGroup('♡', '陪伴数据', '均随小手机配置保存在本机', `
    <div class="settings-data-summary"><span><strong>日记</strong><small>已记录 ${diaryCount} 篇</small></span><b>${config.apps.diary?.enabled ? '开启' : '关闭'}</b></div>
    <div class="settings-data-summary"><span><strong>纪念日</strong><small>已保存 ${anniversaryCount} 个日期</small></span><b>${config.apps.anniversary?.enabled ? '开启' : '关闭'}</b></div>
    <div class="settings-data-summary"><span><strong>晚安问候</strong><small>已打卡 ${nightCount} 个夜晚</small></span><b>${config.apps.goodnight?.enabled ? '开启' : '关闭'}</b></div>
  `);
}

function renderDataSettings(config) {
  const enabledCount = Object.values(config.apps || {}).filter(item => item?.enabled).length;
  return settingsGroup('⇅', '数据与备份', `当前启用 ${enabledCount} 个 App`, `
    <div class="settings-data-summary">
      <span><strong>本机数据</strong><small>角色、聊天、记忆、日记与外观保存在这台设备。</small></span>
      <b>已保存</b>
    </div>
    <div class="settings-data-actions">
      <button type="button" data-settings-backup>创建本机备份</button>
      <button type="button" data-settings-restore>恢复最近备份</button>
      <button type="button" data-settings-export>导出备份文件</button>
      <label>导入备份文件<input type="file" accept="application/json,.json" data-settings-import /></label>
    </div>
  `);
}

function renderPhoneManagement(osState = {}) {
  const backupCount = Number(osState.storageStatus?.backupCount) || 0;
  const installText = osState.installAvailable
    ? '可直接安装为桌面小手机'
    : '请在 Chrome、Edge 或 Safari 中安装到设备';
  return settingsGroup('⌂', '手机管理', installText, `
    <div class="settings-data-summary">
      <span><strong>当前运行环境</strong><small>${globalThis.location?.protocol === 'file:' ? '本地 HTML，可离线打开' : '网页版本，可安装能力由浏览器决定'}</small></span>
      <b>${globalThis.location?.protocol === 'file:' ? '本地文件' : '浏览器'}</b>
    </div>
    <div class="settings-data-actions settings-phone-actions">
      <button type="button" data-settings-install>安装到设备</button>
    </div>
    <p class="settings-security-note">所有内容默认保存在当前设备。更换设备或清理浏览器前，请先导出配置或创建备份。</p>
  `, backupCount ? 'is-connected' : 'needs-config');
}

function renderDangerSettings() {
  return settingsGroup('!', '危险操作', '重置前会自动创建一份本机备份', `
    <div class="settings-data-summary">
      <span><strong>重置整台小手机</strong><small>会清除角色、聊天、记忆、日记、主题、布局和服务配置。</small></span>
      <b>不可直接撤销</b>
    </div>
    <button class="settings-secondary-button settings-danger-button" type="button" data-settings-reset>重置整台小手机</button>
  `, 'needs-config');
}

function renderRuntimeInfo(config, osState = {}) {
  const hostname = globalThis.location?.hostname || '';
  const online = hostname && !['127.0.0.1', 'localhost'].includes(hostname);
  const aiConnected = Object.values(osState.aiProviderStatuses || {}).some(status => status?.configured)
    || Object.values(osState.aiProfileStatuses || {}).some(status => status?.configured);
  const aiModelSelected = Object.values(config.aiProviders?.profiles || {}).some(profile => profile?.model)
    || [config.character, ...(config.characters || [])]
      .some(character => Object.values(character?.aiProfiles || {}).some(profile => profile?.model));
  return settingsGroup('◎', online ? '网页运行说明' : '本机预览说明', online
    ? '数据留在当前浏览器，不会自动同步到云端'
    : '当前在本机预览，可先验证配置再发布', `
    <div class="settings-data-summary">
      <span><strong>陪伴数据</strong><small>聊天、记忆、日记、图片和布局都保存在当前设备的浏览器数据库。</small></span>
      <b>本地优先</b>
    </div>
    <div class="settings-data-summary">
      <span><strong>AI 连接</strong><small>${online ? '网页版本的 API Key 只保存在当前浏览器会话，关闭浏览器后需重新填写。' : '本机版本可在当前设备中使用已连接的 AI 配置。'}</small></span>
      <b>${aiConnected ? '已连接' : aiModelSelected ? '待连接' : '待配置'}</b>
    </div>
    <p class="settings-security-note">当前版本还没有账号和云同步。要换设备时，请导出备份文件并在新设备导入；备份文件不会包含 API Key。</p>
  `, aiConnected ? 'is-connected' : 'needs-config');
}

function renderStartupHealth(osState = {}) {
  const health = osState.startupHealth;
  const items = [
    ['storage', '本地存储'],
    ['network', '网络'],
    ['ai', 'AI 服务'],
    ['music', '音乐服务']
  ];
  const summary = !health || health.checking
    ? '正在检测本机运行环境'
    : `上次检测 ${new Date(health.checkedAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
  return settingsGroup('✓', '启动检查', summary, `
    <div class="startup-health-list">
      ${items.map(([id, label]) => {
        const item = health?.[id] || { status: 'checking', message: '等待检测' };
        return `
          <div class="startup-health-item is-${escapeHtml(item.status)}">
            <span><strong>${label}</strong><small>${escapeHtml(item.message)}</small></span>
            <b aria-label="${escapeHtml(item.status)}"></b>
          </div>
        `;
      }).join('')}
    </div>
    <button class="settings-secondary-button" type="button" data-startup-health-check>重新检测</button>
  `);
}

function aiStatusMaps(result) {
  return {
    providers: Object.fromEntries((result.providers || []).map(provider => [provider.id, provider])),
    profiles: Object.fromEntries((result.profiles || []).map(profile => [profile.profileId, profile]))
  };
}

export const SettingsApp = {
  render(app, config, osState = {}) {
    const theme = getAppTheme(config, app.id);
    const character = activeCharacter(config, osState);
    const avatar = getCharacterAvatar(character);
    const titleMap = { wechat: '我', qq: '设置', instagram: '设置和动态', x: '设置与隐私' };
    const settingsPage = SETTINGS_CATEGORIES.some(category => category.id === osState.settingsPage)
      ? osState.settingsPage
      : 'categories';
    const category = SETTINGS_CATEGORIES.find(item => item.id === settingsPage);
    const themePrelude = theme === 'wechat' ? `
      <div class="wechat-settings-profile">
        <img src="${avatar}" alt="" />
        <span><strong>${escapeHtml(character.name)}</strong><small>LovePhone 号：companion</small><em>二维码  ›</em></span>
      </div>
      <div class="settings-section-caption">通用</div>
    ` : theme === 'qq' ? `
      <div class="qq-settings-profile">
        <img src="${avatar}" alt="" />
        <span><strong>${escapeHtml(character.name)}</strong><small>在线 · 今日心情很好</small></span>
        <em>›</em>
      </div>
      <div class="qq-settings-shortcuts"><span>账号</span><span>装扮</span><span>隐私</span></div>
    ` : theme === 'instagram' ? `
      <div class="instagram-settings-search">搜索设置</div>
      <div class="instagram-account-center">
        <span>◎</span><strong>账号中心</strong><small>密码、安全、个人信息和广告偏好</small><em>›</em>
      </div>
      <div class="settings-section-caption">LovePhone 的使用方式</div>
    ` : theme === 'x' ? `
      <div class="x-settings-search">搜索设置</div>
      <div class="x-settings-account">
        <img src="${avatar}" alt="" />
        <span><strong>${escapeHtml(character.name)}</strong><small>@companion</small></span>
      </div>
      <div class="settings-section-caption">你的账号</div>
    ` : '';

    return `
      <section class="phone-screen phone-settings-app settings-layout-${theme}">
        ${renderStatusBar('chat-statusbar')}
        <header class="app-top">
          <button class="chat-back" type="button" ${category ? 'data-settings-back aria-label="返回设置分类"' : 'data-go-home aria-label="返回桌面"'}>‹</button>
          <h3>${escapeHtml(category?.title || titleMap[theme] || app.name)}</h3>
        </header>
        ${category ? '' : themePrelude}
        <div class="phone-settings-list">
          ${renderSettingsCategory(settingsPage, config, osState)}
        </div>
      </section>
    `;
  },

  bind(container, config, handlers, osState = {}) {
    container.querySelectorAll('[data-settings-category]').forEach(button => button.addEventListener('click', () => {
      handlers.updatePhoneState?.({ settingsPage: button.dataset.settingsCategory });
    }));
    container.querySelector('[data-settings-back]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ settingsPage: 'categories' });
    });
    container.querySelectorAll('[data-settings-backup]').forEach(button => button.addEventListener('click', () => handlers.backup?.()));
    container.querySelectorAll('[data-settings-restore]').forEach(button => button.addEventListener('click', () => handlers.restoreBackup?.()));
    container.querySelector('[data-settings-install]')?.addEventListener('click', () => handlers.install?.());
    container.querySelector('[data-settings-reset]')?.addEventListener('click', () => handlers.reset?.());
    container.querySelector('[data-startup-health-check]')?.addEventListener('click', () => {
      handlers.checkStartupHealth?.();
    });
    container.querySelectorAll('[data-settings-custom-app-toggle]').forEach(input => input.addEventListener('change', () => handlers.toggleCustomApp?.(input.dataset.settingsCustomAppToggle, input.checked)));
    container.querySelectorAll('[data-settings-custom-app-remove]').forEach(button => button.addEventListener('click', () => handlers.removeCustomApp?.(button.dataset.settingsCustomAppRemove)));
    container.querySelectorAll('[data-settings-custom-app-permission]').forEach(input => input.addEventListener('change', () => {
      const id = input.dataset.settingsCustomAppPermission;
      const permissions = [...container.querySelectorAll(`[data-settings-custom-app-permission="${id}"]:checked`)].map(item => item.value);
      handlers.setCustomAppPermissions?.(id, permissions);
    }));

    container.querySelector('[data-weather-search]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const input = container.querySelector('[data-settings-value="theme.widgets.weather.city"]');
      const status = container.querySelector('[data-weather-search-status]');
      button.disabled = true;
      if (status) status.textContent = '正在搜索城市…';
      try {
        const location = await searchWeatherCity(input?.value || '');
        handlers.updateWeatherLocation?.(location);
      } catch (error) {
        button.disabled = false;
        if (status) status.textContent = error.message || '城市搜索失败。';
      }
    });

    container.querySelectorAll('[data-phone-set]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.updatePath?.(button.dataset.phoneSet, button.dataset.value, { keepPhone: true });
      });
    });

    container.querySelectorAll('[data-settings-value]').forEach(input => {
      input.addEventListener('change', () => {
        handlers.updatePath?.(input.dataset.settingsValue, input.value, { keepPhone: true });
      });
    });

    container.querySelectorAll('[data-settings-number]').forEach(input => {
      input.addEventListener('change', () => {
        handlers.updatePath?.(input.dataset.settingsNumber, Number(input.value), { keepPhone: true });
      });
    });

    container.querySelectorAll('[data-settings-toggle]').forEach(input => {
      input.addEventListener('change', () => {
        handlers.updatePath?.(input.dataset.settingsToggle, input.checked, { keepPhone: true });
      });
    });
    container.querySelectorAll('[data-integration-clean]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.integrationClean;
        const summary = integrationRecordSummary(handlers.getConfig?.() || config, key);
        const count = summary.events + summary.tasks + summary.memories;
        if (!globalThis.confirm?.(`清理这项联动产生的 ${count} 条事件、任务和记忆？原始日记、纪念日或音乐不会删除。`)) return;
        handlers.clearCompanionIntegration?.(key);
      });
    });

    container.querySelectorAll('[data-settings-select]').forEach(select => {
      select.addEventListener('change', () => {
        handlers.updatePath?.(select.dataset.settingsSelect, select.value, { keepPhone: true });
      });
    });

    container.querySelector('[data-ai-scope-select]')?.addEventListener('change', event => {
      handlers.updatePhoneState?.({
        aiSettingsScopeId: event.currentTarget.value,
        aiConnectionMessage: ''
      });
    });

    container.querySelector('[data-ai-provider-select]')?.addEventListener('change', event => {
      const latest = handlers.getConfig?.() || config;
      const scope = aiScopeDetails(latest, osState);
      const providerId = event.currentTarget.value;
      osState.aiConnectionMessage = '';
      if (scope.character) {
        const path = characterConfigPath(latest, scope.character.id);
        if (!path) return;
        handlers.updatePath?.(`${path}.aiProviderId`, providerId, { keepPhone: true });
      } else {
        handlers.updatePath?.('aiProviders.activeId', providerId, { keepPhone: true });
      }
    });

    const refreshAiStatuses = async () => {
      try {
        const result = await getAiProviderStatuses(handlers.getConfig?.() || config);
        const statuses = aiStatusMaps(result);
        handlers.updatePhoneState?.({
          aiStatusLoaded: true,
          aiProviderStatuses: statuses.providers,
          aiProfileStatuses: statuses.profiles,
          aiBridgeAvailable: true
        });
      } catch {
        handlers.updatePhoneState?.({
          aiStatusLoaded: true,
          aiBridgeAvailable: false,
          aiConnectionMessage: '本机 AI 服务未启动'
        });
      }
    };

    if (!osState.aiStatusLoaded) refreshAiStatuses();

    let musicQrTimer = null;
    const musicBaseFromForm = () => {
      const customBase = container.querySelector('[data-settings-value="apps.music.apiBaseUrl"]')?.value?.trim();
      return customBase ? normalizeMusicApiUrl(customBase) : musicBaseUrl(handlers.getConfig?.() || config);
    };
    const testMusicConnection = async ({ quiet = false } = {}) => {
      const latest = handlers.getConfig?.() || config;
      const base = musicBaseFromForm();
      const button = container.querySelector('[data-music-test]');
      const liveStatus = container.querySelector('[data-music-live-status]');
      if (button) button.disabled = true;
      if (liveStatus && !quiet) liveStatus.textContent = '正在测试在线音乐服务…';
      try {
        if (!latest.apps.music.onlineEnabled) throw new Error('请先开启在线音乐，再填写兼容 API 地址。');
        if (!base) throw new Error('请输入可信的 HTTPS 兼容 API 地址。');
        const result = await testMusicApi(base);
        handlers.updatePhoneState?.({
          musicStatusLoaded: true,
          musicBridgeAvailable: true,
          musicConnectionMessage: result.message || '在线音乐服务已连接'
        });
        const customBase = container.querySelector('[data-settings-value="apps.music.apiBaseUrl"]')?.value?.trim();
        if (customBase) handlers.updatePath?.('apps.music.apiBaseUrl', base, { keepPhone: true, noRender: true });
      } catch (error) {
        if (button) button.disabled = false;
        if (liveStatus) liveStatus.textContent = error.message || '在线音乐服务无法连接';
        if (quiet) {
          handlers.updatePhoneState?.({
            musicStatusLoaded: true,
            musicBridgeAvailable: false,
            musicConnectionMessage: '在线音乐尚未配置或无法连接'
          });
        }
      }
    };

    if (config.apps?.music?.enabled && !osState.musicStatusLoaded) {
      testMusicConnection({ quiet: true });
    }
    container.querySelector('[data-music-test]')?.addEventListener('click', () => {
      testMusicConnection();
    });
    container.querySelector('[data-music-login]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const liveStatus = container.querySelector('[data-music-live-status]');
      button.disabled = true;
      if (liveStatus) liveStatus.textContent = '正在获取网易云登录二维码…';
      try {
        const base = musicBaseFromForm();
        if (!base) throw new Error('请先填写可信的 HTTPS 兼容 API 地址。');
        const result = await startQrLogin(base);
        handlers.updatePhoneState?.({ musicQrImage: result.image, musicQrMessage: '请用网易云音乐 App 扫码并确认', musicConnectionMessage: '等待扫码确认…' });
        clearInterval(musicQrTimer);
        musicQrTimer = setInterval(async () => {
          try {
            const status = await checkQrLogin(base, result.key);
            if (status.code === 803) {
              clearInterval(musicQrTimer);
              handlers.updatePhoneState?.({
                musicQrImage: '',
                musicQrMessage: '',
                musicLoggedIn: true,
                musicAccount: status.userId ? { userId: status.userId, nickname: status.nickname || '网易云账号' } : null,
                musicConnectionMessage: `${status.nickname || '网易云账号'} 已登录`
              });
            } else if (status.code === 800) {
              clearInterval(musicQrTimer);
              handlers.updatePhoneState?.({ musicQrImage: '', musicQrMessage: '', musicConnectionMessage: '二维码已过期，请重新获取。' });
            } else if (status.code === 802) {
              handlers.updatePhoneState?.({ musicQrMessage: '已扫码，请在网易云 App 确认登录' });
            }
          } catch {
            clearInterval(musicQrTimer);
          }
        }, 2000);
      } catch (error) {
        if (liveStatus) liveStatus.textContent = error.message || '无法获取登录二维码';
      } finally {
        button.disabled = false;
      }
    });
    container.querySelector('[data-music-logout]')?.addEventListener('click', async () => {
      clearInterval(musicQrTimer);
      await clearMusicCookie();
      handlers.updatePhoneState?.({ musicLoggedIn: false, musicAccount: null, musicQrImage: '', musicQrMessage: '', musicConnectionMessage: '已退出当前浏览器中的音乐登录。' });
    });

    container.querySelector('[data-ai-connect]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const latest = handlers.getConfig?.() || config;
      const selectedScopeId = container.querySelector('[data-ai-scope-select]')?.value
        || osState.aiSettingsScopeId
        || 'global';
      const scope = aiScopeDetails(latest, {
        ...osState,
        aiSettingsScopeId: selectedScopeId
      });
      const providerId = container.querySelector('[data-ai-provider-select]')?.value;
      const profileId = scope.character ? roleProfileId(scope.character) : providerId;
      const apiKey = container.querySelector('[data-ai-api-key]')?.value.trim() || '';
      const model = container.querySelector('[data-ai-model]')?.value.trim() || '';
      const baseUrl = container.querySelector('[data-ai-base-url]')?.value.trim() || '';
      const liveStatus = container.querySelector('[data-ai-live-status]');
      button.disabled = true;
      if (liveStatus) liveStatus.textContent = '正在连接并测试…';
      try {
        await configureAiProvider(latest, { profileId, providerId, apiKey, model, baseUrl });
        const result = await testAiProvider(latest, { profileId, providerId });
        if (scope.character) {
          const path = characterConfigPath(latest, scope.character.id);
          if (!path) throw new Error('没有找到这个角色');
          handlers.updatePath?.(`${path}.aiProviderId`, providerId, { noRender: true });
          handlers.updatePath?.(`${path}.aiProfiles.${providerId}`, { model, baseUrl }, { noRender: true });
        } else {
          handlers.updatePath?.('aiProviders.activeId', providerId, { noRender: true });
          handlers.updatePath?.(`aiProviders.profiles.${providerId}`, { model, baseUrl }, { noRender: true });
        }
        const statusesResult = await getAiProviderStatuses(handlers.getConfig?.() || latest);
        const statuses = aiStatusMaps(statusesResult);
        handlers.updatePhoneState?.({
          aiStatusLoaded: true,
          aiProviderStatuses: statuses.providers,
          aiProfileStatuses: statuses.profiles,
          aiBridgeAvailable: true,
          aiConnectionMessage: `${scope.character ? `${scope.character.name} · ` : ''}${result.answer || '连接成功'}`
        });
        handlers.markPhoneSetup?.('ai');
      } catch (error) {
        button.disabled = false;
        if (liveStatus) liveStatus.textContent = friendlyAiError(error, '连接失败，请检查填写内容。');
      }
    });

    container.querySelector('[data-settings-export]')?.addEventListener('click', () => handlers.exportJson?.());
    container.querySelector('[data-settings-import]')?.addEventListener('change', event => {
      const file = event.currentTarget.files?.[0];
      if (file) handlers.importJson?.(file);
    });
  }
};
