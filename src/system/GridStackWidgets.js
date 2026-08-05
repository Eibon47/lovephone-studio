const gridInstances = new WeakMap();
let suppressClickUntil = 0;

function toLayout(node = {}) {
  return {
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
    w: Number(node.w) || 1,
    h: Number(node.h) || 1
  };
}

function saveAllLayouts(gridElement, handlers) {
  gridElement.querySelectorAll('.grid-stack-item').forEach(item => {
    const layout = {
      x: Number(item.getAttribute('gs-x')) || 0,
      y: Number(item.getAttribute('gs-y')) || 0,
      w: Number(item.getAttribute('gs-w')) || 1,
      h: Number(item.getAttribute('gs-h')) || 1
    };
    const widgetId = item.dataset.widgetId;
    const customWidgetIndex = item.dataset.customWidgetIndex;
    const appId = item.dataset.appLayoutId;
    if (widgetId) {
      handlers.updatePath?.(`theme.widgets.${widgetId}.layout`, layout, { noRender: true });
    }
    if (customWidgetIndex !== undefined) {
      handlers.updatePath?.(`theme.customization.widgets.${customWidgetIndex}.layout`, layout, { noRender: true });
    }
    if (appId) {
      handlers.updatePath?.(`theme.appLayouts.${appId}`, layout, { noRender: true });
    }
  });
}

export function bindGridStackWidgets(container, config, handlers = {}) {
  const gridElement = container.querySelector('[data-desktop-grid]');
  if (!gridElement || !globalThis.GridStack) return;

  const previous = gridInstances.get(gridElement);
  previous?.destroy(false);

  const grid = globalThis.GridStack.init({
    column: config.theme?.customization?.active?.desktop
      ? Number(config.theme.customization.desktop?.columns) || 4
      : 4,
    cellHeight: 38,
    margin: config.theme?.customization?.active?.desktop
      ? Number(config.theme.customization.desktop?.gap) || 8
      : 8,
    float: true,
    disableResize: true,
    draggable: { handle: '.grid-stack-item' },
    disableOneColumnMode: true,
    minRow: 4,
    maxRow: 24
  }, gridElement);

  grid.enableResize(false);

  gridInstances.set(gridElement, grid);

  grid.on('dragstop', () => {
    suppressClickUntil = Date.now() + 250;
    saveAllLayouts(gridElement, handlers);
  });

  grid.on('change', (_event, items = []) => {
    items.forEach(item => {
      const widgetId = item.el?.dataset.widgetId;
      const customWidgetIndex = item.el?.dataset.customWidgetIndex;
      const appId = item.el?.dataset.appLayoutId;
      if (widgetId) {
        handlers.updatePath?.(`theme.widgets.${widgetId}.layout`, toLayout(item), { noRender: true });
      }
      if (customWidgetIndex !== undefined) {
        handlers.updatePath?.(`theme.customization.widgets.${customWidgetIndex}.layout`, toLayout(item), { noRender: true });
      }
      if (appId) {
        handlers.updatePath?.(`theme.appLayouts.${appId}`, toLayout(item), { noRender: true });
      }
    });
  });
}

export function shouldSuppressDesktopClick() {
  return Date.now() < suppressClickUntil;
}
