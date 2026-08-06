import { escapeHtml } from '../system/html.js';
import { getCharacterAvatar } from '../system/icons.js?v=app-config-61';
import { renderStatusBar } from '../system/StatusBar.js';
import { getAppTheme } from '../system/appAppearance.js?v=app-config-17';
import { getAiProvider, selectedAiProviders } from '../config/aiProviderCatalog.js?v=app-config-35';
import { characterPresence } from '../services/characterPresenceService.js?v=app-config-1';

const statusLabels = {
  mood: '心情稳定',
  online: '在线陪伴',
  relationship: '关系升温中',
  todayLine: '今天也在等你',
  memoryBrief: '记住你的偏好',
  thinking: '正在想你'
};

const avatarPresets = [
  { id: 'heart', label: '爱心' },
  { id: 'character', label: '角色' },
  { id: 'sprout', label: '新芽' },
  { id: 'moon', label: '月亮' }
];

function resizeAvatar(file, maxSize = 384) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('error', () => reject(new Error('图片读取失败')));
    reader.addEventListener('load', () => {
      const image = new Image();
      image.addEventListener('error', () => reject(new Error('图片格式无法读取')));
      image.addEventListener('load', () => {
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.84));
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
  });
}

function characterAppConfig(config) {
  return config.apps?.character || {};
}

function allCharacters(config) {
  return [config.character, ...(config.characters || [])];
}

function characterPath(index, field) {
  return index === 0 ? `character.${field}` : `characters.${index - 1}.${field}`;
}

function selectedIndex(osState, config) {
  const characters = allCharacters(config);
  const selectedId = osState.selectedCharacterId || config.apps?.character?.activeCharacterId;
  const idIndex = characters.findIndex(character => character.id === selectedId);
  if (idIndex >= 0) return idIndex;
  const maxIndex = characters.length - 1;
  return Math.max(0, Math.min(Number(osState.selectedCharacterIndex || 0), maxIndex));
}

function renderCharacterStatus(appConfig, config, osState, character) {
  const statusBar = appConfig.statusBar || {};
  if (!statusBar.enabled) return '';
  const items = (statusBar.items || []).slice(0, 4);
  if (!items.length) return '';

  const presence = characterPresence(config, character, osState);
  return `
    <div class="character-status-phone">
      <span class="character-presence"><i></i>${escapeHtml(presence.label)}</span>
      ${items.slice(0, 3).map(item => `<span>${escapeHtml(statusLabels[item] || item)}</span>`).join('')}
    </div>
  `;
}

function renderCharacterTools(appConfig, character, config) {
  const tools = [];
  if (appConfig.voice) tools.push('语音入口已开启');
  if (appConfig.ai?.enabled) {
    const providerId = character.aiProviderId || config.aiProviders?.activeId;
    const providerName = getAiProvider(providerId)?.name || '待配置';
    const roleModel = character.aiProfiles?.[providerId]?.model;
    tools.push(`AI：${character.aiProviderId
      ? `角色独立 · ${providerName} · ${roleModel || '请到设置连接'}`
      : `跟随全局 · ${providerName}`}`);
  }
  if (!tools.length) return '';

  return `
    <div class="character-tools-phone">
      ${tools.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

function renderTags(tags = []) {
  return tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
}

function renderCharacterList(app, config, appConfig, osState = {}) {
  const characters = allCharacters(config);
  const activeCharacterId = config.apps?.character?.activeCharacterId || config.character.id;
  const canAdd = characters.length < (appConfig.maxCharacters || 3);
  const theme = getAppTheme(config, app.id);
  const titleMap = {
    wechat: '通讯录',
    qq: '联系人',
    instagram: '角色',
    x: '角色'
  };

  const themePrelude = theme === 'wechat' ? `
    <div class="wechat-directory-tools">
      <span><i>＋</i>新的角色</span>
      <span><i>群</i>角色分组</span>
      <span><i>签</i>标签</span>
    </div>
    <div class="character-section-label">A</div>
  ` : theme === 'qq' ? `
    <div class="qq-contact-search">搜索角色、状态和设定</div>
    <div class="qq-contact-tabs"><span class="active">好友</span><span>分组</span><span>设备</span><span>通讯录</span></div>
    <div class="character-section-label">特别关心 ${characters.length}</div>
  ` : theme === 'instagram' ? `
    <div class="instagram-role-rail">
      ${characters.map((character, index) => `
        <button type="button" data-character-open="${index}">
          <span><img src="${getCharacterAvatar(character)}" alt="" /></span>
          <small>${escapeHtml(character.name || `角色 ${index + 1}`)}</small>
        </button>
      `).join('')}
    </div>
    <div class="instagram-role-label"><strong>陪伴账号</strong><span>管理</span></div>
  ` : theme === 'x' ? `
    <div class="x-role-tabs"><span class="active">常用</span><span>全部角色</span></div>
    <div class="character-section-label">你的角色</div>
  ` : '';

  return `
    <section class="phone-screen phone-character-app character-layout-${theme}">
      ${renderStatusBar('chat-statusbar')}
      <header class="app-top app-top-actions">
        <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
        <h3>${escapeHtml(titleMap[theme] || app.name)}</h3>
        <button class="app-top-icon" type="button" data-character-add ${canAdd ? '' : 'disabled'} aria-label="新增角色">+</button>
      </header>
      ${renderCharacterStatus(appConfig, config, osState, config.character)}
      ${themePrelude}
      <div class="character-list-phone">
        ${characters.map((character, index) => `
          <button class="character-list-item ${character.id === activeCharacterId ? 'is-active' : ''}" type="button" data-character-open="${index}" data-character-id="${escapeHtml(character.id)}">
            <img src="${getCharacterAvatar(character)}" alt="" />
            <span>
              <strong>${escapeHtml(character.name || `角色 ${index + 1}`)}</strong>
              <small>${escapeHtml(characterPresence(config, character, osState).label)} · ${escapeHtml(character.relationship || '陪伴角色')}</small>
            </span>
            <em>${character.id === activeCharacterId ? '当前' : '›'}</em>
          </button>
        `).join('')}
      </div>
      <div class="character-list-meta">
        已创建 ${characters.length}/${appConfig.maxCharacters || 3} 个角色
      </div>
    </section>
  `;
}

function renderProfileCard(character, appConfig) {
  if (appConfig.profileCard === false) return '';
  const avatar = getCharacterAvatar(character);
  const showAvatar = appConfig.avatar !== false;

  return `
    <div class="character-card-phone ${showAvatar ? '' : 'no-avatar'}">
      ${showAvatar ? `<img src="${avatar}" alt="" />` : ''}
      <div>
        <strong data-character-card-name>${escapeHtml(character.name)}</strong>
        <span data-character-card-meta>${escapeHtml(character.relationship)} · 叫你「${escapeHtml(character.userName)}」</span>
      </div>
    </div>
  `;
}

function renderAvatarEditor(character, index) {
  return `
    <section class="character-avatar-editor">
      <header><strong>角色头像</strong><small>每个角色独立保存</small></header>
      <div class="character-avatar-current">
        <img src="${getCharacterAvatar(character)}" alt="" />
        <label>
          上传图片
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-character-avatar-upload="${index}" />
        </label>
      </div>
      <div class="character-avatar-presets">
        ${avatarPresets.map(preset => `
          <button class="${character.avatar?.type !== 'upload' && character.avatar?.value === preset.id ? 'active' : ''}" type="button" data-character-avatar-preset="${preset.id}" data-character-index="${index}">
            <img src="${getCharacterAvatar({ avatar: { type: 'preset', value: preset.id } })}" alt="" />
            <span>${preset.label}</span>
          </button>
        `).join('')}
      </div>
    </section>`;
}

function renderDeleteControls(character, characterCount, osState) {
  if (characterCount <= 1) return '';
  if (osState.characterDeleteConfirmId === character.id) {
    return `
      <div class="character-delete-confirm">
        <p>删除后，这个角色的聊天、未发送草稿、记忆、日记和问候记录都会一起清除。</p>
        <button type="button" data-character-delete-cancel>取消</button>
        <button type="button" data-character-delete-confirm="${escapeHtml(character.id)}">确认删除</button>
      </div>`;
  }
  return `
    <button class="character-delete-button" type="button" data-character-delete="${escapeHtml(character.id)}">
      删除这个角色
    </button>`;
}

function roleEntryCount(entries, characterId, fallbackCharacterId) {
  return (entries || []).filter(entry => (entry.characterId || fallbackCharacterId) === characterId).length;
}

function renderRelationshipOverview(config, character) {
  const characterId = character.id;
  const sessions = (config.apps.chat.sessions || []).filter(item => item.characterId === characterId);
  const messages = (config.apps.chat.messages || []).filter(item => item.characterId === characterId);
  const memories = roleEntryCount(config.apps.memory?.entries, characterId, config.character.id);
  const diaries = roleEntryCount(config.apps.diary?.entries, characterId, config.character.id);
  const destinations = [
    { appId: 'chat', label: '聊天', value: `${messages.length} 条`, enabled: config.apps.chat.enabled },
    { appId: 'memory', label: '记忆', value: `${memories} 条`, enabled: config.apps.memory?.enabled },
    { appId: 'diary', label: '日记', value: `${diaries} 篇`, enabled: config.apps.diary?.enabled }
  ].filter(item => item.enabled);
  return `
    <section class="character-relationship-overview">
      <header><strong>你们的记录</strong><small>${sessions.length} 个会话</small></header>
      <div>
        ${destinations.map(item => `
          <button type="button" data-character-open-context="${item.appId}" data-character-id="${escapeHtml(characterId)}">
            <span>${item.label}</span><strong>${item.value}</strong><i>›</i>
          </button>
        `).join('') || '<p>启用记忆或日记后，这里会出现角色专属记录。</p>'}
      </div>
    </section>`;
}

function renderCharacterDetail(app, config, osState, appConfig) {
  const index = selectedIndex(osState, config);
  const characters = allCharacters(config);
  const character = characters[index];
  const aiProviders = selectedAiProviders(config);
  const tags = character.personality || [];
  const tagText = tags.join('、');
  const theme = getAppTheme(config, app.id);

  return `
    <section class="phone-screen phone-character-app character-layout-${theme}">
      ${renderStatusBar('chat-statusbar')}
      <header class="app-top app-top-actions">
        <button class="chat-back" type="button" data-character-list aria-label="返回角色列表">‹</button>
        <h3>${escapeHtml(character.name || app.name)}</h3>
        <span></span>
      </header>
      ${renderCharacterStatus(appConfig, config, osState, character)}
      ${renderProfileCard(character, appConfig)}
      ${renderRelationshipOverview(config, character)}
      <div class="character-management-actions">
        <button type="button" data-character-move="-1" ${index === 0 ? 'disabled' : ''}>上移</button>
        <button type="button" data-character-move="1" ${index === characters.length - 1 ? 'disabled' : ''}>下移</button>
        <button type="button" data-character-duplicate="${escapeHtml(character.id)}" ${characters.length >= (appConfig.maxCharacters || 3) ? 'disabled' : ''}>复制角色</button>
      </div>
      ${renderCharacterTools(appConfig, character, config)}
      ${renderAvatarEditor(character, index)}
      ${osState.characterNotice ? `<p class="character-notice">${escapeHtml(osState.characterNotice)}</p>` : ''}
      <div class="phone-editor">
        <label>
          <span>角色名字</span>
          <input data-phone-field="${characterPath(index, 'name')}" value="${escapeHtml(character.name)}" maxlength="20" />
        </label>
        <label>
          <span>怎么称呼你</span>
          <input data-phone-field="${characterPath(index, 'userName')}" value="${escapeHtml(character.userName)}" maxlength="20" />
        </label>
        <label>
          <span>关系</span>
          <input data-phone-field="${characterPath(index, 'relationship')}" value="${escapeHtml(character.relationship)}" maxlength="20" />
        </label>
        <label>
          <span>性格标签</span>
          <input data-phone-list="${characterPath(index, 'personality')}" value="${escapeHtml(tagText)}" maxlength="60" />
        </label>
        <label>
          <span>说话风格</span>
          <textarea data-phone-field="${characterPath(index, 'speakingStyle')}" rows="2" maxlength="80">${escapeHtml(character.speakingStyle)}</textarea>
        </label>
        <label>
          <span>开场白</span>
          <textarea data-phone-field="${characterPath(index, 'greeting')}" rows="3" maxlength="120">${escapeHtml(character.greeting)}</textarea>
        </label>
        <label>
          <span>角色设定</span>
          <textarea data-phone-field="${characterPath(index, 'definition')}" rows="5" maxlength="700">${escapeHtml(character.definition || '')}</textarea>
        </label>
        ${config.apps?.settings?.perRoleApi ? `
          <label>
            <span>角色使用的 AI</span>
            <select data-phone-field="${characterPath(index, 'aiProviderId')}">
              <option value="">跟随全局设置</option>
              ${aiProviders.map(provider => `
                <option value="${provider.id}" ${character.aiProviderId === provider.id ? 'selected' : ''}>独立配置 · ${escapeHtml(provider.name)}</option>
              `).join('')}
            </select>
          </label>
        ` : ''}
      </div>
      <div class="character-tags-phone" data-character-tags>
        ${renderTags(tags)}
      </div>
      ${renderDeleteControls(character, characters.length, osState)}
    </section>
  `;
}

function syncCharacterPreview(container, config, osState) {
  const index = selectedIndex(osState, config);
  const character = allCharacters(config)[index];
  const cardName = container.querySelector('[data-character-card-name]');
  if (cardName) cardName.textContent = character.name;

  const cardMeta = container.querySelector('[data-character-card-meta]');
  if (cardMeta) {
    cardMeta.textContent = `${character.relationship} · 叫你「${character.userName}」`;
  }

  const captionName = container.querySelector('.os-caption strong');
  if (captionName) captionName.textContent = `${config.character.name || '我的'}的小手机`;

  const tags = container.querySelector('[data-character-tags]');
  if (tags) tags.innerHTML = renderTags(character.personality || []);
}

function newCharacterTemplate(config, nextNumber) {
  return {
    ...config.character,
    id: `character-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `新角色 ${nextNumber}`,
    relationship: '待设定',
    personality: ['待了解'],
    greeting: '你好，我刚刚住进这台小手机。',
    definition: '这是一个新角色，请补充他/她是谁、如何陪伴用户、说话边界和关系方向。',
    avatar: { type: 'preset', value: avatarPresets[(nextNumber - 1) % avatarPresets.length].id },
    aiProviderId: '',
    aiProfiles: {}
  };
}

export const CharacterApp = {
  render(app, config, osState = {}) {
    const appConfig = characterAppConfig(config);
    const view = osState.characterView || 'list';
    if (view === 'detail') return renderCharacterDetail(app, config, osState, appConfig);
      return renderCharacterList(app, config, appConfig, osState);
  },

  bind(container, config, handlers, osState = {}) {
    container.querySelector('[data-character-list]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ characterView: 'list' });
    });

    container.querySelectorAll('[data-character-open]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.characterOpen);
        const character = allCharacters(config)[index];
        if (!character) return;
        if (handlers.selectCharacter) {
          handlers.selectCharacter(character.id, {
            characterView: 'detail',
            characterDeleteConfirmId: null
          });
        } else {
          handlers.updatePhoneState?.({
            characterView: 'detail',
            selectedCharacterId: character.id,
            selectedCharacterIndex: index
          });
        }
      });
    });

    container.querySelector('[data-character-add]')?.addEventListener('click', event => {
      if (event.currentTarget.disabled) return;
      const existing = config.characters || [];
      const nextCharacter = newCharacterTemplate(config, existing.length + 2);
      handlers.updatePath?.('characters', [...existing, nextCharacter], { noRender: true });
      handlers.selectCharacter?.(nextCharacter.id, {
        characterView: 'detail',
        characterDeleteConfirmId: null
      });
    });

    container.querySelectorAll('[data-character-avatar-preset]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.characterIndex);
        handlers.updatePath?.(characterPath(index, 'avatar'), {
          type: 'preset',
          value: button.dataset.characterAvatarPreset
        }, { keepPhone: true });
      });
    });

    container.querySelector('[data-character-avatar-upload]')?.addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        handlers.updatePhoneState?.({ characterNotice: '请选择不超过 8MB 的图片。' });
        return;
      }
      const index = Number(event.currentTarget.dataset.characterAvatarUpload);
      try {
        const image = await resizeAvatar(file);
        osState.characterNotice = '';
        handlers.updatePath?.(characterPath(index, 'avatar'), {
          type: 'upload',
          value: image
        }, { keepPhone: true });
      } catch (error) {
        handlers.updatePhoneState?.({ characterNotice: error.message || '头像处理失败，请换一张图片。' });
      }
    });

    container.querySelectorAll('[data-character-move]').forEach(button => {
      button.addEventListener('click', () => {
        const character = allCharacters(config)[selectedIndex(osState, config)];
        handlers.moveCharacter?.(character?.id, Number(button.dataset.characterMove));
      });
    });
    container.querySelector('[data-character-duplicate]')?.addEventListener('click', event => {
      handlers.duplicateCharacter?.(event.currentTarget.dataset.characterDuplicate);
    });
    container.querySelectorAll('[data-character-open-context]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.openCharacterContext?.(
          button.dataset.characterOpenContext,
          button.dataset.characterId
        );
      });
    });

    container.querySelector('[data-character-delete]')?.addEventListener('click', event => {
      handlers.updatePhoneState?.({ characterDeleteConfirmId: event.currentTarget.dataset.characterDelete });
    });
    container.querySelector('[data-character-delete-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ characterDeleteConfirmId: null });
    });
    container.querySelector('[data-character-delete-confirm]')?.addEventListener('click', event => {
      handlers.deleteCharacter?.(event.currentTarget.dataset.characterDeleteConfirm);
    });

    container.querySelectorAll('[data-phone-field]').forEach(input => {
      const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(eventName, () => {
        handlers.updatePath?.(input.dataset.phoneField, input.value, { noRender: true });
        syncCharacterPreview(container, config, osState);
      });
      input.addEventListener('change', () => {
        handlers.updatePath?.(input.dataset.phoneField, input.value, { keepPhone: true });
      });
    });

    container.querySelectorAll('[data-phone-list]').forEach(input => {
      const syncList = options => {
        const value = input.value
          .split(/[、，,\s]+/)
          .map(item => item.trim())
          .filter(Boolean)
          .slice(0, 5);
        handlers.updatePath?.(input.dataset.phoneList, value, options);
        syncCharacterPreview(container, config, osState);
      };
      input.addEventListener('input', () => syncList({ noRender: true }));
      input.addEventListener('change', () => syncList({ keepPhone: true }));
    });
  }
};

