import { renderAppRouter, bindAppRouter } from './AppRouter.js?v=app-config-61';
import { bindGridStackWidgets, shouldSuppressDesktopClick } from './GridStackWidgets.js?v=app-config-13';
import { renderHomeScreen } from './HomeScreen.js?v=app-config-61';
import { bindHomeWidgetActions } from './HomeWidgetActions.js?v=app-config-60';
import { escapeHtml } from './html.js';
import { getAppTheme } from './appAppearance.js?v=app-config-61';
import { bindLiveWeather } from '../services/weatherService.js?v=app-config-21';
import { syncScheduledGreeting } from '../services/greetingService.js?v=app-config-45';
import { syncAnniversaryReminders } from '../services/anniversaryService.js?v=app-config-44';

export function renderLovePhoneOS(container, config, osState, handlers = {}) {
  const currentApp = osState.currentApp || 'home';
  const previousApp = container.dataset.currentApp;
  const previousScreen = container.querySelector('.phone-screen');
  const preservedScrollTop = previousApp === currentApp ? previousScreen?.scrollTop || 0 : 0;
  const style = `--accent:${config.theme.primaryColor || '#7fb59a'}`;
  const iconSet = config.theme.iconSet || 'soft';
  const widgetStyle = config.theme.widgetStyle || 'colorful';
  const appTheme = currentApp === 'home' ? 'lovephone' : getAppTheme(config, currentApp);
  const screen = currentApp === 'home'
    ? renderHomeScreen(config, osState)
    : renderAppRouter(config, osState, handlers);

  container.innerHTML = `
    <div class="os-shell">
      <div class="os-caption">
        <span>LovePhone OS</span>
        <strong>${escapeHtml(config.meta.title || '我的小手机')}</strong>
      </div>
      <div
        class="phone-frame frame-${escapeHtml(config.theme.phoneFrame)} font-${escapeHtml(config.theme.fontStyle)} surface-basic icon-set-${escapeHtml(iconSet)} widget-style-${escapeHtml(widgetStyle)} app-theme-${escapeHtml(appTheme)}"
        style="${style}"
      >
        <div class="dynamic-island"></div>
        ${screen}
        <div class="home-indicator"></div>
      </div>
    </div>
  `;
  container.dataset.currentApp = currentApp;
  const currentScreen = container.querySelector('.phone-screen');
  if (currentScreen && preservedScrollTop > 0) {
    currentScreen.scrollTop = preservedScrollTop;
  }

  container.querySelectorAll('[data-open-app]').forEach(button => {
    button.addEventListener('click', () => {
      if (shouldSuppressDesktopClick()) return;
      handlers.openApp?.(button.dataset.openApp);
    });
  });

  container.querySelectorAll('[data-go-home]').forEach(button => {
    button.addEventListener('click', () => {
      handlers.goHome?.();
    });
  });

  if (currentApp !== 'home') {
    bindAppRouter(container, config, osState, handlers);
  } else {
    bindGridStackWidgets(container, handlers);
    bindLiveWeather(container, config);
    bindHomeWidgetActions(container, config, osState, handlers);
  }
  syncScheduledGreeting(config, handlers, osState);
  syncAnniversaryReminders(config, handlers);
}
