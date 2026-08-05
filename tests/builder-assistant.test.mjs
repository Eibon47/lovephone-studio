import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';
import {
  applyBuilderAssistantOperations,
  createBuilderAssistantContext,
  parseBuilderAssistantResponse
} from '../src/services/builderAssistantService.js';

test('assistant context contains only safe builder information', () => {
  const config = cloneConfig(defaultConfig);
  config.aiProviders.profiles.deepseek.apiKey = 'must-not-leak';
  config.apps.chat.messages = [{ text: 'private chat' }];
  const context = createBuilderAssistantContext(config, { currentApp: 'home' });
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes('must-not-leak'), false);
  assert.equal(serialized.includes('private chat'), false);
  assert.equal(context.enabledApps.some(app => app.id === 'chat'), true);
});

test('assistant response keeps only whitelisted style and widget operations', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    reply: '换成深色风格并放上时钟。',
    operations: [
      { tool: 'setPhoneStyle', args: { primaryColor: '#123456', phoneFrame: 'midnight' } },
      { tool: 'addWidget', args: { kind: 'builtin', id: 'weather' } },
      { tool: 'setPath', args: { path: 'character.definition', value: 'unsafe' } },
      { tool: 'addWidget', args: { kind: 'custom', id: 'not-real' } }
    ]
  }), config);
  assert.equal(response.operations.length, 2);
  assert.equal(response.operations[0].tool, 'setPhoneStyle');
  assert.equal(response.operations[1].tool, 'addWidget');
});

test('assistant draft changes appearance without mutating user data in source config', () => {
  const config = cloneConfig(defaultConfig);
  config.character.definition = 'do not touch';
  const result = applyBuilderAssistantOperations(config, [
    { tool: 'setPhoneStyle', args: { accent: '#aabbcc', iconSize: 64 } },
    { tool: 'setAppStyle', args: { appId: 'chat', values: { background: '#112233', uiTheme: 'wechat' } } },
    { tool: 'addWidget', args: { kind: 'builtin', id: 'weather' } },
    { tool: 'openPreview', args: { appId: 'chat' } }
  ]);
  assert.equal(config.theme.customization.tokens.accent, '#7fb59a');
  assert.equal(config.character.definition, 'do not touch');
  assert.equal(result.config.theme.customization.tokens.accent, '#aabbcc');
  assert.equal(result.config.theme.customization.desktop.iconSize, 64);
  assert.equal(result.config.theme.appLooks.chat.uiTheme, 'wechat');
  assert.equal(result.config.theme.widgets.weather.enabled, true);
  assert.equal(result.previewAppId, 'chat');
});

test('assistant rejects external image, code and unknown app operations', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    operations: [
      { tool: 'setPhoneStyle', args: { background: 'url(https://example.com/a.png)' } },
      { tool: 'setAppStyle', args: { appId: 'unknown', values: { accent: '#123456' } }, css: 'body{}' },
      { tool: 'moveWidget', args: { kind: 'builtin', id: 'clock', layout: { x: 0, y: 0, w: 20, h: 2 } } }
    ]
  }), config);
  assert.equal(response.operations.length, 1);
  assert.deepEqual(response.operations[0].args.layout, { x: 0, y: 0, w: 6, h: 2 });
});

test('assistant connection settings never retain an API key in phone config', () => {
  const normalized = normalizeConfig({
    aiAssistant: {
      enabled: true,
      providerId: 'qwen',
      model: 'qwen-plus',
      apiKey: 'must-not-be-kept'
    }
  });
  assert.equal(normalized.aiAssistant.enabled, true);
  assert.equal(normalized.aiAssistant.providerId, 'qwen');
  assert.equal(normalized.aiAssistant.model, 'qwen-plus');
  assert.equal('apiKey' in normalized.aiAssistant, false);
  assert.equal(normalized.aiAssistant.profileId, 'builder-assistant');
});
