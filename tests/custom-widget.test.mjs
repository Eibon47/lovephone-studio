import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderCustomWidgets,
  resolveCustomWidgetData
} from '../src/system/customWidgetRuntime.js';

const config = {
  character: { id: 'main', name: '小满', relationship: '恋人', avatar: {} },
  characters: [],
  apps: {
    character: { activeCharacterId: 'main' },
    diary: { entries: [{ title: '今天', content: '很好', moodScore: 80 }] },
    memory: { entries: [{ content: '喜欢雨天' }] },
    anniversary: { events: [] }
  },
  theme: {
    widgets: { weather: { city: '上海', temperature: '24°', condition: '晴' } },
    customization: {
      widgets: [{
        id: 'safe-widget',
        name: '<我的时间>',
        enabled: true,
        type: 'progress',
        dataSource: 'time',
        action: 'openApp',
        actionTarget: 'chat',
        prefix: '',
        suffix: '',
        layout: { x: 0, y: 0, w: 2, h: 2 },
        style: { background: '#ffffff', text: '#111111', accent: '#22aa77', radius: 12 }
      }]
    }
  }
};

test('custom widgets resolve whitelisted local data', () => {
  const weather = resolveCustomWidgetData(
    { dataSource: 'weather' },
    config,
    {},
    new Date('2026-07-29T08:30:00')
  );
  assert.equal(weather.primary, '24°');
  assert.match(weather.secondary, /上海/);
});

test('custom widgets render escaped content and declarative actions', () => {
  const html = renderCustomWidgets(config, {});
  assert.match(html, /data-custom-widget-action="openApp"/);
  assert.match(html, /data-custom-widget-target="chat"/);
  assert.match(html, /&lt;我的时间&gt;/);
  assert.doesNotMatch(html, /<我的时间>/);
  assert.match(html, /data-custom-widget-index="0"/);
});

test('code widgets render in a no-origin sandbox with network-blocking CSP', () => {
  const codeConfig = structuredClone(config);
  codeConfig.theme.customization.widgets = [{
    id: 'sandbox-card',
    name: '沙箱组件',
    enabled: true,
    mode: 'code',
    templateId: 'custom',
    layout: { x: 0, y: 0, w: 2, h: 2 },
    style: { background: '#ffffff', text: '#111111', accent: '#22aa77', radius: 12 },
    code: {
      html: '<strong data-weather>天气</strong>',
      css: 'strong { color: #123456; }',
      js: "document.querySelector('[data-weather]').textContent = widget.data('weather').primary",
      dataPermissions: ['weather'],
      actionPermissions: ['openChat']
    }
  }];
  const html = renderCustomWidgets(codeConfig, {});
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin/);
  assert.match(html, /srcdoc="&lt;!doctype html&gt;/);
  assert.match(html, /data-custom-widget-frame="sandbox-card"/);
  assert.match(html, /lovephone-widget/);
  assert.doesNotMatch(html, /喜欢雨天/);
});

test('code widgets expose only explicitly bound local assets', () => {
  const codeConfig = structuredClone(config);
  codeConfig.theme.customization.widgets = [{
    id: 'asset-card', name: '素材卡', enabled: true, mode: 'code', templateId: 'custom',
    layout: { x: 0, y: 0, w: 2, h: 2 },
    style: { background: '#ffffff', text: '#111111', accent: '#22aa77', radius: 12 },
    assets: { cover: 'data:image/webp;base64,LOCAL_ONLY' },
    code: { html: '<img data-cover>', css: '', js: "document.querySelector('[data-cover]').src=widget.asset('cover')", dataPermissions: [], actionPermissions: [] }
  }];
  const html = renderCustomWidgets(codeConfig, {});
  assert.match(html, /asset:name/);
  assert.match(html, /LOCAL_ONLY/);
  assert.match(html, /Object\.hasOwn\(state\.assets,name\)/);
});
