import { escapeHtml } from '../system/html.js';
import { iconMap } from '../system/icons.js';
import { getAppIcon } from '../system/appAppearance.js?v=app-config-61';
import { renderStatusBar } from '../system/StatusBar.js';

export const PlaceholderApp = {
  render(app, config) {
    const icon = app.id === 'missing' ? (iconMap[app.icon] || iconMap.heart) : getAppIcon(config, app);
    return `
      <section class="phone-screen phone-placeholder-app">
        ${renderStatusBar('chat-statusbar')}
        <header class="app-top">
          <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
          <h3>${escapeHtml(app.name)}</h3>
        </header>
        <div class="placeholder-card">
          <img src="${icon}" alt="" />
          <strong>${escapeHtml(app.name)}</strong>
          <p>这个 App 已经进入 LovePhone OS 注册表，后续可以继续补完整功能。</p>
        </div>
      </section>
    `;
  }
};
