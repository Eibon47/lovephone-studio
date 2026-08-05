import { getAppById, isAppEnabled } from './appRegistry.js?v=app-config-83';
import { PlaceholderApp } from '../apps/PlaceholderApp.js?v=app-config-16';

export function renderAppRouter(config, osState, handlers) {
  const app = getAppById(osState.currentApp);
  if (!app || !isAppEnabled(app, config)) {
    return PlaceholderApp.render({
      id: 'missing',
      name: '未找到',
      icon: 'settings'
    }, config, handlers);
  }

  return app.component.render(app, config, osState, handlers);
}

export function bindAppRouter(container, config, osState, handlers) {
  const app = getAppById(osState.currentApp);
  const component = app?.component || PlaceholderApp;
  component.bind?.(container, config, handlers, osState);
}
