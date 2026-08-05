import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import { localDateKey, makeId, shortDate } from './appData.js?v=app-config-40';
import {
  anniversaryMetrics,
  upcomingAnniversaries
} from '../services/anniversaryService.js?v=app-config-44';
import {
  removeItemWithUndo,
  restoreItemFromUndo
} from '../services/listUndo.js?v=app-config-44';

function renderForm(entry = {}) {
  return `
    <form class="companion-editor anniversary-editor" data-anniversary-form data-entry-id="${escapeHtml(entry.id || '')}">
      <div class="editor-title-row"><strong>${entry.id ? '编辑纪念日' : '新增纪念日'}</strong>${entry.id ? '<button type="button" data-anniversary-cancel>取消</button>' : ''}</div>
      <input name="title" value="${escapeHtml(entry.title || '')}" maxlength="30" placeholder="例如：我们认识的那天" required />
      <input type="date" name="date" value="${escapeHtml(entry.date || localDateKey())}" required />
      <label class="inline-check"><input type="checkbox" name="yearly" ${entry.yearly !== false ? 'checked' : ''} /> 每年提醒我</label>
      <button class="companion-primary-button" type="submit">${entry.id ? '保存修改' : '添加日期'}</button>
    </form>`;
}

function countdownText(entry, metrics) {
  if (!metrics) return '日期不可用';
  const history = metrics.daysSince >= 0
    ? `已经 ${metrics.daysSince} 天`
    : `还有 ${Math.abs(metrics.daysSince)} 天`;
  if (entry.yearly === false) return history;
  return `${history} · ${metrics.daysUntil === 0 ? '就是今天' : `下次还有 ${metrics.daysUntil} 天`}`;
}

function renderReminderPanel(config, osState) {
  if (!config.apps.anniversary.reminders) return '';
  const upcoming = upcomingAnniversaries(
    config.apps.anniversary.events,
    new Date(),
    config.apps.anniversary.reminderDays
  );
  const supported = typeof Notification !== 'undefined';
  const permission = supported ? Notification.permission : 'unsupported';
  const permissionText = osState.anniversaryNotificationStatus
    || (permission === 'granted'
      ? '系统通知已允许。'
      : permission === 'denied'
        ? '通知已被浏览器阻止，请在地址栏的网站设置中允许。'
        : permission === 'unsupported'
          ? '当前浏览器不支持系统通知。'
          : '允许通知后，网页打开时会推送临近纪念日。');
  return `
    <section class="anniversary-reminder-panel">
      <header>
        <span><strong>近期提醒</strong><small>${escapeHtml(permissionText)}</small></span>
        ${supported && permission === 'default'
          ? '<button type="button" data-anniversary-notification>允许通知</button>'
          : `<b class="${permission === 'granted' ? 'is-on' : ''}">${permission === 'granted' ? '已允许' : '未允许'}</b>`}
      </header>
      ${upcoming.length ? `
        <div>
          ${upcoming.map(item => `
            <p>
              <strong>${escapeHtml(item.event.title)}</strong>
              <span>${item.metrics.daysUntil === 0 ? '就是今天' : `${item.metrics.daysUntil} 天后`}</span>
            </p>
          `).join('')}
        </div>
      ` : `<p class="anniversary-no-reminder">未来 ${config.apps.anniversary.reminderDays} 天没有纪念日。</p>`}
    </section>
  `;
}

function renderUndo(osState) {
  if (!osState.anniversaryUndo?.item) return '';
  return `
    <div class="companion-undo">
      <span>已删除“${escapeHtml(osState.anniversaryUndo.item.title)}”</span>
      <button type="button" data-anniversary-undo>撤销</button>
    </div>
  `;
}

export const AnniversaryApp = {
  render(app, config, osState = {}) {
    const savedEvents = Array.isArray(config.apps.anniversary.events) ? config.apps.anniversary.events : [];
    const events = savedEvents.length || !osState.companionAppearancePreviewMode ? savedEvents : [{
      id: 'anniversary-preview', title: '我们认识的那天', date: '2025-02-14', yearly: true
    }];
    const previewConfig = osState.companionAppearancePreviewMode
      ? {
          ...config,
          apps: {
            ...config.apps,
            anniversary: {
              ...config.apps.anniversary,
              reminders: true,
              events
            }
          }
        }
      : config;
    const editing = events.find(item => item.id === osState.anniversaryEditingId);
    const canAdd = config.apps.anniversary.multipleDates || events.length === 0;
    return `
      <section class="phone-screen companion-data-app phone-anniversary-app">
        ${renderStatusBar('chat-statusbar')}
        <header class="app-top">
          <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
          <h3>${escapeHtml(app.name)}</h3>
          <span class="app-count">${events.length}</span>
        </header>
        <div class="companion-app-content">
          ${editing ? renderForm(editing) : canAdd ? renderForm() : `
            <div class="anniversary-single-limit">
              <strong>当前只允许一个纪念日</strong>
              <p>可以编辑或删除已有日期；打开“允许多个纪念日”后才能继续添加。</p>
            </div>
          `}
          ${osState.anniversaryNotice ? `<p class="anniversary-notice">${escapeHtml(osState.anniversaryNotice)}</p>` : ''}
          ${renderReminderPanel(previewConfig, osState)}
          ${renderUndo(osState)}
          <div class="anniversary-list">
            ${events.length ? events.map((entry, index) => {
              const metrics = anniversaryMetrics(entry);
              const confirming = osState.anniversaryDeleteConfirmId === entry.id;
              return `
                <article class="anniversary-entry ${index === 0 ? 'is-primary' : ''}">
                  <span class="anniversary-entry-heart">♥</span>
                  <div>
                    <small>${escapeHtml(shortDate(entry.date))}</small>
                    <strong>${escapeHtml(entry.title)}</strong>
                    ${config.apps.anniversary.countdown ? `<p>${escapeHtml(countdownText(entry, metrics))}</p>` : ''}
                  </div>
                  ${confirming ? `
                    <div class="inline-delete-confirm">
                      <p>确定删除这个纪念日吗？删除后仍可立即撤销。</p>
                      <button type="button" data-anniversary-delete-cancel>取消</button>
                      <button type="button" data-anniversary-delete-confirm="${escapeHtml(entry.id)}">确认删除</button>
                    </div>
                  ` : `
                    <footer>
                      <button type="button" data-anniversary-edit="${escapeHtml(entry.id)}">编辑</button>
                      <button type="button" data-anniversary-delete="${escapeHtml(entry.id)}">删除</button>
                    </footer>
                  `}
                </article>`;
            }).join('') : `<div class="companion-empty"><i>♡</i><strong>留一个值得记住的日期</strong><p>添加后，桌面的纪念日小组件会同步显示。</p></div>`}
          </div>
        </div>
      </section>`;
  },

  bind(container, config, handlers, osState = {}) {
    if (osState.companionAppearancePreviewMode) return;
    const events = Array.isArray(config.apps.anniversary.events) ? config.apps.anniversary.events : [];
    container.querySelector('[data-anniversary-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const id = form.dataset.entryId;
      if (!id && !config.apps.anniversary.multipleDates && events.length) {
        handlers.updatePhoneState?.({ anniversaryNotice: '当前设置只允许一个纪念日。' });
        return;
      }
      const entry = {
        id: id || makeId('anniversary'),
        title: form.elements.title.value.trim(),
        date: form.elements.date.value,
        yearly: form.elements.yearly.checked
      };
      const next = id ? events.map(item => item.id === id ? entry : item) : [entry, ...events];
      handlers.updatePhoneState?.({
        anniversaryEditingId: null,
        anniversaryNotice: id ? '纪念日已更新。' : '纪念日已添加。',
        anniversaryUndo: null
      });
      handlers.updatePath?.('apps.anniversary.events', next, { keepPhone: true });
    });
    container.querySelector('[data-anniversary-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ anniversaryEditingId: null });
    });
    container.querySelectorAll('[data-anniversary-edit]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        anniversaryEditingId: button.dataset.anniversaryEdit,
        anniversaryDeleteConfirmId: null
      }));
    });
    container.querySelectorAll('[data-anniversary-delete]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        anniversaryDeleteConfirmId: button.dataset.anniversaryDelete
      }));
    });
    container.querySelector('[data-anniversary-delete-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ anniversaryDeleteConfirmId: null });
    });
    container.querySelector('[data-anniversary-delete-confirm]')?.addEventListener('click', event => {
      const result = removeItemWithUndo(events, event.currentTarget.dataset.anniversaryDeleteConfirm);
      if (!result.undo) return;
      handlers.updatePhoneState?.({
        anniversaryDeleteConfirmId: null,
        anniversaryEditingId: null,
        anniversaryUndo: result.undo,
        anniversaryNotice: ''
      });
      handlers.updatePath?.('apps.anniversary.events', result.next, { keepPhone: true });
    });
    container.querySelector('[data-anniversary-undo]')?.addEventListener('click', () => {
      const latest = handlers.getConfig?.() || config;
      const current = Array.isArray(latest.apps.anniversary.events) ? latest.apps.anniversary.events : [];
      const next = restoreItemFromUndo(current, osState.anniversaryUndo);
      handlers.updatePhoneState?.({
        anniversaryUndo: null,
        anniversaryNotice: '已恢复纪念日。'
      });
      handlers.updatePath?.('apps.anniversary.events', next, { keepPhone: true });
    });
    container.querySelector('[data-anniversary-notification]')?.addEventListener('click', async () => {
      try {
        const permission = await Notification.requestPermission();
        handlers.updatePhoneState?.({
          anniversaryNotificationStatus: permission === 'granted'
            ? '系统通知已允许。'
            : permission === 'denied'
              ? '通知已被拒绝，可在浏览器的网站设置中修改。'
              : '暂未允许系统通知。'
        });
      } catch {
        handlers.updatePhoneState?.({ anniversaryNotificationStatus: '浏览器没有完成通知授权。' });
      }
    });
  }
};
