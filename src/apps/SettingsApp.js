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
  clearMusicSession,
  musicBaseUrl,
  musicFetchJson,
  musicPostJson
} from '../services/musicService.js?v=app-config-49';
import { searchWeatherCity } from '../services/weatherService.js?v=app-config-52';

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
      <span><strong>API Key</strong><small>${scope.character ? '仅用于这个角色' : '仅用于全局默认'}，刷新页面不会回显</small></span>
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
    <p class="settings-security-note">当前配置标识：${escapeHtml(profileId)}。密钥不会写入配置、导出 JSON 或浏览器存储；桌面版使用 Windows 当前用户加密保存。</p>
  `, connected ? 'is-connected' : 'needs-config');
}

function renderMusicSettings(config, osState = {}) {
  if (!config.apps?.music?.enabled) return '';
  const music = config.apps.music;
  const status = osState.musicConnectionMessage
    || (music.apiBaseUrl ? '等待连接本机音乐服务' : '等待本机音乐服务');
  return settingsGroup('♪', '音乐服务', status, `
    ${settingInput('apps.music.apiBaseUrl', '本机服务地址', music.apiBaseUrl, {
      type: 'url',
      placeholder: 'http://127.0.0.1:5188',
      desc: '通过本机桥接调用网易云官方 CLI，凭据不会进入小手机。'
    })}
    ${settingToggle('apps.music.showRecommendations', '首页推荐', music.showRecommendations)}
    ${settingToggle('apps.music.showLyrics', '歌词入口', music.showLyrics)}
    <div class="ai-connection-actions music-connection-actions">
      <button type="button" data-music-test>测试音乐连接</button>
      <button type="button" data-music-login>打开登录窗口</button>
      <span data-music-live-status>${escapeHtml(status)}</span>
    </div>
    <p class="settings-security-note">只允许本机 LovePhone 页面建立随机会话，不会在配置中保存音乐服务令牌。</p>
  `, osState.musicBridgeAvailable ? 'is-connected' : 'needs-config');
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
      <span><strong>本地配置</strong><small>角色、外观和服务设置保存在这台设备。</small></span>
      <b>已保存</b>
    </div>
    <div class="settings-data-actions">
      <button type="button" data-settings-export>导出配置</button>
      <label>导入配置<input type="file" accept="application/json,.json" data-settings-import /></label>
    </div>
  `);
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
          <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
          <h3>${escapeHtml(titleMap[theme] || app.name)}</h3>
        </header>
        ${themePrelude}
        <div class="phone-settings-list">
          ${renderStartupHealth(osState)}
          ${config.apps.settings.themeControls ? renderAppearanceSettings(config) : ''}
          ${config.apps.settings.apiProfiles ? renderAISettings(config, osState) : ''}
          ${renderMusicSettings(config, osState)}
          ${renderWeatherSettings(config)}
          ${renderMemorySettings(config)}
          ${renderCompanionDataSettings(config)}
          ${config.apps.settings.exportImport ? renderDataSettings(config) : ''}
        </div>
      </section>
    `;
  },

  bind(container, config, handlers, osState = {}) {
    container.querySelector('[data-startup-health-check]')?.addEventListener('click', () => {
      handlers.checkStartupHealth?.();
    });

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

    const testMusicConnection = async ({ quiet = false } = {}) => {
      const latest = handlers.getConfig?.() || config;
      const base = musicBaseUrl(latest);
      const button = container.querySelector('[data-music-test]');
      const liveStatus = container.querySelector('[data-music-live-status]');
      if (button) button.disabled = true;
      if (liveStatus && !quiet) liveStatus.textContent = '正在连接本机音乐服务…';
      try {
        clearMusicSession(base);
        const result = await musicFetchJson(`${base}/health`);
        handlers.updatePhoneState?.({
          musicStatusLoaded: true,
          musicBridgeAvailable: true,
          musicConnectionMessage: result.authenticated
            ? '音乐服务已连接，网易云登录有效'
            : '音乐服务在线，请先完成网易云登录'
        });
      } catch (error) {
        if (button) button.disabled = false;
        if (liveStatus) liveStatus.textContent = error.message || '本机音乐服务未启动';
        if (quiet) {
          handlers.updatePhoneState?.({
            musicStatusLoaded: true,
            musicBridgeAvailable: false,
            musicConnectionMessage: '本机音乐服务未启动或尚未登录'
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
      if (liveStatus) liveStatus.textContent = '正在打开网易云登录窗口…';
      try {
        const latest = handlers.getConfig?.() || config;
        const result = await musicPostJson(musicBaseUrl(latest), '/login-window', {});
        if (liveStatus) {
          liveStatus.textContent = result.message || '请在新窗口扫码登录，完成后再测试连接';
        }
      } catch (error) {
        if (liveStatus) liveStatus.textContent = error.message || '无法打开登录窗口';
      } finally {
        button.disabled = false;
      }
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
