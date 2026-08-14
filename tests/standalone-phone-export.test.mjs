import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig } from '../src/config/defaultConfig.js';
import { standalonePhoneExportForTest } from '../src/services/standalonePhoneExportService.js';

test('standalone HTML contains inline runtime, styles and isolated phone config', () => {
  const config = cloneConfig();
  config.meta.title = '小满的本地小手机';
  const html = standalonePhoneExportForTest.buildHtml({
    title: config.meta.title,
    id: 'phone-test-id',
    config,
    customApps: [],
    css: '.phone{color:red}',
    vendor: 'globalThis.GridStack={};',
    runtime: 'document.body.dataset.ready="yes";',
    iconAssets: { chat: 'data:image/png;base64,INLINE_CHAT_ICON' }
  });
  assert.match(html, /phone-test-id/);
  assert.match(html, /小满的本地小手机/);
  assert.match(html, /<style>\.phone\{color:red\}<\/style>/);
  assert.match(html, /<script type="module">document\.body/);
  assert.match(html, /globalThis\.GridStack/);
  assert.match(html, /__LOVE_PHONE_ICON_ASSETS__/);
  assert.match(html, /INLINE_CHAT_ICON/);
  assert.doesNotMatch(html, /src="src\/main\.js/);
  assert.doesNotMatch(html, /runtime-config\.js/);
});

test('standalone export removes private gateway and assistant connection values', () => {
  const config = cloneConfig();
  config.apps.music.apiBaseUrl = 'https://private.example.com';
  config.aiAssistant = { enabled: true, providerId: 'deepseek', model: 'secret-model', baseUrl: 'https://private-ai.example.com', designBrief: { preferences: ['private preference'], avoid: [], decisions: [] } };
  const safe = standalonePhoneExportForTest.removePrivateRuntimeData(config);
  assert.equal(safe.apps.music.apiBaseUrl, '');
  assert.equal(safe.aiAssistant.providerId, '');
  assert.equal(safe.aiAssistant.model, '');
  assert.equal(safe.aiAssistant.baseUrl, '');
  assert.deepEqual(safe.aiAssistant.designBrief.preferences, []);
});

test('standalone HTML keeps applied widget assets but not assistant session attachments', () => {
  const config = cloneConfig();
  config.theme.customization.widgets.push({
    id: 'asset-widget', name: '本地素材卡', enabled: true, templateId: 'custom', mode: 'code', type: 'image',
    dataSource: 'time', action: 'none', actionTarget: '', image: '', prefix: '', suffix: '',
    assets: { cover: 'data:image/webp;base64,APPLIED_ASSET' },
    layout: { x: 0, y: 0, w: 2, h: 2 },
    style: { background: '#ffffff', text: '#111111', accent: '#22aa77', radius: 12 },
    code: { html: '<img data-cover>', css: '', js: "document.querySelector('[data-cover]').src=widget.asset('cover')", dataPermissions: [], actionPermissions: [] }
  });
  const html = standalonePhoneExportForTest.buildHtml({
    title: '素材测试', id: 'asset-phone', config, customApps: [], css: '', vendor: '', runtime: ''
  });
  assert.match(html, /APPLIED_ASSET/);
  assert.doesNotMatch(html, /assistant-attachment/);
});
