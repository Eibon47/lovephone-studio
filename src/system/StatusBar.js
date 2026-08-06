export function getTimeLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

export function renderStatusBar(extraClass = '', options = {}) {
  const count = Math.max(0, Number(options.notificationCount) || 0);
  return `
    <div class="phone-status ${extraClass}">
      <span>${getTimeLabel()}</span>
      <span class="status-icons">▮⌁▱</span>
      ${options.showNotifications ? `
        <button class="phone-notice-trigger ${count ? 'has-notices' : ''}" type="button" data-phone-notice-toggle aria-label="查看通知">
          <i></i>${count ? `<b>${count > 9 ? '9+' : count}</b>` : ''}
        </button>
      ` : ''}
    </div>
  `;
}
