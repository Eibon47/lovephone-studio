const gridInstances = new WeakMap();
const DESKTOP_PAGE_ROWS = 50;
const PAGE_EDGE_SIZE = 32;
let suppressClickUntil = 0;

function toLayout(node = {}, yOffset = 0) {
  return {
    x: Number(node.x) || 0,
    y: (Number(node.y) || 0) + yOffset,
    w: Number(node.w) || 1,
    h: Number(node.h) || 1
  };
}

function itemPath(item) {
  if (item.dataset.widgetId) return `theme.widgets.${item.dataset.widgetId}.layout`;
  if (item.dataset.customWidgetIndex !== undefined) return `theme.customization.widgets.${item.dataset.customWidgetIndex}.layout`;
  if (item.dataset.appLayoutId) return `theme.appLayouts.${item.dataset.appLayoutId}`;
  return '';
}

function saveAllLayouts(gridElement, handlers, yOffset = 0, excludedItem = null) {
  gridElement.querySelectorAll('.grid-stack-item').forEach(item => {
    if (item === excludedItem) return;
    const layout = {
      x: Number(item.getAttribute('gs-x')) || 0,
      y: (Number(item.getAttribute('gs-y')) || 0) + yOffset,
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

export function bindGridStackWidgets(container, config, handlers = {}, osState = {}) {
  const gridElements = [...container.querySelectorAll('[data-desktop-grid]')];
  if (!gridElements.length || !globalThis.GridStack) return;
  const compositionGrid = Number(config.theme?.customization?.version) >= 3;
  const editing = compositionGrid && Boolean(osState.widgetEditing);
  const pager = container.querySelector('[data-desktop-widget-pages]');
  const dots = [...container.querySelectorAll('[data-desktop-page-dot]')];
  const activatePage = index => {
    container.dataset.desktopPage = String(index);
    dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
  };
  const showPage = (index, behavior = 'smooth') => {
    if (!pager) return;
    const next = Math.min(gridElements.length - 1, Math.max(0, index));
    pager.scrollTo({ left: next * pager.clientWidth, behavior });
    activatePage(next);
  };
  let activeDrag = null;

  gridElements.forEach(gridElement => {
    gridInstances.get(gridElement)?.destroy(false);
    const pageIndex = Math.max(0, Number(gridElement.dataset.widgetPageIndex) || 0);
    const pageRows = DESKTOP_PAGE_ROWS;
    const yOffset = compositionGrid ? pageIndex * pageRows : 0;
    const grid = globalThis.GridStack.init({
      column: compositionGrid ? 12 : (config.theme?.customization?.active?.desktop
        ? Number(config.theme.customization.desktop?.columns) || 4
        : 4),
      cellHeight: compositionGrid ? 12 : 38,
      margin: compositionGrid ? 4 : (config.theme?.customization?.active?.desktop
        ? Number(config.theme.customization.desktop?.gap) || 8
        : 8),
      float: true,
      disableResize: !editing,
      draggable: { handle: editing ? '.composition-widget-drag-handle, .custom-widget-drag-handle' : '.grid-stack-item' },
      resizable: { handles: 'all' },
      disableOneColumnMode: true,
      minRow: pageRows,
      maxRow: pageRows
    }, gridElement);
    grid.enableResize(editing);
    gridInstances.set(gridElement, grid);

    const recordCustomWidgetStart = (event, element) => {
      const item = element?.el || element;
      if (item?.dataset?.customWidgetIndex !== undefined) handlers.beginCustomWidgetLayoutEdit?.();
      activeDrag = {
        item,
        sourcePage: pageIndex,
        targetPage: pageIndex,
        edgeArmed: true,
        originalLayout: {
          w: Number(item?.getAttribute?.('gs-w')) || 1,
          h: Number(item?.getAttribute?.('gs-h')) || 1
        },
        clientX: Number(event?.clientX),
        clientY: Number(event?.clientY)
      };
    };
    grid.on('dragstart', recordCustomWidgetStart);
    grid.on('resizestart', recordCustomWidgetStart);
    grid.on('drag', event => {
      if (!pager || !activeDrag || activeDrag.sourcePage !== pageIndex) return;
      const clientX = Number(event?.clientX ?? event?.originalEvent?.clientX);
      const clientY = Number(event?.clientY ?? event?.originalEvent?.clientY);
      if (Number.isFinite(clientX)) activeDrag.clientX = clientX;
      if (Number.isFinite(clientY)) activeDrag.clientY = clientY;
      if (!Number.isFinite(clientX)) return;
      const rect = pager.getBoundingClientRect();
      const atLeft = clientX <= rect.left + PAGE_EDGE_SIZE;
      const atRight = clientX >= rect.right - PAGE_EDGE_SIZE;
      if (!atLeft && !atRight) {
        activeDrag.edgeArmed = true;
        return;
      }
      if (!activeDrag.edgeArmed) return;
      const currentPage = Math.max(0, Number(container.dataset.desktopPage) || activeDrag.targetPage);
      const targetPage = atLeft ? currentPage - 1 : currentPage + 1;
      if (targetPage < 0 || targetPage >= gridElements.length) return;
      activeDrag.edgeArmed = false;
      activeDrag.targetPage = targetPage;
      showPage(targetPage);
    });
    grid.on('dragstop', (_event, element) => {
      suppressClickUntil = Date.now() + 250;
      const item = element?.el || element || activeDrag?.item;
      const transfer = activeDrag && item === activeDrag.item && activeDrag.targetPage !== pageIndex;
      if (transfer) {
        saveAllLayouts(gridElement, handlers, yOffset, item);
        const path = itemPath(item);
        const h = activeDrag.originalLayout.h;
        const layout = {
          x: Number(item.getAttribute('gs-x')) || 0,
          y: activeDrag.targetPage * pageRows + Math.min(pageRows - h, Math.max(0, Number(item.getAttribute('gs-y')) || 0)),
          w: activeDrag.originalLayout.w,
          h
        };
        if (path) handlers.updatePath?.(path, layout);
      } else {
        saveAllLayouts(gridElement, handlers, yOffset);
      }
      activeDrag = null;
    });
    grid.on('resizestop', () => {
      suppressClickUntil = Date.now() + 250;
      saveAllLayouts(gridElement, handlers, yOffset);
      activeDrag = null;
    });
    grid.on('change', (_event, items = []) => {
      items.forEach(item => {
        const widgetId = item.el?.dataset.widgetId;
        const customWidgetIndex = item.el?.dataset.customWidgetIndex;
        const appId = item.el?.dataset.appLayoutId;
        const crossingPage = activeDrag?.item === item.el && activeDrag.targetPage !== pageIndex;
        if (crossingPage) return;
        if (widgetId) handlers.updatePath?.(`theme.widgets.${widgetId}.layout`, toLayout(item, yOffset), { noRender: true });
        if (customWidgetIndex !== undefined) handlers.updatePath?.(`theme.customization.widgets.${customWidgetIndex}.layout`, toLayout(item, yOffset), { noRender: true });
        if (appId) handlers.updatePath?.(`theme.appLayouts.${appId}`, toLayout(item, yOffset), { noRender: true });
      });
    });
  });

  if (pager) {
    dots.forEach(dot => dot.addEventListener('click', () => {
      const index = Number(dot.dataset.desktopPageDot) || 0;
      showPage(index);
    }));
    let scrollTimer = 0;
    pager.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const pageWidth = Math.max(1, pager.clientWidth);
        const index = Math.min(gridElements.length - 1, Math.max(0, Math.round(pager.scrollLeft / pageWidth)));
        const targetLeft = index * pageWidth;
        activatePage(index);
        if (Math.abs(pager.scrollLeft - targetLeft) > 1) {
          pager.scrollTo({ left: targetLeft, behavior: 'smooth' });
        }
      }, 100);
    }, { passive: true });
    const initialPage = Math.min(gridElements.length - 1, Math.max(0, Number(container.dataset.desktopPage) || 0));
    pager.scrollLeft = initialPage * pager.clientWidth;
    activatePage(initialPage);
  }

}

export function shouldSuppressDesktopClick() {
  return Date.now() < suppressClickUntil;
}
