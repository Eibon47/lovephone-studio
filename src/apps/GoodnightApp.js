import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import { activeCharacter, localDateKey, makeId, shortDate } from './appData.js?v=app-config-40';
import {
  generateAndStoreGreeting,
  greetingKey,
  greetingLabel
} from '../services/greetingService.js?v=app-config-45';

const routineItems = [
  { id: 'water', label: '喝一点水' },
  { id: 'wash', label: '洗漱完成' },
  { id: 'alarm', label: '设好闹钟' },
  { id: 'phone', label: '准备放下手机' }
];

const moodText = {
  peaceful: '平静',
  happy: '开心',
  tired: '疲惫',
  heavy: '心事很多'
};

function nightlyLine(character, mood) {
  if (mood === 'heavy') return `${character.name}：今晚不必把所有问题都想明白，先安心睡一觉。`;
  if (mood === 'tired') return `${character.name}：今天辛苦了。剩下的事交给明天，晚安。`;
  return `${character.name}：晚安，今天也很高兴和你待在一起。`;
}

function greetingCharacterId(config, osState) {
  return config.apps.goodnight.useCurrentCharacter
    ? activeCharacter(config, osState).id
    : 'system';
}

function renderGreetingPanel(config, osState) {
  const greetings = Array.isArray(config.apps.goodnight.greetings)
    ? config.apps.goodnight.greetings
    : [];
  const characterId = greetingCharacterId(config, osState);
  const visible = greetings
    .filter(item => item.characterId === characterId)
    .slice(0, 4);
  const generatingKey = osState.greetingGeneratingKey;
  const morningKey = greetingKey(localDateKey(), 'morning', characterId);
  const nightKey = greetingKey(localDateKey(), 'night', characterId);
  return `
    <section class="greeting-panel">
      <header>
        <span><strong>今日问候</strong><small>每天每个角色各生成一次</small></span>
        <div>
          ${config.apps.goodnight.goodMorning ? `
            <button type="button" data-greeting-generate="morning" ${generatingKey ? 'disabled' : ''}>
              ${generatingKey === morningKey ? '生成中…' : '生成早安'}
            </button>
          ` : ''}
          ${config.apps.goodnight.goodNight ? `
            <button type="button" data-greeting-generate="night" ${generatingKey ? 'disabled' : ''}>
              ${generatingKey === nightKey ? '生成中…' : '生成晚安'}
            </button>
          ` : ''}
        </div>
      </header>
      ${osState.greetingStatus ? `<p class="greeting-status">${escapeHtml(osState.greetingStatus)}</p>` : ''}
      ${visible.length ? `
        <div class="greeting-list">
          ${visible.map(item => `
            <article>
              <span><b>${greetingLabel(item.period)}</b><time>${escapeHtml(shortDate(item.date))}</time></span>
              <p>${escapeHtml(item.message)}</p>
              <small>${item.source === 'ai' ? 'AI 生成' : item.source === 'local-fallback' ? '本地备用问候' : '本地问候'}</small>
            </article>
          `).join('')}
        </div>
      ` : '<p class="greeting-empty">开启早安或晚安后，问候会出现在这里。</p>'}
    </section>
  `;
}

function renderNotificationControl(config, osState) {
  const supported = typeof Notification !== 'undefined';
  const permission = supported ? Notification.permission : 'unsupported';
  const enabled = config.apps.goodnight.notifications;
  const message = osState.notificationStatus
    || (permission === 'granted'
      ? (enabled ? '系统通知已开启。' : '浏览器已允许通知，可在左侧打开系统通知开关。')
      : permission === 'denied'
        ? '通知已被浏览器阻止，请在地址栏的网站设置中允许。'
        : permission === 'unsupported'
          ? '当前浏览器不支持系统通知。'
          : '需要你亲自点击允许，网页不能代替你授权。');
  return `
    <section class="notification-permission">
      <span><strong>系统通知</strong><small>${escapeHtml(message)}</small></span>
      ${supported && permission === 'default'
        ? '<button type="button" data-request-notifications>允许</button>'
        : `<b class="${enabled && permission === 'granted' ? 'is-on' : ''}">${enabled && permission === 'granted' ? '已开启' : '未开启'}</b>`}
    </section>
  `;
}

export const GoodnightApp = {
  render(app, config, osState = {}) {
    const characterId = activeCharacter(config, osState).id;
    const entries = (Array.isArray(config.apps.goodnight.entries) ? config.apps.goodnight.entries : [])
      .filter(entry => (entry.characterId || config.character.id) === characterId);
    const latest = entries[0];
    return `
      <section class="phone-screen companion-data-app phone-goodnight-app">
        ${renderStatusBar('chat-statusbar')}
        <header class="app-top">
          <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
          <h3>${escapeHtml(app.name)}</h3>
          <span class="night-moon">☾</span>
        </header>
        <div class="goodnight-sky">
          <span>✦</span><span>·</span><span>✧</span>
          <small>${escapeHtml(localDateKey())}</small>
          <strong>今天准备怎样入睡？</strong>
        </div>
        <div class="companion-app-content">
          ${renderGreetingPanel(config, osState)}
          ${renderNotificationControl(config, osState)}
          <form class="companion-editor goodnight-editor" data-goodnight-form>
            <div class="night-mood-picker">
              ${Object.entries(moodText).map(([value, label], index) => `
                <label><input type="radio" name="mood" value="${value}" ${index === 0 ? 'checked' : ''} /><span>${label}</span></label>`).join('')}
            </div>
            <div class="night-routine">
              ${routineItems.map(item => `<label><input type="checkbox" name="routine" value="${item.id}" /><span>${item.label}</span></label>`).join('')}
            </div>
            <textarea name="note" rows="3" maxlength="240" placeholder="睡前还想留下一句话…"></textarea>
            <button class="companion-primary-button" type="submit">完成今晚打卡</button>
          </form>
          ${latest ? `
            <article class="latest-goodnight">
              <header><span>${escapeHtml(shortDate(latest.date))}</span><b>${escapeHtml(moodText[latest.mood] || '')}</b></header>
              ${latest.note ? `<p>${escapeHtml(latest.note)}</p>` : ''}
              <blockquote>${escapeHtml(latest.message)}</blockquote>
              <small>完成 ${latest.routine?.length || 0}/${routineItems.length} 项睡前准备</small>
            </article>` : ''}
          ${entries.length > 1 ? `
            <div class="goodnight-history">
              <strong>最近的夜晚</strong>
              ${entries.slice(1, 5).map(entry => `<span><time>${escapeHtml(shortDate(entry.date))}</time><b>${escapeHtml(moodText[entry.mood] || '')}</b><small>${escapeHtml(entry.note || '安心睡下')}</small></span>`).join('')}
            </div>` : ''}
        </div>
      </section>`;
  },

  bind(container, config, handlers, osState = {}) {
    const entries = Array.isArray(config.apps.goodnight.entries) ? config.apps.goodnight.entries : [];
    container.querySelector('[data-goodnight-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const mood = form.elements.mood.value;
      const character = activeCharacter(config, osState);
      const entry = {
        id: makeId('night'),
        date: localDateKey(),
        characterId: character.id,
        mood,
        routine: [...form.querySelectorAll('input[name="routine"]:checked')].map(input => input.value),
        note: form.elements.note.value.trim(),
        message: nightlyLine(character, mood)
      };
      handlers.updatePath?.(
        'apps.goodnight.entries',
        [
          entry,
          ...entries.filter(item => !(
            item.date === entry.date
            && (item.characterId || config.character.id) === character.id
          ))
        ],
        { keepPhone: true }
      );
    });
    container.querySelectorAll('[data-greeting-generate]').forEach(button => {
      button.addEventListener('click', () => {
        void generateAndStoreGreeting(
          handlers.getConfig?.() || config,
          handlers,
          osState,
          { period: button.dataset.greetingGenerate, force: true }
        );
      });
    });
    container.querySelector('[data-request-notifications]')?.addEventListener('click', async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          handlers.updatePhoneState?.({ notificationStatus: '系统通知已允许。' });
          handlers.updatePath?.('apps.goodnight.notifications', true, { keepPhone: true });
        } else {
          handlers.updatePhoneState?.({
            notificationStatus: permission === 'denied'
              ? '通知已被拒绝，可稍后在浏览器的网站设置中修改。'
              : '暂未开启系统通知。'
          });
        }
      } catch {
        handlers.updatePhoneState?.({ notificationStatus: '浏览器没有完成通知授权。' });
      }
    });
  }
};
