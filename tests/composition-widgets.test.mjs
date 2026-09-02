import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';
import { normalizeCustomization } from '../src/services/customizationModel.js';
import {
  COMPOSITION_WIDGET_TEMPLATES,
  createCompositionWidget,
  migrateLegacyBuiltinWidgets,
  normalizeCompositionWidget
} from '../src/services/compositionWidgetModel.js';
import { renderCustomWidgets } from '../src/system/customWidgetRuntime.js';

test('photo templates provide independently editable image layers', () => {
  const horizontal = createCompositionWidget('photo-row', 0, 'photos');
  const collage = createCompositionWidget('photo-collage', 1, 'collage');
  assert.equal(horizontal.layout.w, 12);
  assert.equal(horizontal.elements.filter(item => item.type === 'image').length, 2);
  assert.equal(collage.elements.some(item => item.frame.rotation !== 0), true);
});

test('composition widgets derive local data and action permissions from elements', () => {
  const widget = createCompositionWidget('music-player', 0, 'player');
  assert.deepEqual(widget.permissions.data, ['music']);
  assert.deepEqual(new Set(widget.permissions.actions), new Set(['musicPrevious', 'musicPlayPause', 'musicNext']));
  assert.equal(widget.elements.some(item => item.binding.field === 'image'), true);
  assert.equal(widget.elements.some(item => item.binding.field === 'progress'), true);
});

test('legacy visual widgets migrate once into the 12-column composition model', () => {
  const customization = normalizeCustomization({
    version: 2,
    widgets: [{ id: 'old-photo', type: 'image', image: '', dataSource: 'date', layout: { x: 1, y: 2, w: 2, h: 3 } }]
  });
  const widget = customization.widgets[0];
  assert.equal(widget.kind, 'composition');
  assert.deepEqual(widget.layout, { x: 3, y: 6, w: 6, h: 9 });
  assert.equal(widget.elements.length, 1);
});

test('enabled built-in widgets become editable composition templates without duplicates', () => {
  const phone = cloneConfig(defaultConfig);
  phone.theme.widgets.photo.enabled = true;
  phone.theme.widgets.photo.image = 'data:image/png;base64,aGVsbG8=';
  const once = migrateLegacyBuiltinWidgets(phone.theme, []);
  const twice = migrateLegacyBuiltinWidgets(phone.theme, once);
  assert.equal(once.filter(item => item.id === 'builtin-photo').length, 1);
  assert.equal(twice.filter(item => item.id === 'builtin-photo').length, 1);
});

test('composition runtime renders a 1000-coordinate canvas with editable frame metadata', () => {
  const phone = normalizeConfig(cloneConfig(defaultConfig));
  const widget = normalizeCompositionWidget(createCompositionWidget('text-columns', 0, 'columns'));
  phone.theme.customization.widgets = [widget];
  const html = renderCustomWidgets(phone, {
    widgetEditing: true,
    widgetEditorWidgetId: 'columns',
    widgetEditorElementIds: ['text-1']
  });
  assert.match(html, /data-composition-widget="columns"/);
  assert.match(html, /data-frame-x="30"/);
  assert.match(html, /composition-resize-handle/);
  assert.match(html, /composition-rotate-handle/);
});

test('composition limits element count and keeps template IDs unique', () => {
  const source = createCompositionWidget('free', 0, 'limit');
  source.elements = [
    ...Array.from({ length: 12 }, (_, index) => ({ id: `image-${index}`, type: 'image' })),
    ...Array.from({ length: 38 }, (_, index) => ({ id: `e-${index}`, type: 'text' }))
  ];
  const widget = normalizeCompositionWidget(source);
  assert.equal(widget.elements.filter(item => item.type === 'image').length, 8);
  assert.equal(widget.elements.length <= 40, true);
  assert.equal(new Set(COMPOSITION_WIDGET_TEMPLATES.map(item => item.id)).size, COMPOSITION_WIDGET_TEMPLATES.length);
});

test('composition widgets stay inside the desktop safe area', () => {
  const widget = normalizeCompositionWidget({
    ...createCompositionWidget('free', 0, 'oversized'),
    layout: { x: 10, y: 80, w: 12, h: 80 }
  });
  assert.deepEqual(widget.layout, { x: 0, y: 72, w: 12, h: 24 });
  assert.equal(widget.layout.y + widget.layout.h <= 96, true);
});

test('photo collages compressed by the old 24-row pager recover a usable height', () => {
  const source = createCompositionWidget('photo-collage', 0, 'photo-collage');
  source.layout = { x: 0, y: 47, w: 12, h: 2 };
  source.elements = [
    { id: 'photo-1', type: 'image' },
    { id: 'photo-2', type: 'image' }
  ];

  const widget = normalizeCompositionWidget(source);
  assert.equal(widget.layout.h, 14);
});
