export function getTimeLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

export function renderStatusBar(extraClass = '') {
  return `
    <div class="phone-status ${extraClass}">
      <span>${getTimeLabel()}</span>
      <span class="status-icons">▮⌁▱</span>
    </div>
  `;
}
