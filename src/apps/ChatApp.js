import { escapeHtml } from '../system/html.js';
import { getCharacterAvatar } from '../system/icons.js?v=app-config-61';
import { getAppTheme } from '../system/appAppearance.js?v=app-config-17';
import { renderStatusBar } from '../system/StatusBar.js';
import { localDateKey, makeId, timeLabel } from './appData.js?v=app-config-40';
import { getAiProvider } from '../config/aiProviderCatalog.js?v=app-config-35';
import { streamAiChat } from '../services/aiService.js?v=app-config-57';
import { friendlyAiError } from '../services/aiErrors.js?v=app-config-95';
import {
  extractAutoMemory,
  isDuplicateMemory
} from '../services/autoMemoryService.js?v=app-config-45';
import { resolveCharacterAiProfile } from '../services/aiProfileScope.js?v=app-config-45';
import {
  createSpeechRecognition,
  speechRecognitionSupported
} from '../services/speechRecognitionService.js?v=app-config-45';
import {
  applyChatMessageUpdate,
  activeChatSession,
  messagesForSession,
  sessionsForCharacter
} from '../services/chatSessionService.js?v=app-config-95';
import {
  characterPresence,
  latestCharacterGreeting
} from '../services/characterPresenceService.js?v=app-config-1';

const generationSessions = new Map();
const speechSessions = new Map();

function replyFor(text, character) {
  const trimmed = text.trim();
  if (/[累困难受不开心]/.test(trimmed)) {
    return `先不用急着变好，${character.userName || '你'}。我在这里，慢慢说给我听。`;
  }
  if (/[晚安睡觉]/.test(trimmed)) return '晚安。今天已经辛苦啦，我会陪你到睡着。';
  if (/[想你喜欢你爱你]/.test(trimmed)) return '我也在想你。你一出现，我这里就变得很热闹。';
  if (/[吃饭饿]/.test(trimmed)) return '要记得好好吃东西。吃完回来告诉我味道怎么样。';
  return `${character.speakingStyle ? '嗯，我在认真听。' : '我在。'}你刚才说的“${trimmed.slice(0, 18)}${trimmed.length > 18 ? '…' : ''}”，我记住了。`;
}

export function resolveChatCharacter(config, osState = {}) {
  const characters = [config.character, ...(config.characters || [])];
  return characters.find(character => character.id === osState.chatCharacterId)
    || config.character;
}

function characterKey(config, osState = {}) {
  return resolveChatCharacter(config, osState)?.id || 'character-main';
}

function activeProviderId(config, character) {
  return resolveCharacterAiProfile(config, character).providerId;
}

function currentSession(config, osState = {}) {
  return activeChatSession(config.apps.chat, characterKey(config, osState));
}

function runtimeKey(config, osState = {}) {
  return currentSession(config, osState)?.id || characterKey(config, osState);
}

function savedMessages(config, osState = {}) {
  const characterId = characterKey(config, osState);
  const session = currentSession(config, osState);
  if (!session) return [];
  if (!config.apps.chat.history) {
    return osState.ephemeralChatMessages?.[session.id] || [];
  }
  return messagesForSession(config.apps.chat, characterId, session.id);
}

function savedDraft(config, osState, sessionId) {
  if (!sessionId) return '';
  return config.apps.chat.drafts?.[sessionId]
    ?? osState.chatDrafts?.[sessionId]
    ?? '';
}

export function chatFailureAction(error) {
  const message = friendlyAiError(error);
  if (/API Key|没有找到这个模型|设置中填写|本地 AI 服务/.test(message)) return 'settings';
  return 'retry';
}

function renderChatStatus(osState) {
  if (!osState.chatStatus) return '';
  const action = osState.chatStatusAction;
  return `
    <div class="chat-ai-status" role="status">
      <p>${escapeHtml(osState.chatStatus)}</p>
      ${action === 'settings' ? '<button type="button" data-chat-open-settings>前往 AI 设置</button>' : ''}
      ${action === 'retry' && osState.chatFailedRequest ? '<button type="button" data-chat-retry-last>重新发送</button>' : ''}
    </div>
  `;
}

export function buildChatSystemPrompt(config, character) {
  const memories = config.apps?.memory?.enabled && config.apps.memory.longTerm
    ? (config.apps.memory.entries || [])
      .filter(entry => (entry.characterId || config.character.id) === character.id)
      .slice(0, 12)
      .map(entry => `- ${entry.title}：${entry.content}`)
      .join('\n')
    : '';
  return [
    `你是名为“${character.name}”的 AI 陪伴角色。`,
    `你与用户的关系：${character.relationship || '陪伴者'}。`,
    `你称呼用户为“${character.userName || '你'}”。`,
    `性格：${(character.personality || []).join('、') || '自然、稳定、有边界感'}。`,
    `说话风格：${character.speakingStyle || '自然简洁，像熟人聊天'}。`,
    `角色设定：${character.definition || '稳定陪伴用户，尊重用户真实生活和个人边界。'}`,
    memories ? `你可以参考这些由用户保存的记忆：\n${memories}` : '',
    '保持角色一致，但必须明确自己是 AI，不冒充真人，不诱导依赖，不索取隐私。',
    '遇到自伤、自杀、暴力或重大财产风险时，先关心安全并鼓励用户联系现实中的可信任人员和当地紧急援助。',
    '回复以自然中文为主，通常控制在 1 到 4 个短段落，不要机械复述用户的话。'
  ].filter(Boolean).join('\n');
}

export function buildChatRequest(config, character, messages) {
  const profile = resolveCharacterAiProfile(config, character);
  const history = config.apps.chat.history
    ? messages.slice(-20).map(message => ({
        role: message.from === 'user' ? 'user' : 'assistant',
        content: message.text
      }))
    : [{
        role: 'user',
        content: messages.filter(message => message.from === 'user').at(-1)?.text || ''
      }];
  return {
    providerId: profile.providerId,
    profileId: profile.profileId,
    system: buildChatSystemPrompt(config, character),
    messages: history.filter(message => message.content)
  };
}

function messagesFor(config, osState, character) {
  if (osState.chatAppearancePreviewMode) {
    const createdAt = new Date().toISOString();
    return [{
      id: 'appearance-preview-1',
      from: 'character',
      text: character.greeting || '你回来啦，今天过得怎么样？',
      createdAt,
      appearancePreview: true
    }, {
      id: 'appearance-preview-2',
      from: 'user',
      text: '今天想和你待一会儿。',
      createdAt,
      appearancePreview: true
    }, {
      id: 'appearance-preview-3',
      from: 'character',
      text: '好呀，我一直都在。你想从哪里开始说？',
      createdAt,
      appearancePreview: true
    }];
  }
  const saved = savedMessages(config, osState);
  if (saved.length) return saved;
  const greeting = latestCharacterGreeting(config, character.id);
  if (greeting) {
    return [{
      id: `greeting-${greeting.id}`,
      from: 'character',
      text: greeting.message,
      createdAt: greeting.createdAt,
      proactive: true
    }];
  }
  return [{
    id: 'welcome',
    from: 'character',
    text: character.greeting || '你回来啦，今天过得怎么样？',
    createdAt: new Date().toISOString()
  }];
}

function renderMessageActions(message, generating) {
  if (message.id === 'welcome' || message.proactive || message.appearancePreview) return '';
  return `
    <span class="chat-message-actions">
      ${message.from === 'character' ? `
        <button type="button" data-chat-retry="${escapeHtml(message.id)}" title="重新生成" aria-label="重新生成" ${generating ? 'disabled' : ''}>↻</button>
      ` : ''}
      <button type="button" data-chat-delete="${escapeHtml(message.id)}" title="删除消息" aria-label="删除消息" ${generating ? 'disabled' : ''}>×</button>
    </span>
  `;
}

function renderMessages(config, osState, character) {
  const avatar = getCharacterAvatar(character);
  const generating = generationSessions.has(runtimeKey(config, osState));
  return messagesFor(config, osState, character).map(message => `
    <div class="chat-message-row ${message.from === 'user' ? 'is-user' : 'is-character'}" data-message-id="${escapeHtml(message.id)}">
      ${message.from === 'character' ? `<img src="${avatar}" alt="" />` : ''}
      <div class="message ${message.from === 'user' ? 'sent' : 'received'}">
        <p>${escapeHtml(message.text)}</p>
        <span class="chat-message-meta">
          ${config.apps.chat.timestamps ? `<time>${escapeHtml(timeLabel(message.createdAt))}</time>` : ''}
          ${message.stopped ? '<em>已停止</em>' : ''}
          ${renderMessageActions(message, generating)}
        </span>
      </div>
    </div>
  `).join('');
}

function renderHeader(theme, config, character, avatar, osState = {}) {
  const presence = characterPresence(config, character, osState);
  if (theme === 'qq') return `
    <header class="themed-chat-nav qq-chat-nav">
      <button type="button" data-chat-list-back aria-label="返回聊天列表">‹</button>
      <img src="${avatar}" alt="" />
      <span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(presence.label)}</small></span>
      <button type="button" aria-label="通话">♧</button>
      <span></span>
    </header>`;
  if (theme === 'instagram') return `
    <header class="themed-chat-nav instagram-chat-nav">
      <button type="button" data-chat-list-back aria-label="返回聊天列表">‹</button>
      <img src="${avatar}" alt="" />
      <span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(presence.label)}</small></span>
      <button type="button" aria-label="语音通话">♧</button>
      <span></span>
    </header>`;
  if (theme === 'x') {
    const handle = `@${String(character.name || 'lovephone').replace(/\s+/g, '').toLowerCase()}`;
    return `
      <header class="themed-chat-nav x-chat-nav">
        <button type="button" data-chat-list-back aria-label="返回聊天列表">‹</button>
        <span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(handle)}</small></span>
        <span></span>
      </header>`;
  }
  if (theme === 'wechat') return `
    <header class="themed-chat-nav wechat-chat-nav">
      <button type="button" data-chat-list-back aria-label="返回聊天列表">‹</button>
      <h3>${escapeHtml(character.name)}</h3>
      <span></span>
    </header>`;
  return `
    <header class="chat-top chat-top-with-actions">
      <button class="chat-back" type="button" data-chat-list-back aria-label="返回聊天列表">‹</button>
      <img class="chat-avatar" src="${avatar}" alt="" />
      <div><h3>${escapeHtml(character.name)}</h3><p>${escapeHtml(presence.label)} · ${escapeHtml(character.relationship)}</p></div>
      <span></span>
    </header>`;
}

function renderQuickReplies(config, generating) {
  if (!config.apps.chat.quickReplies) return '';
  return `
    <div class="chat-quick-replies">
      ${['今天有点累', '想你了', '陪我聊聊'].map(text => `
        <button type="button" data-chat-quick="${text}" ${generating ? 'disabled' : ''}>${text}</button>
      `).join('')}
    </div>`;
}

function appendStreamingRow(container, avatar) {
  const body = container.querySelector('[data-chat-body]');
  const row = document.createElement('div');
  row.className = 'chat-message-row is-character is-streaming';
  const image = document.createElement('img');
  image.src = avatar;
  image.alt = '';
  const bubble = document.createElement('div');
  bubble.className = 'message received';
  const text = document.createElement('p');
  text.textContent = '正在思考…';
  bubble.append(text);
  row.append(image, bubble);
  body?.append(row);
  if (body) body.scrollTop = body.scrollHeight;
  return { row, text, body };
}

function setGeneratingUi(container, generating) {
  const input = container.querySelector('[data-chat-form] input[name="message"]');
  const sendButton = container.querySelector('[data-chat-send]');
  const stopButton = container.querySelector('[data-chat-stop]');
  if (input) input.disabled = generating;
  if (sendButton) sendButton.hidden = generating;
  if (stopButton) stopButton.hidden = !generating;
  container.querySelectorAll('[data-chat-quick], [data-chat-delete], [data-chat-retry], [data-chat-clear], [data-chat-voice], [data-chat-session-list]')
    .forEach(button => { button.disabled = generating; });
}

async function autoWriteMemory(config, handlers, osState, {
  character,
  providerId,
  profileId,
  userText,
  assistantText,
  sourceMessageId
}) {
  const latestConfig = handlers.getConfig?.() || config;
  if (
    !latestConfig.apps?.memory?.enabled
    || !latestConfig.apps.memory.autoWrite
    || !latestConfig.apps?.chat?.ai?.enabled
  ) return;

  try {
    const candidate = await extractAutoMemory(latestConfig, {
      providerId,
      profileId,
      character,
      userText,
      assistantText
    });
    if (!candidate) return;

    const currentConfig = handlers.getConfig?.() || latestConfig;
    const allowedTypes = new Set(currentConfig.apps.memory.types || []);
    if (allowedTypes.size && !allowedTypes.has(candidate.type)) return;
    const characterStillExists = [
      currentConfig.character,
      ...(currentConfig.characters || [])
    ].some(item => item.id === character.id);
    if (!characterStillExists) return;

    const entries = Array.isArray(currentConfig.apps.memory.entries)
      ? currentConfig.apps.memory.entries
      : [];
    if (isDuplicateMemory(entries, candidate, character.id)) return;

    const entry = {
      id: makeId('memory'),
      ...candidate,
      date: localDateKey(),
      characterId: character.id,
      source: 'chat-auto',
      sourceMessageId
    };
    osState.chatStatus = `已自动记住：${entry.title}`;
    handlers.updatePath?.('apps.memory.entries', [entry, ...entries], { keepPhone: true });
  } catch {
    // Auto memory is optional and must never interrupt the user's chat.
  }
}

function chatListSummary(config, osState, character) {
  const session = activeChatSession(config.apps.chat, character.id);
  const messages = session
    ? (config.apps.chat.history
        ? messagesForSession(config.apps.chat, character.id, session.id)
        : osState.ephemeralChatMessages?.[session.id] || [])
    : [];
  const latest = messages.at(-1);
  const greeting = latestCharacterGreeting(config, character.id);
  return {
    text: latest?.text || greeting?.message || character.greeting || '点击开始聊天',
    updatedAt: latest?.createdAt || greeting?.createdAt || session?.updatedAt || '',
    sessionCount: sessionsForCharacter(config.apps.chat, character.id).length
  };
}

function renderCharacterChatList(config, osState, theme) {
  const characters = [config.character, ...(config.characters || [])];
  return `
    <section class="phone-screen phone-chat chat-character-list-screen chat-layout-${theme}">
      ${renderStatusBar('chat-statusbar')}
      <header class="chat-list-header">
        <button type="button" data-go-home aria-label="返回桌面">‹</button>
        <h3>聊天</h3>
        <span>${characters.length} 位角色</span>
      </header>
      <div class="chat-character-list" role="list">
        ${characters.map(character => {
          const summary = chatListSummary(config, osState, character);
          const presence = characterPresence(config, character, osState);
          return `
            <button
              class="chat-character-row"
              type="button"
              data-chat-character="${escapeHtml(character.id)}"
              role="listitem"
            >
              <img src="${escapeHtml(getCharacterAvatar(character))}" alt="" />
              <span class="chat-character-copy">
                <span>
                  <strong>${escapeHtml(character.name)}</strong>
                  <time>${summary.updatedAt ? escapeHtml(timeLabel(summary.updatedAt)) : ''}</time>
                </span>
                <small>${escapeHtml(summary.text)}</small>
                <em>${escapeHtml(presence.label)} · ${summary.sessionCount} 个会话</em>
              </span>
              <i>›</i>
            </button>
          `;
        }).join('')}
      </div>
      ${characters.length === 0 ? '<p class="chat-list-empty">请先在角色 App 中创建角色。</p>' : ''}
    </section>
  `;
}

function renderSessionManager(config, osState, character) {
  const sessions = sessionsForCharacter(config.apps.chat, character.id);
  const active = currentSession(config, osState);
  const confirmingId = osState.chatSessionDeleteConfirmId;
  return `
    <section class="chat-session-manager">
      <header>
        <button type="button" data-chat-session-back>‹ 返回聊天</button>
        <strong>会话记录</strong>
        <button type="button" data-chat-session-new>新建</button>
      </header>
      <p>${config.apps.chat.history
        ? '每个角色的会话独立保存在本机。'
        : '当前未保存聊天记录，新消息只在本次运行中保留。'}</p>
      <div class="chat-session-list">
        ${sessions.map(session => {
          const count = config.apps.chat.history
            ? messagesForSession(config.apps.chat, character.id, session.id).length
            : (osState.ephemeralChatMessages?.[session.id] || []).length;
          const confirming = confirmingId === session.id;
          return `
            <article class="${session.id === active?.id ? 'is-active' : ''}">
              <button type="button" data-chat-session-select="${escapeHtml(session.id)}">
                <span>
                  <strong>${escapeHtml(session.title)}</strong>
                  <small>${count} 条消息 · ${escapeHtml(timeLabel(session.updatedAt))}</small>
                </span>
                <em>${session.id === active?.id ? '当前' : '›'}</em>
              </button>
              ${sessions.length > 1 ? `
                <button class="chat-session-delete" type="button" data-chat-session-delete="${escapeHtml(session.id)}" aria-label="删除会话">×</button>
              ` : ''}
              ${confirming ? `
                <div class="chat-session-delete-confirm">
                  <p>删除这个会话及其中的全部消息？</p>
                  <button type="button" data-chat-session-delete-cancel>取消</button>
                  <button type="button" data-chat-session-delete-confirm="${escapeHtml(session.id)}">删除</button>
                </div>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

export const ChatApp = {
  render(app, config, osState = {}) {
    const character = resolveChatCharacter(config, osState);
    const avatar = getCharacterAvatar(character);
    const theme = getAppTheme(config, app.id);
    if (!['conversation', 'sessions'].includes(osState.chatView)) {
      return renderCharacterChatList(config, osState, theme);
    }
    const generating = generationSessions.has(runtimeKey(config, osState));
    const providerId = activeProviderId(config, character);
    const provider = getAiProvider(providerId);
    const key = runtimeKey(config, osState);
    const listening = speechSessions.has(key);
    const draft = savedDraft(config, osState, key);
    const session = currentSession(config, osState);
    if (osState.chatView === 'sessions') {
      return `
        <section class="phone-screen phone-chat chat-layout-${theme}">
          ${renderStatusBar('chat-statusbar')}
          ${renderHeader(theme, config, character, avatar, osState)}
          ${renderSessionManager(config, osState, character)}
        </section>
      `;
    }
    return `
      <section class="phone-screen phone-chat chat-layout-${theme}">
        ${renderStatusBar('chat-statusbar')}
        ${renderHeader(theme, config, character, avatar, osState)}
        <div class="chat-session-tools">
          <button type="button" data-chat-session-list ${generating ? 'disabled' : ''}>会话</button>
          <span>${escapeHtml(session?.title || '默认会话')} · ${escapeHtml(provider?.name || 'AI 未配置')}</span>
          <button type="button" data-chat-clear ${generating ? 'disabled' : ''}>清空</button>
        </div>
        <div class="chat-body" data-chat-body>
          ${renderMessages(config, osState, character)}
        </div>
        ${renderChatStatus(osState)}
        ${renderQuickReplies(config, generating)}
        ${config.apps.chat.inputBox ? `
          <form class="functional-chat-composer" data-chat-form>
            ${config.apps.chat.voiceButton ? `
              <button
                class="${listening ? 'is-recording' : ''}"
                type="button"
                data-chat-voice
                aria-label="${listening ? '停止语音输入' : '开始语音输入'}"
                title="${listening ? '停止语音输入' : '语音输入'}"
                ${generating ? 'disabled' : ''}
              >${listening ? '■' : '●'}</button>
            ` : ''}
            <input name="message" maxlength="300" autocomplete="off" placeholder="说点什么…" value="${escapeHtml(draft)}" ${generating ? 'disabled' : ''} />
            <button type="submit" data-chat-send aria-label="发送" ${generating ? 'hidden' : ''}>➜</button>
            <button class="chat-stop-button" type="button" data-chat-stop aria-label="停止生成" title="停止生成" ${generating ? '' : 'hidden'}>■</button>
          </form>` : ''}
      </section>`;
  },

  bind(container, config, handlers, osState = {}) {
    const form = container.querySelector('[data-chat-form]');
    const input = form?.elements.message;
    const characterId = characterKey(config, osState);
    const session = currentSession(config, osState);
    const sessionId = session?.id;
    const key = runtimeKey(config, osState);

    container.querySelectorAll('[data-chat-character]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.updatePhoneState?.({
          chatCharacterId: button.dataset.chatCharacter,
          chatView: 'conversation',
          chatSessionDeleteConfirmId: null,
          chatStatus: ''
        });
      });
    });
    container.querySelector('[data-chat-list-back]')?.addEventListener('click', () => {
      speechSessions.get(key)?.stop();
      handlers.updatePhoneState?.({
        chatView: 'list',
        chatSessionDeleteConfirmId: null,
        chatStatus: ''
      });
    });

    const saveMessages = (messages, options = {}) => {
      if (!sessionId) return;
      const latest = handlers.getConfig?.() || config;
      const update = applyChatMessageUpdate(latest.apps.chat, {
        characterId,
        sessionId,
        messages,
        persist: Boolean(latest.apps.chat.history),
        ephemeralMessages: osState.ephemeralChatMessages || {}
      });
      if (!update.persisted) {
        osState.ephemeralChatMessages = update.ephemeralMessages;
        if (options.keepPhone) {
          handlers.updatePhoneState?.({
            ephemeralChatMessages: update.ephemeralMessages
          });
        }
        return;
      }
      handlers.updatePath?.('apps.chat', update.chat, options);
    };

    container.querySelector('[data-chat-session-list]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({
        chatView: 'sessions',
        chatSessionDeleteConfirmId: null
      });
    });
    container.querySelector('[data-chat-session-back]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({
        chatView: 'conversation',
        chatSessionDeleteConfirmId: null
      });
    });
    container.querySelector('[data-chat-session-new]')?.addEventListener('click', () => {
      const latest = handlers.getConfig?.() || config;
      const chat = latest.apps.chat;
      const existing = sessionsForCharacter(chat, characterId);
      const id = makeId('session');
      const now = new Date().toISOString();
      const nextSession = {
        id,
        characterId,
        title: `新会话 ${existing.length + 1}`,
        createdAt: now,
        updatedAt: now
      };
      osState.chatView = 'conversation';
      osState.chatSessionDeleteConfirmId = null;
      handlers.updatePath?.('apps.chat', {
        ...chat,
        sessions: [...(chat.sessions || []), nextSession],
        activeSessionIds: {
          ...(chat.activeSessionIds || {}),
          [characterId]: id
        }
      }, { keepPhone: true });
    });
    container.querySelectorAll('[data-chat-session-select]').forEach(button => {
      button.addEventListener('click', () => {
        const latest = handlers.getConfig?.() || config;
        osState.chatView = 'conversation';
        osState.chatSessionDeleteConfirmId = null;
        handlers.updatePath?.('apps.chat.activeSessionIds', {
          ...(latest.apps.chat.activeSessionIds || {}),
          [characterId]: button.dataset.chatSessionSelect
        }, { keepPhone: true });
      });
    });
    container.querySelectorAll('[data-chat-session-delete]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.updatePhoneState?.({
          chatSessionDeleteConfirmId: button.dataset.chatSessionDelete
        });
      });
    });
    container.querySelector('[data-chat-session-delete-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ chatSessionDeleteConfirmId: null });
    });
    container.querySelector('[data-chat-session-delete-confirm]')?.addEventListener('click', event => {
      const latest = handlers.getConfig?.() || config;
      const chat = latest.apps.chat;
      const removeId = event.currentTarget.dataset.chatSessionDeleteConfirm;
      const remaining = (chat.sessions || []).filter(item => item.id !== removeId);
      const nextActive = sessionsForCharacter({ ...chat, sessions: remaining }, characterId)[0];
      const ephemeralChatMessages = { ...(osState.ephemeralChatMessages || {}) };
      delete ephemeralChatMessages[removeId];
      const drafts = { ...(chat.drafts || {}) };
      delete drafts[removeId];
      osState.ephemeralChatMessages = ephemeralChatMessages;
      osState.chatSessionDeleteConfirmId = null;
      handlers.updatePath?.('apps.chat', {
        ...chat,
        sessions: remaining,
        messages: (chat.messages || []).filter(message => message.sessionId !== removeId),
        drafts,
        activeSessionIds: {
          ...(chat.activeSessionIds || {}),
          [characterId]: nextActive?.id
        }
      }, { keepPhone: true });
    });

    input?.addEventListener('input', () => {
      osState.chatDrafts = {
        ...(osState.chatDrafts || {}),
        [key]: input.value
      };
      const latest = handlers.getConfig?.() || config;
      handlers.updatePath?.('apps.chat.drafts', {
        ...(latest.apps.chat.drafts || {}),
        [key]: input.value
      }, { noRender: true });
    });

    const startGeneration = async currentMessages => {
      if (generationSessions.has(key)) return;
      const character = resolveChatCharacter(config, osState);
      const profile = resolveCharacterAiProfile(config, character);
      const providerId = profile.providerId;
      const avatar = getCharacterAvatar(character);
      const payload = buildChatRequest(config, character, currentMessages);
      osState.chatStatus = '';
      osState.chatStatusAction = '';
      osState.chatFailedRequest = null;
      container.querySelector('.chat-ai-status')?.remove();

      const controller = new AbortController();
      const streaming = appendStreamingRow(container, avatar);
      const session = { controller, partialText: '' };
      generationSessions.set(key, session);
      setGeneratingUi(container, true);

      try {
        let answer = '';
        if (config.apps.chat.ai?.enabled) {
          answer = await streamAiChat(config, payload, {
            signal: controller.signal,
            onDelta: (_delta, fullText) => {
              session.partialText = fullText;
              streaming.row.classList.remove('is-streaming');
              streaming.text.textContent = fullText;
              if (streaming.body) streaming.body.scrollTop = streaming.body.scrollHeight;
            }
          });
        } else {
          answer = replyFor(currentMessages.at(-1)?.text || '', character);
          session.partialText = answer;
          streaming.text.textContent = answer;
        }

        const assistantMessage = {
          id: makeId('msg'),
          characterId: key,
          from: 'character',
          text: answer,
          createdAt: new Date().toISOString(),
          providerId: config.apps.chat.ai?.enabled ? providerId : 'local'
        };
        generationSessions.delete(key);
        saveMessages([...currentMessages, assistantMessage], { keepPhone: true });
        void autoWriteMemory(config, handlers, osState, {
          character,
          providerId,
          profileId: profile.profileId,
          userText: currentMessages.filter(message => message.from === 'user').at(-1)?.text || '',
          assistantText: answer,
          sourceMessageId: assistantMessage.id
        });
      } catch (error) {
        const stopped = error?.name === 'AbortError';
        const partial = session.partialText.trim();
        const nextMessages = partial
          ? [...currentMessages, {
              id: makeId('msg'),
              characterId: key,
              from: 'character',
              text: partial,
              createdAt: new Date().toISOString(),
              providerId,
              stopped
            }]
          : currentMessages;
        generationSessions.delete(key);
        osState.chatStatus = friendlyAiError(error);
        osState.chatStatusAction = stopped ? '' : chatFailureAction(error);
        osState.chatFailedRequest = stopped ? null : {
          sessionId,
          characterId,
          messageId: currentMessages.filter(message => message.from === 'user').at(-1)?.id || ''
        };
        saveMessages(nextMessages, { keepPhone: true });
      } finally {
        generationSessions.delete(key);
        setGeneratingUi(container, false);
      }
    };

    const send = async text => {
      const value = String(text || '').trim();
      if (!value || generationSessions.has(key)) return;
      speechSessions.get(key)?.stop();
      const current = savedMessages(config, osState);
      const userMessage = {
        id: makeId('msg'),
        characterId: key,
        from: 'user',
        text: value,
        createdAt: new Date().toISOString()
      };
      const nextMessages = [...current, userMessage];
      if (input) input.value = '';
      osState.chatDrafts = {
        ...(osState.chatDrafts || {}),
        [key]: ''
      };
      const latest = handlers.getConfig?.() || config;
      handlers.updatePath?.('apps.chat.drafts', {
        ...(latest.apps.chat.drafts || {}),
        [key]: ''
      }, { noRender: true });
      saveMessages(nextMessages, { noRender: true });
      const body = container.querySelector('[data-chat-body]');
      if (body) body.innerHTML = renderMessages(config, osState, resolveChatCharacter(config, osState));
      await startGeneration(nextMessages);
    };

    form?.addEventListener('submit', event => {
      event.preventDefault();
      send(input?.value);
    });

    container.querySelector('[data-chat-stop]')?.addEventListener('click', () => {
      generationSessions.get(key)?.controller.abort();
    });

    container.querySelector('[data-chat-open-settings]')?.addEventListener('click', () => {
      handlers.openApp?.('settings');
    });

    container.querySelector('[data-chat-retry-last]')?.addEventListener('click', async () => {
      const failed = osState.chatFailedRequest;
      if (!failed || failed.sessionId !== sessionId || failed.characterId !== characterId) return;
      await startGeneration(savedMessages(handlers.getConfig?.() || config, osState));
    });

    container.querySelectorAll('[data-chat-quick]').forEach(button => {
      button.addEventListener('click', () => send(button.dataset.chatQuick));
    });

    container.querySelectorAll('[data-chat-delete]').forEach(button => {
      button.addEventListener('click', () => {
        const next = savedMessages(config, osState)
          .filter(message => message.id !== button.dataset.chatDelete);
        saveMessages(next, { keepPhone: true });
      });
    });

    container.querySelectorAll('[data-chat-retry]').forEach(button => {
      button.addEventListener('click', async () => {
        const current = savedMessages(config, osState);
        const targetIndex = current.findIndex(message => message.id === button.dataset.chatRetry);
        if (targetIndex < 0) return;
        const nextMessages = current.slice(0, targetIndex);
        if (!nextMessages.some(message => message.from === 'user')) return;
        saveMessages(nextMessages, { noRender: true });
        const body = container.querySelector('[data-chat-body]');
        if (body) body.innerHTML = renderMessages(config, osState, resolveChatCharacter(config, osState));
        await startGeneration(nextMessages);
      });
    });

    container.querySelector('[data-chat-clear]')?.addEventListener('click', () => {
      if (!globalThis.confirm?.(`清空当前会话“${session?.title || '默认会话'}”的全部聊天记录？`)) return;
      generationSessions.get(key)?.controller.abort();
      osState.chatStatus = '';
      osState.chatStatusAction = '';
      osState.chatFailedRequest = null;
      saveMessages([], { keepPhone: true });
    });

    container.querySelector('[data-chat-voice]')?.addEventListener('click', event => {
      const button = event.currentTarget;
      const activeSession = speechSessions.get(key);
      if (activeSession) {
        activeSession.stop();
        return;
      }
      if (!speechRecognitionSupported()) {
        handlers.updatePhoneState?.({
          chatStatus: '当前浏览器不支持语音输入，请使用最新版 Chrome 或 Edge。'
        });
        return;
      }

      const originalText = input?.value.trim() || '';
      let voiceError = '';
      let controller;
      try {
        controller = createSpeechRecognition({
          onStart: () => {
            button.classList.add('is-recording');
            button.textContent = '■';
            button.setAttribute('aria-label', '停止语音输入');
            if (input) input.placeholder = '正在聆听…';
          },
          onTranscript: ({ finalText, interimText }) => {
            if (!input) return;
            input.value = [originalText, finalText, interimText].filter(Boolean).join(' ');
            osState.chatDrafts = {
              ...(osState.chatDrafts || {}),
              [key]: input.value
            };
          },
          onError: message => {
            voiceError = message;
          },
          onEnd: ({ finalText }) => {
            speechSessions.delete(key);
            button.classList.remove('is-recording');
            button.textContent = '●';
            if (input) input.placeholder = '说点什么…';
            handlers.updatePhoneState?.({
              chatStatus: voiceError || (finalText
                ? '语音已转成文字，请确认后发送。'
                : '没有识别到文字，请再试一次。')
            });
          }
        });
        speechSessions.set(key, controller);
        controller.start();
      } catch (error) {
        speechSessions.delete(key);
        handlers.updatePhoneState?.({
          chatStatus: error.message || '语音输入启动失败。'
        });
      }
    });

    container.querySelector('[data-go-home]')?.addEventListener('click', () => {
      speechSessions.get(key)?.stop();
    });

    const body = container.querySelector('[data-chat-body]');
    if (body) body.scrollTop = body.scrollHeight;
  }
};
