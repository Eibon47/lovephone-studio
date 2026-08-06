import { renderAppRouter, bindAppRouter } from './AppRouter.js?v=app-config-96';
import { bindGridStackWidgets, shouldSuppressDesktopClick } from './GridStackWidgets.js?v=app-config-62';
import { renderHomeScreen } from './HomeScreen.js?v=app-config-95';
import { bindHomeWidgetActions } from './HomeWidgetActions.js?v=app-config-92';
import { escapeHtml } from './html.js';
import { getAppTheme } from './appAppearance.js?v=app-config-71';
import { bindLiveWeather } from '../services/weatherService.js?v=app-config-21';
import { syncScheduledGreeting } from '../services/greetingService.js?v=app-config-45';
import { syncAnniversaryReminders } from '../services/anniversaryService.js?v=app-config-44';
import { getCustomizationRuntime } from './customizationRuntime.js?v=app-config-83';

export function renderLovePhoneOS(container, config, osState, handlers = {}) {
  const currentApp = osState.currentApp || 'home';
  const previousApp = container.dataset.currentApp;
  const previousScreen = container.querySelector('.phone-screen');
  const preservedScrollTop = previousApp === currentApp ? previousScreen?.scrollTop || 0 : 0;
  const customization = getCustomizationRuntime(config, currentApp);
  const style = `--accent:${config.theme.primaryColor || '#7fb59a'};${customization.style}`;
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
      ${customization.scopedCss ? `<style data-lovephone-custom-css>${customization.scopedCss}</style>` : ''}
      <div
        class="phone-frame frame-${escapeHtml(config.theme.phoneFrame)} font-${escapeHtml(config.theme.fontStyle)} surface-basic icon-set-${escapeHtml(iconSet)} widget-style-${escapeHtml(widgetStyle)} app-theme-${escapeHtml(appTheme)} ${customization.classes.join(' ')} ${customization.appThemeEnabled ? 'custom-app-theme' : ''}"
        data-current-app="${escapeHtml(currentApp)}"
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
  if (currentApp === 'settings' && currentScreen && osState.settingsAppearanceAnchor) {
    const anchor = osState.settingsAppearanceAnchor;
    const target = anchor === 'groups'
      ? currentScreen.querySelector('.phone-settings-list')
      : anchor === 'controls'
        ? currentScreen.querySelector('.settings-group-controls')
        : currentScreen.querySelector('.app-top');
    currentScreen.scrollTop = target
      ? Math.max(0, target.offsetTop - 72)
      : 0;
  }
  if (currentApp === 'memory' && currentScreen && osState.memoryAppearanceAnchor) {
    const anchor = osState.memoryAppearanceAnchor;
    const target = anchor === 'editor'
      ? currentScreen.querySelector('.companion-editor')
      : anchor === 'cards'
        ? currentScreen.querySelector('.memory-list')
        : currentScreen.querySelector('.app-top');
    currentScreen.scrollTop = target
      ? Math.max(0, target.offsetTop - 72)
      : 0;
  }
  if (['diary', 'anniversary', 'goodnight'].includes(currentApp) && currentScreen && osState.companionAppearanceAnchor) {
    const anchor = osState.companionAppearanceAnchor;
    const target = anchor === 'editor'
      ? currentScreen.querySelector('.companion-editor')
      : anchor === 'cards'
        ? currentScreen.querySelector('.diary-timeline, .anniversary-list, .latest-goodnight, .greeting-panel')
        : currentScreen.querySelector('.app-top');
    currentScreen.scrollTop = target ? Math.max(0, target.offsetTop - 72) : 0;
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
    container.querySelectorAll('[data-phone-notice-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.toggleNotificationCenter?.();
      });
    });
    container.querySelectorAll('[data-phone-notice-open]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.openPhoneNotification?.(button.dataset.phoneNoticeOpen, button.dataset.phoneNoticeCharacter);
      });
    });
    container.querySelectorAll('[data-phone-setup-action]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.phoneSetupAction?.(button.dataset.phoneSetupAction, button.dataset.phoneSetupTarget);
      });
    });
    container.querySelector('[data-phone-setup-dismiss]')?.addEventListener('click', () => {
      handlers.dismissPhoneSetup?.();
    });
    bindGridStackWidgets(container, config, handlers);
    bindLiveWeather(container, config);
    bindHomeWidgetActions(container, config, osState, handlers);
  }
  syncScheduledGreeting(config, handlers, osState);
  syncAnniversaryReminders(config, handlers);
}
