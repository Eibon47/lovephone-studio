import test from 'node:test';
import assert from 'node:assert/strict';

import { bindGridStackWidgets } from '../src/system/GridStackWidgets.js';

function fakeItem(attributes, dataset) {
  return {
    attributes,
    dataset,
    getAttribute(name) { return String(attributes[name] ?? ''); }
  };
}

function fakeDot(index) {
  const classes = new Set();
  return {
    dataset: { desktopPageDot: String(index) },
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    addEventListener() {}
  };
}

test('dragging a component to the page edge moves and saves it on the adjacent page', () => {
  const originalGridStack = globalThis.GridStack;
  const callbacks = [];
  const item = fakeItem(
    { 'gs-x': 2, 'gs-y': 8, 'gs-w': 6, 'gs-h': 9 },
    { customWidgetIndex: '0' }
  );
  const grids = [0, 1].map(pageIndex => ({
    dataset: { widgetPageIndex: String(pageIndex) },
    querySelectorAll() { return pageIndex === 0 ? [item] : []; }
  }));
  const pager = {
    clientWidth: 300,
    scrollLeft: 0,
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, right: 300 }; },
    scrollTo({ left }) { this.scrollLeft = left; }
  };
  const dots = [fakeDot(0), fakeDot(1)];
  const container = {
    dataset: {},
    querySelector(selector) { return selector === '[data-desktop-widget-pages]' ? pager : null; },
    querySelectorAll(selector) {
      if (selector === '[data-desktop-grid]') return grids;
      if (selector === '[data-desktop-page-dot]') return dots;
      return [];
    }
  };
  const updates = [];

  globalThis.GridStack = {
    init(_options, element) {
      const events = {};
      const grid = {
        enableResize() {},
        destroy() {},
        on(name, callback) { events[name] = callback; }
      };
      callbacks[Number(element.dataset.widgetPageIndex)] = events;
      return grid;
    }
  };

  try {
    bindGridStackWidgets(
      container,
      { theme: { customization: { version: 3 } } },
      { updatePath(path, value, options) { updates.push({ path, value, options }); } },
      { widgetEditing: true }
    );
    callbacks[0].dragstart({ clientX: 150 }, item);
    callbacks[0].drag({ clientX: 290 }, item);
    item.attributes['gs-w'] = 1;
    item.attributes['gs-h'] = 1;
    callbacks[0].dragstop({ clientX: 290 }, item);

    assert.equal(pager.scrollLeft, 300);
    assert.deepEqual(updates.at(-1), {
      path: 'theme.customization.widgets.0.layout',
      value: { x: 2, y: 58, w: 6, h: 9 },
      options: undefined
    });

    item.attributes['gs-w'] = 6;
    item.attributes['gs-h'] = 9;
    callbacks[1].dragstart({ clientX: 150 }, item);
    callbacks[1].drag({ clientX: 10 }, item);
    callbacks[1].dragstop({ clientX: 10 }, item);

    assert.equal(pager.scrollLeft, 0);
    assert.deepEqual(updates.at(-1), {
      path: 'theme.customization.widgets.0.layout',
      value: { x: 2, y: 8, w: 6, h: 9 },
      options: undefined
    });
  } finally {
    globalThis.GridStack = originalGridStack;
  }
});
