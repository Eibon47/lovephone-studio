import { iconMap } from '../system/icons.js?v=app-config-24';
import { appOptions } from '../system/options.js?v=app-config-24';
import { escapeHtml } from '../system/html.js';
import { AI_PROVIDER_CATALOG, getAiProvider } from '../config/aiProviderCatalog.js?v=app-config-85';

const appCopy = {
  character: {
    name: '角色',
    desc: '管理角色资料、人设、状态栏和角色自己的 AI 接入方式。'
  },
  chat: {
    name: '聊天',
    desc: '让角色真正能陪你说话，是陪伴手机的核心入口。'
  },
  memory: {
    name: '记忆',
    desc: '保存偏好、关系进展和重要小事，后续可以接 EchoMind。'
  },
  music: {
    name: '音乐',
    desc: '搜索歌曲、播放音乐，并把正在播放同步到桌面唱片组件。'
  },
  diary: {
    name: '日记',
    desc: '记录每天的小事、心情，也可以让角色给出回应。'
  },
  anniversary: {
    name: '纪念日',
    desc: '保存关系节点、倒计时和提醒。'
  },
  goodnight: {
    name: '晚安问候',
    desc: '生成早安晚安、桌面便签和陪伴语。'
  },
  settings: {
    name: '设置',
    desc: '管理主题、API、导入导出和小手机基础设置。'
  }
};

const statusItems = [
  { id: 'mood', label: '心情' },
  { id: 'online', label: '在线状态' },
  { id: 'relationship', label: '亲密度' },
  { id: 'todayLine', label: '今日一句' },
  { id: 'memoryBrief', label: '记忆摘要' },
  { id: 'thinking', label: '正在想什么' }
];

const memoryTypes = [
  { id: 'profile', label: '用户资料' },
  { id: 'preferences', label: '偏好' },
  { id: 'relationship', label: '关系进展' },
  { id: 'events', label: '重要事件' },
  { id: 'chatSummary', label: '聊天摘要' }
];

const CUSTOM_APP_AGENT_BRIEF = [
  '你正在为 LovePhone Studio 编写可导入的自定义 App。',
  '请生成一个 .lovephone-app.zip，包含 manifest.json、app.html、styles/app.css、scripts/app.js 和本地素材。',
  'manifest 固定：format=lovephone-app，formatVersion=1，id，name，version，entry，pages，styles，scripts，permissions，networkOrigins。',
  'App 在独立沙箱中运行，不能访问 parent、localStorage 或直接 fetch 外网。只能使用 LovePhone API。',
  '私有数据：await LovePhone.storage.get(key) / set(key,value) / delete(key)，数据按 App ID 隔离。',
  '系统数据：await LovePhone.data.read(character | chat | memory | diary | media)。对应权限为 character.read、chat.read、memory.read、diary.read、media.read。',
  '已配置 AI：await LovePhone.ai.chat(message, { system, history })。需要 ai.chat 权限；AI Key 永不写入 App 包，用户在 LovePhone 设置中连接自己的服务商。',
  '联网：await LovePhone.network.fetch(url, { method, headers, body })。需要 network 权限，HTTPS 根域名必须写入 networkOrigins，服务端必须允许浏览器跨域。',
  '其他：LovePhone.openApp(id) 需要 system.openApp；LovePhone.navigate(page) 在 manifest.pages 内跳转；LovePhone.notification(message) 需要 notifications。',
  '不允许远程脚本、远程样式或远程图片。所有界面资源必须放在 App 包内。'
].join('\n');

function copyFor(option) {
  return appCopy[option.key] || option;
}

function isSelected(config, option) {
  if (option.required) return true;
  return Boolean(config.apps?.[option.key]?.enabled ?? config.components[option.key]);
}

function appConfig(config, appId) {
  return config.apps?.[appId] || {};
}

function boolRow(path, label, desc, checked, disabled = false) {
  return `
    <label class="setting-row ${disabled ? 'is-disabled' : ''}">
      <span>
        <strong>${label}</strong>
        <small>${desc}</small>
      </span>
      <input type="checkbox" data-app-setting="${path}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
      <span class="toggle-visual"></span>
    </label>
  `;
}

function selectRow(path, label, desc, value, options) {
  return `
    <label class="setting-field">
      <span>
        <strong>${label}</strong>
        <small>${desc}</small>
      </span>
      <select data-app-select="${path}">
        ${options.map(option => `
          <option value="${option.value}" ${value === option.value ? 'selected' : ''}>${option.label}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function numberRow(path, label, desc, value, min, max) {
  return `
    <label class="setting-field">
      <span>
        <strong>${label}</strong>
        <small>${desc}</small>
      </span>
      <input type="number" min="${min}" max="${max}" value="${value}" data-app-number="${path}" />
    </label>
  `;
}

function textAreaRow(path, label, desc, value, rows = 4, maxLength = 500) {
  return `
    <label class="setting-field setting-field-wide">
      <span>
        <strong>${label}</strong>
        <small>${desc}</small>
      </span>
      <textarea rows="${rows}" maxlength="${maxLength}" data-app-text="${path}">${escapeHtml(value || '')}</textarea>
    </label>
  `;
}

function multiSelectBlock(path, label, desc, selected, options) {
  const selectedSet = new Set(selected || []);
  return `
    <div class="setting-group">
      <div class="setting-group-title">
        <strong>${label}</strong>
        <small>${desc}</small>
      </div>
      <div class="mini-check-grid">
        ${options.map(option => `
          <label>
            <input type="checkbox" data-app-list="${path}" value="${option.id}" ${selectedSet.has(option.id) ? 'checked' : ''} />
            <span>${option.label}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function aiBlock(appId, app) {
  if (!app.ai) return '';
  return `
    <div class="setting-group">
      <div class="setting-group-title">
        <strong>AI 接入</strong>
        <small>先决定这个 App 是否需要模型能力，后面再接真实 API。</small>
      </div>
      ${boolRow(`apps.${appId}.ai.enabled`, '启用 AI', '关闭后这个 App 只保留本地展示能力。', app.ai.enabled)}
      ${selectRow(`apps.${appId}.ai.mode`, 'API 使用方式', '支持全局 API、角色独立 API 或这个 App 单独配置。', app.ai.mode, [
        { value: 'global', label: '使用全局默认 API' },
        { value: 'character', label: '跟随当前角色 API' },
        { value: 'custom', label: '这个 App 单独配置 API' },
        { value: 'disabled', label: '暂不接入 AI' }
      ])}
    </div>
  `;
}

function renderCustomAppArea(uiState = {}) {
  const apps = uiState.customApps || [];
  const preview = uiState.customAppImportPreview;
  if (preview) {
    const app = preview.manifest;
    return `<section class="custom-app-builder-card"><div class="section-heading"><span>安装预检</span><h2>${escapeHtml(app.name)}</h2><p>版本 ${escapeHtml(app.version)}，${preview.summary.pageCount} 个页面，${Math.ceil(preview.summary.archiveBytes / 1024)} KB。</p></div><dl class="custom-app-summary"><dt>请求权限</dt><dd>${app.permissions.length ? escapeHtml(app.permissions.join('、')) : '无'}</dd><dt>联网域名</dt><dd>${app.networkOrigins.length ? escapeHtml(app.networkOrigins.join('、')) : '不联网'}</dd></dl><p class="settings-security-note">App 代码将在独立页面中运行。只会获得你在这里确认的系统能力。</p><div class="flow-actions"><button type="button" data-cancel-custom-app>取消</button><button class="primary-action" type="button" data-install-custom-app>确认安装</button></div></section>`;
  }
  if (uiState.customAppManagerId) {
    const app = apps.find(item => item.id === uiState.customAppManagerId);
    if (!app) return '';
    const permissions = app.manifest?.permissions || [];
    return `<section class="custom-app-builder-card"><div class="section-heading"><span>自定义 App 管理</span><h2>${escapeHtml(app.name)}</h2><p>${escapeHtml(app.id)} · ${escapeHtml(app.manifest?.version || '')}</p></div><label class="setting-field"><span><strong>桌面名称</strong><small>只改变这台小手机中的显示名称。</small></span><input data-custom-app-name value="${escapeHtml(app.name)}" /></label><label class="setting-field"><span><strong>自定义图标</strong><small>PNG、JPG、WebP 或 GIF 图片。</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-custom-app-icon /></label><div class="setting-group"><div class="setting-group-title"><strong>权限管理</strong><small>关闭后，App 对应的系统 API 会直接返回中文错误。</small></div><div class="mini-check-grid">${permissions.map(permission => `<label><input type="checkbox" data-custom-app-permission value="${escapeHtml(permission)}" ${(app.permissions || []).includes(permission) ? 'checked' : ''}/><span>${escapeHtml(permission)}</span></label>`).join('') || '<small>这个 App 未申请系统权限。</small>'}</div></div><div class="flow-actions"><button type="button" data-export-custom-app="${escapeHtml(app.id)}">导出原始包</button><button type="button" data-uninstall-custom-app="${escapeHtml(app.id)}">卸载</button><button class="primary-action" type="button" data-save-custom-app="${escapeHtml(app.id)}">保存管理项</button><button type="button" data-close-custom-app-manager>返回</button></div></section>`;
  }
  return `<section class="custom-app-builder-card"><div class="section-heading"><span>开发者扩展</span><h2>自定义 App</h2><p>导入 .lovephone-app.zip，安装后会直接出现在手机桌面，也会一并导出到本地 HTML 小手机。</p></div><div class="flow-actions"><label class="primary-action file-action">导入 App 包<input type="file" accept=".zip,.lovephone-app.zip,application/zip" data-custom-app-file hidden /></label><button type="button" data-download-example-custom-app>下载示例 App 包</button><button type="button" data-toggle-custom-app-guide>${uiState.customAppGuideOpen ? '收起接口说明' : '开发接口说明'}</button></div>${uiState.customAppGuideOpen ? `<div class="custom-app-agent-guide"><strong>复制下面内容给 Codex、Claude 或其他开发 Agent</strong><textarea readonly data-custom-app-agent-brief>${escapeHtml(CUSTOM_APP_AGENT_BRIEF)}</textarea><div class="flow-actions"><button class="primary-action" type="button" data-copy-custom-app-agent-brief>复制给 Agent</button><a href="./docs/CUSTOM_APP_DEVELOPER_GUIDE.md" target="_blank" rel="noopener">打开完整说明</a></div></div>` : ''}${apps.length ? `<div class="companion-list app-picker-list">${apps.map(app => `<div class="companion-row app-picker-row"><span class="companion-copy"><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.manifest?.version || '')} · ${app.enabled === false ? '已禁用' : '已启用'}</small></span><div class="app-row-actions"><label class="feature-switch"><input type="checkbox" data-toggle-custom-app="${escapeHtml(app.id)}" ${app.enabled !== false ? 'checked' : ''}/><span class="feature-switch-track"></span></label><button type="button" data-manage-custom-app="${escapeHtml(app.id)}">管理</button></div></div>`).join('')}</div>` : '<p class="empty-state">还没有安装自定义 App。</p>'}</section>`;
}

function renderAppList(config, runtimeCapabilities = {}, uiState = {}) {
  const assistant = config.aiAssistant || {};
  return `
    <section class="panel-section">
      <div class="section-heading">
        <span>第一步</span>
        <h2>先选这台小手机要有哪些功能</h2>
        <p>角色、聊天、设置是必须的；其他功能可以开关。点“配置”后，右侧手机会直接打开对应 App。</p>
      </div>
      <div class="companion-list app-picker-list">
        ${appOptions.filter(option => (
          option.key !== 'music' || runtimeCapabilities.experimentalMusic !== false
        )).map(option => {
          const copy = copyFor(option);
          return `
            <div class="companion-row app-picker-row ${option.required ? 'is-required' : ''}">
              <span class="companion-icon"><img src="${iconMap[option.icon]}" alt="" /></span>
              <span class="companion-copy">
                <strong>${copy.name}</strong>
                <small>${copy.desc}</small>
              </span>
              <div class="app-row-actions">
                ${option.required
                  ? '<span class="required-pill">必带</span>'
                  : `
                    <label class="feature-switch" aria-label="${isSelected(config, option) ? `关闭${copy.name}` : `添加${copy.name}`}">
                      <input type="checkbox" data-component="${option.key}" ${isSelected(config, option) ? 'checked' : ''} />
                      <span class="feature-switch-track"></span>
                    </label>
                  `}
                <button type="button" data-config-app="${option.key}">配置</button>
              </div>
            </div>
          `;
        }).join('')}
        <div class="companion-row app-picker-row ai-assistant-picker-row">
          <span class="companion-icon"><img src="${iconMap.settings}" alt="" /></span>
          <span class="companion-copy">
            <strong>AI 搭建助手</strong>
            <small>在工坊左侧生成美化与小组件草稿，不会出现在最终小手机里。</small>
          </span>
          <div class="app-row-actions">
            <label class="feature-switch" aria-label="${assistant.enabled ? '关闭 AI 搭建助手' : '启用 AI 搭建助手'}">
              <input type="checkbox" data-ai-assistant-enabled ${assistant.enabled ? 'checked' : ''} />
              <span class="feature-switch-track"></span>
            </label>
            <button type="button" data-config-ai-assistant>接口</button>
          </div>
        </div>
      </div>
      ${renderCustomAppArea(uiState)}
      <div class="flow-actions">
        <button class="primary-action" type="button" data-next-step="appearance">下一步：美化</button>
      </div>
    </section>
  `;
}

function renderAiAssistantConfig(config, uiState = {}) {
  const assistant = config.aiAssistant || {};
  const draft = uiState.aiAssistant?.connectionDraft || {};
  const provider = getAiProvider(draft.providerId || assistant.providerId) || AI_PROVIDER_CATALOG[0];
  const status = uiState.aiAssistant?.connectionStatus
    || (assistant.model ? `已保存：${assistant.model}` : '尚未连接');
  return `
    <section class="panel-section">
      <div class="section-heading">
        <span>工坊工具</span>
        <h2>AI 搭建助手接口</h2>
        <p>这个模型只用于生成美化和小组件草稿。密钥只发送到本机安全网关，不会进入小手机、导出 JSON 或浏览器存储。</p>
      </div>
      <div class="app-config-panel">
        ${boolRow('aiAssistant.enabled', '启用 AI 搭建助手', '启用后，左侧工坊会出现 AI 助手入口；最终小手机不会包含它。', assistant.enabled)}
        <label class="setting-field">
          <span><strong>服务商</strong><small>选择专门给搭建助手使用的模型。</small></span>
          <select data-ai-assistant-provider>
            ${AI_PROVIDER_CATALOG.map(item => `<option value="${item.id}" ${item.id === provider.id ? 'selected' : ''}>${item.name}</option>`).join('')}
          </select>
        </label>
        <label class="setting-field">
          <span><strong>API Key</strong><small>仅本次连接时提交，不会回显或保存到配置。</small></span>
          <input type="password" autocomplete="new-password" data-ai-assistant-key placeholder="${provider.apiKeyOptional ? '本地模型可不填' : '粘贴 API Key'}" />
        </label>
        <label class="setting-field">
          <span><strong>模型名称</strong><small>可从建议中选择，也可以填写自己的模型 ID。</small></span>
          <input type="text" list="assistant-model-suggestions" value="${escapeHtml(draft.model || assistant.model || provider.models[0] || '')}" data-ai-assistant-model placeholder="输入模型 ID" />
          <datalist id="assistant-model-suggestions">
            ${provider.models.map(model => `<option value="${escapeHtml(model)}"></option>`).join('')}
          </datalist>
        </label>
        <label class="setting-field">
          <span><strong>接口地址（可选）</strong><small>仅自定义兼容服务商或私有代理需要填写。</small></span>
          <input type="url" value="${escapeHtml(draft.baseUrl || assistant.baseUrl || '')}" data-ai-assistant-base-url placeholder="https://api.example.com/v1" />
        </label>
        <div class="flow-actions ai-assistant-connect-actions">
          <button class="primary-action" type="button" data-ai-assistant-connect>连接并测试</button>
          <small data-ai-assistant-status>${escapeHtml(status)}</small>
        </div>
      </div>
      <div class="flow-actions">
        <button type="button" data-back-app-list>返回功能列表</button>
      </div>
    </section>
  `;
}

function renderCharacterConfig(config) {
  const app = appConfig(config, 'character');
  return `
    ${textAreaRow('character.definition', '角色设定', '写清楚这个角色是谁、怎么陪伴用户、说话边界和长期关系方向。后面接 AI 时会作为核心人设。', config.character.definition, 5, 700)}
    ${numberRow('apps.character.maxCharacters', '最多角色数量', '限制这台小手机最多能创建几个角色。', app.maxCharacters, 1, 12)}
    ${boolRow('apps.character.profileCard', '显示角色卡片', '在角色 App 里展示头像、关系和角色简介。', app.profileCard)}
    ${boolRow('apps.character.statusBar.enabled', '启用角色状态栏', '在角色 App 或桌面中显示角色状态。', app.statusBar?.enabled)}
    ${multiSelectBlock('apps.character.statusBar.items', '状态栏内容', '选择角色状态栏应该显示哪些信息。', app.statusBar?.items, statusItems)}
  `;
}

function renderChatConfig(config) {
  const app = appConfig(config, 'chat');
  return `
    ${boolRow('apps.chat.ai.enabled', '启用真实 AI 回复', '关闭后使用本地演示回复，不会调用模型或消耗额度。', app.ai?.enabled)}
    ${boolRow('apps.chat.history', '保存聊天记录', '之后可用于历史回看或记忆摘要。', app.history)}
    ${boolRow('apps.chat.timestamps', '显示消息时间', '聊天气泡旁显示发送时间。', app.timestamps)}
    ${boolRow('apps.chat.voiceButton', '启用真实语音输入', '使用浏览器语音识别把说话转成文字，首次使用需要麦克风权限。', app.voiceButton)}
    ${boolRow('apps.chat.quickReplies', '显示快捷回复', '提供几个快速回复按钮，降低输入成本。', app.quickReplies)}
    ${boolRow('apps.chat.inputBox', '显示输入框', '关闭后更像纯展示型角色卡。', app.inputBox)}
    ${selectRow('apps.chat.layout', '聊天样式', '选择聊天界面的表现形式。', app.layout, [
      { value: 'bubble', label: '手机气泡' },
      { value: 'message', label: '短信样式' },
      { value: 'dialogue', label: '角色对话框' }
    ])}
  `;
}

function renderMemoryConfig(config) {
  const app = appConfig(config, 'memory');
  return `
    ${boolRow('apps.memory.longTerm', '启用长期记忆', '让角色可以记住更长期的信息。', app.longTerm)}
    ${boolRow('apps.memory.autoWrite', '允许 AI 自动写入记忆', '每轮聊天后会额外调用一次当前角色模型，只保存明确且长期有用的信息。', app.autoWrite)}
    ${boolRow('apps.memory.userEditable', '允许用户手动编辑记忆', '用户可以删除或修正角色记住的内容。', app.userEditable)}
    ${boolRow('apps.memory.visibleCards', '使用卡片视图', '关闭后改为更紧凑的列表样式。', app.visibleCards)}
    ${multiSelectBlock('apps.memory.types', '记忆类型', '选择这个小手机要保存哪些类型的记忆。', app.types, memoryTypes)}
  `;
}

function renderMusicConfig(config) {
  const app = appConfig(config, 'music');
  return `
    <div class="setting-group">
      <div class="setting-group-title">
        <strong>在线音乐服务</strong>
        <small>可选。用户在小手机设置中填写可信的 NeteaseCloudMusicApi 兼容地址；本地音乐不需要服务。</small>
      </div>
      ${boolRow('apps.music.onlineEnabled', '启用在线音乐', '关闭后仅保留本地上传和浏览器播放。', app.onlineEnabled)}
      ${textAreaRow('apps.music.apiBaseUrl', '默认兼容 API 地址', '可留空，由每台小手机的设置 App 自行填写', app.apiBaseUrl, 2, 300)}
    </div>
    ${boolRow('apps.music.showRecommendations', '显示推荐内容', '在音乐首页显示每日推荐和快捷入口。', app.showRecommendations)}
    ${boolRow('apps.music.showLyrics', '显示歌词入口', '播放页保留歌词查看入口。', app.showLyrics)}
  `;
}

function renderDiaryConfig(config) {
  const app = appConfig(config, 'diary');
  return `
    ${boolRow('apps.diary.moodTags', '心情标签', '给日记加情绪标签，方便回看。', app.moodTags)}
    ${boolRow('apps.diary.aiSummary', 'AI 总结', '保存日记后，使用当前角色选择的模型额外生成一次简短小结。', app.aiSummary)}
    ${boolRow('apps.diary.characterComment', '角色评论', '当前角色可以给日记留一句回应。', app.characterComment)}
  `;
}

function renderAnniversaryConfig(config) {
  const app = appConfig(config, 'anniversary');
  return `
    ${boolRow('apps.anniversary.multipleDates', '允许多个纪念日', '不只保存一个日期，可以保存多段关系节点。', app.multipleDates)}
    ${boolRow('apps.anniversary.countdown', '显示倒计时', '显示距离纪念日还有多久。', app.countdown)}
    ${boolRow('apps.anniversary.desktopWidget', '显示桌面挂件', '在手机桌面展示最近纪念日。', app.desktopWidget)}
    ${boolRow('apps.anniversary.reminders', '启用提醒', '在临近日期时显示 App 内提醒；浏览器允许后也会发送系统通知。', app.reminders)}
    ${numberRow('apps.anniversary.reminderDays', '提前提醒天数', '可设置当天至提前 30 天提醒。', app.reminderDays, 0, 30)}
  `;
}

function renderGoodnightConfig(config) {
  const app = appConfig(config, 'goodnight');
  return `
    ${boolRow('apps.goodnight.goodMorning', '早安问候', '每天 5:00 至 11:59 打开小手机时生成一次。', app.goodMorning)}
    ${boolRow('apps.goodnight.goodNight', '晚安问候', '每天 20:00 至次日 2:59 打开小手机时生成一次。', app.goodNight)}
    ${boolRow('apps.goodnight.aiGenerated', 'AI 自动生成一句话', '使用当前角色模型和记忆生成；失败时自动使用本地问候。', app.aiGenerated)}
    ${boolRow('apps.goodnight.desktopNote', '显示在桌面便签', '把问候显示在手机桌面卡片中。', app.desktopNote)}
    ${boolRow('apps.goodnight.notifications', '系统通知', '仅在网页打开且用户已允许浏览器通知时推送。', app.notifications)}
    ${boolRow('apps.goodnight.useCurrentCharacter', '由当前角色来说', '问候语使用当前角色的人设语气。', app.useCurrentCharacter)}
  `;
}

function renderSettingsConfig(config) {
  const app = appConfig(config, 'settings');
  const selected = new Set(config.aiProviders?.selected || []);
  const groups = [...new Set(AI_PROVIDER_CATALOG.map(provider => provider.group))];
  return `
    ${boolRow('apps.settings.apiProfiles', '启用 API 配置页', '允许用户保存全局 API 信息。', app.apiProfiles)}
    ${boolRow('apps.settings.perRoleApi', '允许角色独立 API', '不同角色可以选择不同 API 或模型。', app.perRoleApi)}
    ${boolRow('apps.settings.themeControls', '保留主题控制', '设置 App 内可以调字体、主色和手机壳。', app.themeControls)}
    ${boolRow('apps.settings.exportImport', '保留导入导出', '允许用户备份和迁移小手机配置。', app.exportImport)}
    <div class="setting-group">
      <div class="setting-group-title">
        <strong>可用的 AI 服务商</strong>
        <small>在这里勾选需要开放给用户的服务商。右侧手机设置中只会出现已选项。</small>
      </div>
      <div class="ai-provider-picker">
        ${groups.map(group => `
          <section>
            <strong>${group}</strong>
            <div class="ai-provider-checks">
              ${AI_PROVIDER_CATALOG.filter(provider => provider.group === group).map(provider => `
                <label>
                  <input
                    type="checkbox"
                    data-app-list="aiProviders.selected"
                    value="${provider.id}"
                    ${selected.has(provider.id) ? 'checked' : ''}
                  />
                  <span>
                    <b>${provider.name}</b>
                    <small>${provider.customBaseUrl ? '自定义兼容接口' : provider.models.slice(0, 2).join(' / ')}</small>
                  </span>
                </label>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </div>
      ${textAreaRow('aiProviders.bridgeUrl', '本机 AI 服务地址', 'API Key 只发送到本机安全网关，不会保存进配置 JSON。', config.aiProviders?.bridgeUrl, 2, 300)}
    </div>
  `;
}

function renderAppSettings(config, appId, uiState = {}) {
  if (appId === 'ai-assistant') return renderAiAssistantConfig(config, uiState);
  const option = appOptions.find(item => item.key === appId) || appOptions[0];
  const copy = copyFor(option);
  const renderers = {
    character: renderCharacterConfig,
    chat: renderChatConfig,
    music: renderMusicConfig,
    memory: renderMemoryConfig,
    diary: renderDiaryConfig,
    anniversary: renderAnniversaryConfig,
    goodnight: renderGoodnightConfig,
    settings: renderSettingsConfig
  };
  return `
    <section class="panel-section">
      <div class="section-heading">
        <span>功能配置</span>
        <h2>${copy.name} App 设置</h2>
        <p>${copy.desc}</p>
      </div>
      <div class="app-config-panel">
        ${renderers[appId]?.(config) || ''}
      </div>
      <div class="flow-actions">
        <button type="button" data-back-app-list>返回功能列表</button>
        <button class="primary-action" type="button" data-next-step="appearance">下一步：美化</button>
      </div>
    </section>
  `;
}

export function renderAppSelectionPanel(config, uiState = {}) {
  if (uiState.appConfigId && !(uiState.appConfigId === 'music' && uiState.runtimeCapabilities?.experimentalMusic === false)) {
    return renderAppSettings(config, uiState.appConfigId, uiState);
  }
  return renderAppList(config, uiState.runtimeCapabilities, uiState);
}

export function bindAppSelectionPanel(root, handlers) {
  root.querySelector('[data-toggle-custom-app-guide]')?.addEventListener('click', () => handlers.toggleCustomAppGuide?.());
  root.querySelector('[data-copy-custom-app-agent-brief]')?.addEventListener('click', async () => {
    const value = root.querySelector('[data-custom-app-agent-brief]')?.value || '';
    try { await navigator.clipboard.writeText(value); handlers.setCustomAppGuideStatus?.('接口说明已复制，可以直接发给开发 Agent。'); } catch { handlers.setCustomAppGuideStatus?.('复制失败，请手动选中说明文字复制。'); }
  });
  root.querySelector('[data-custom-app-file]')?.addEventListener('change', event => {
    const file = event.currentTarget.files?.[0];
    if (file) handlers.inspectCustomApp?.(file);
  });
  root.querySelector('[data-cancel-custom-app]')?.addEventListener('click', () => handlers.cancelCustomAppImport?.());
  root.querySelector('[data-install-custom-app]')?.addEventListener('click', () => handlers.installCustomApp?.());
  root.querySelector('[data-download-example-custom-app]')?.addEventListener('click', () => handlers.downloadExampleCustomApp?.());
  root.querySelectorAll('[data-manage-custom-app]').forEach(button => button.addEventListener('click', () => handlers.openCustomAppManager?.(button.dataset.manageCustomApp)));
  root.querySelectorAll('[data-toggle-custom-app]').forEach(input => input.addEventListener('change', () => handlers.toggleCustomApp?.(input.dataset.toggleCustomApp, input.checked)));
  root.querySelector('[data-close-custom-app-manager]')?.addEventListener('click', () => handlers.closeCustomAppManager?.());
  root.querySelector('[data-save-custom-app]')?.addEventListener('click', async event => {
    const id = event.currentTarget.dataset.saveCustomApp;
    await handlers.renameCustomApp?.(id, root.querySelector('[data-custom-app-name]')?.value);
    const permissions = [...root.querySelectorAll('[data-custom-app-permission]:checked')].map(input => input.value);
    await handlers.setCustomAppPermissions?.(id, permissions);
    const file = root.querySelector('[data-custom-app-icon]')?.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = () => handlers.updateCustomAppIcon?.(id, String(reader.result || '')); reader.readAsDataURL(file); }
  });
  root.querySelector('[data-uninstall-custom-app]')?.addEventListener('click', event => handlers.removeCustomApp?.(event.currentTarget.dataset.uninstallCustomApp));
  root.querySelector('[data-export-custom-app]')?.addEventListener('click', event => handlers.exportCustomApp?.(event.currentTarget.dataset.exportCustomApp));
  root.querySelectorAll('[data-component]').forEach(input => {
    input.addEventListener('change', () => {
      handlers.setAppEnabled(input.dataset.component, input.checked);
    });
  });
  root.querySelectorAll('[data-config-app]').forEach(button => {
    button.addEventListener('click', () => handlers.openAppConfig(button.dataset.configApp));
  });
  root.querySelector('[data-ai-assistant-enabled]')?.addEventListener('change', event => {
    handlers.setAiAssistantEnabled(event.currentTarget.checked);
  });
  root.querySelector('[data-config-ai-assistant]')?.addEventListener('click', handlers.openAiAssistantConfig);
  root.querySelector('[data-back-app-list]')?.addEventListener('click', handlers.closeAppConfig);
  root.querySelectorAll('[data-app-setting]').forEach(input => {
    input.addEventListener('change', () => {
      handlers.updatePath(input.dataset.appSetting, input.checked);
    });
  });
  root.querySelectorAll('[data-app-select]').forEach(select => {
    select.addEventListener('change', () => {
      handlers.updatePath(select.dataset.appSelect, select.value);
    });
  });
  root.querySelectorAll('[data-app-number]').forEach(input => {
    input.addEventListener('change', () => {
      handlers.updatePath(input.dataset.appNumber, Number(input.value));
    });
  });
  root.querySelectorAll('[data-app-text]').forEach(input => {
    input.addEventListener('input', () => {
      handlers.updatePath(input.dataset.appText, input.value, { noRender: true });
    });
    input.addEventListener('change', () => {
      handlers.updatePath(input.dataset.appText, input.value);
    });
  });
  root.querySelectorAll('[data-app-list]').forEach(input => {
    input.addEventListener('change', () => {
      const path = input.dataset.appList;
      const values = [...root.querySelectorAll(`[data-app-list="${path}"]:checked`)].map(item => item.value);
      handlers.updatePath(path, values);
    });
  });
  root.querySelector('[data-ai-assistant-connect]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const providerId = root.querySelector('[data-ai-assistant-provider]')?.value || '';
    const apiKey = root.querySelector('[data-ai-assistant-key]')?.value.trim() || '';
    const model = root.querySelector('[data-ai-assistant-model]')?.value.trim() || '';
    const baseUrl = root.querySelector('[data-ai-assistant-base-url]')?.value.trim() || '';
    button.disabled = true;
    try {
      await handlers.configureAiAssistant({ providerId, apiKey, model, baseUrl });
    } finally {
      button.disabled = false;
    }
  });
}
