import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';
import {
  applyBuilderAssistantOperations,
  createBuilderAssistantContext,
  parseBuilderAssistantResponse,
  parseWidgetGenerationResponse
} from '../src/services/builderAssistantService.js';
import { renderAiAssistantPanel } from '../src/builder/AiAssistantPanel.js';

test('assistant keeps provider configuration inside its floating window', () => {
  const config = cloneConfig(defaultConfig);
  config.aiAssistant.enabled = true;
  const html = renderAiAssistantPanel(config, { open: true, panelView: 'connection' });

  assert.match(html, /class="ai-assistant-connection"/);
  assert.match(html, /data-ai-assistant-provider/);
  assert.match(html, /data-ai-assistant-key/);
  assert.match(html, /data-ai-assistant-model/);
  assert.match(html, /data-ai-assistant-connect/);
  assert.match(html, /返回对话/);
});

test('assistant can retain a failed connection key only in transient window state', () => {
  const config = cloneConfig(defaultConfig);
  const html = renderAiAssistantPanel(config, {
    open: true,
    panelView: 'connection',
    connectionApiKey: 'retry-only-secret'
  });

  assert.match(html, /value="retry-only-secret"/);
  assert.equal(JSON.stringify(config).includes('retry-only-secret'), false);
});

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
  assert.equal(response.intent, 'change');
});

test('assistant accepts ordinary conversation without demanding executable operations', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'chat',
    reply: '当然可以。我们可以先聊聊你希望它带来的陪伴感，再决定是否修改界面。',
    operations: []
  }), config);

  assert.equal(response.intent, 'chat');
  assert.match(response.reply, /先聊聊/);
  assert.deepEqual(response.operations, []);
});

test('assistant preserves a natural-language fallback instead of showing a safety failure', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse('我觉得当前桌面信息有点拥挤，可以先减少一个组件。', config);

  assert.equal(response.intent, 'chat');
  assert.match(response.reply, /桌面信息有点拥挤/);
  assert.deepEqual(response.operations, []);
});

test('assistant asks one clarification without changing the phone', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'clarify',
    reply: '你更想要温柔安静，还是活泼明亮的感觉？',
    operations: []
  }), config);

  assert.equal(response.intent, 'clarify');
  assert.deepEqual(response.operations, []);
});

test('assistant never executes operations attached to an explicit chat reply', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'chat',
    reply: '我们先讨论，不改界面。',
    operations: [{ tool: 'setPhoneStyle', args: { background: '#101010' } }]
  }), config);

  assert.equal(response.intent, 'chat');
  assert.deepEqual(response.operations, []);
});

test('assistant can toggle only optional Apps and chooses the changed App for preview', () => {
  const config = cloneConfig(defaultConfig);
  const parsed = parseBuilderAssistantResponse(JSON.stringify({
    operations: [
      { tool: 'setAppEnabled', args: { appId: 'diary', enabled: true } },
      { tool: 'setAppEnabled', args: { appId: 'chat', enabled: false } }
    ]
  }), config);
  assert.equal(parsed.operations.length, 1);
  const result = applyBuilderAssistantOperations(config, parsed.operations);
  assert.equal(result.config.apps.diary.enabled, true);
  assert.equal(result.config.components.diary, true);
  assert.equal(result.previewAppId, 'diary');
  assert.equal(config.apps.diary.enabled, false);
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

test('assistant keeps normalized design summaries without storing full conversations', () => {
  const normalized = normalizeConfig({
    aiAssistant: {
      enabled: true,
      designBrief: {
        preferences: ['低饱和绿色', '低饱和绿色'],
        avoid: ['不要大圆角'],
        decisions: ['桌面保持四列'],
        messages: ['不应保存的完整聊天']
      }
    }
  });
  assert.deepEqual(normalized.aiAssistant.designBrief.preferences, ['低饱和绿色']);
  assert.deepEqual(normalized.aiAssistant.designBrief.avoid, ['不要大圆角']);
  assert.equal('messages' in normalized.aiAssistant.designBrief, false);
});

test('assistant returns a safe widget proposal without generating code', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'proposeWidget',
    reply: '先确认这张陪伴状态卡。',
    operations: [],
    widgetProposal: {
      name: '陪伴状态卡',
      purpose: '查看当前角色状态',
      visual: '低饱和绿色，信息紧凑',
      layout: { x: 0, y: 0, w: 4, h: 2 },
      dataPermissions: ['activeCharacter', 'unknown'],
      actionPermissions: ['openChat', 'network']
    }
  }), config);
  assert.equal(response.intent, 'proposeWidget');
  assert.deepEqual(response.operations, []);
  assert.deepEqual(response.widgetProposal.dataPermissions, ['activeCharacter']);
  assert.deepEqual(response.widgetProposal.actionPermissions, ['openChat']);
});

test('ordinary assistant replies cannot smuggle generated widget code', () => {
  const config = cloneConfig(defaultConfig);
  const response = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'change',
    reply: '尝试生成组件。',
    operations: [{ tool: 'createCodeWidget', args: {
      name: '偷偷生成', layout: { x: 0, y: 0, w: 2, h: 2 },
      dataPermissions: [], actionPermissions: [], html: '<div>test</div>', css: '', js: ''
    }}]
  }), config);
  assert.deepEqual(response.operations, []);
});

test('confirmed widget generation accepts offline code within proposed permissions', () => {
  const config = cloneConfig(defaultConfig);
  const proposal = {
    dataPermissions: ['activeCharacter'],
    actionPermissions: ['openChat']
  };
  const response = parseWidgetGenerationResponse(JSON.stringify({
    intent: 'generateWidget', reply: '已生成。', operations: [{ tool: 'createCodeWidget', args: {
      name: '陪伴卡', layout: { x: 0, y: 0, w: 4, h: 2 },
      dataPermissions: ['activeCharacter'], actionPermissions: ['openChat'],
      html: '<div class="card"><strong data-name></strong><button>聊天</button></div>',
      css: '.card { height: 100%; background: #e8f1e9; }',
      js: "document.querySelector('[data-name]').textContent = widget.data('activeCharacter').primary;"
    }}]
  }), config, proposal);
  assert.equal(response.intent, 'generateWidget');
  assert.equal(response.operations.length, 1);
  const draft = applyBuilderAssistantOperations(config, response.operations);
  const widget = draft.config.theme.customization.widgets.at(-1);
  assert.equal(widget.mode, 'code');
  assert.equal(widget.name, '陪伴卡');
  assert.equal(draft.previewAppId, 'home');
});

test('widget generation rejects network code and permission expansion', () => {
  const config = cloneConfig(defaultConfig);
  const proposal = { dataPermissions: ['time'], actionPermissions: [] };
  const unsafeCode = parseWidgetGenerationResponse(JSON.stringify({
    intent: 'generateWidget', reply: '生成。', operations: [{ tool: 'createCodeWidget', args: {
      name: '联网卡', layout: { x: 0, y: 0, w: 2, h: 2 }, dataPermissions: ['time'], actionPermissions: [],
      html: '<div></div>', css: '', js: "fetch('https://example.com')"
    }}]
  }), config, proposal);
  const expanded = parseWidgetGenerationResponse(JSON.stringify({
    intent: 'generateWidget', reply: '生成。', operations: [{ tool: 'createCodeWidget', args: {
      name: '越权卡', layout: { x: 0, y: 0, w: 2, h: 2 }, dataPermissions: ['memory'], actionPermissions: ['openChat'],
      html: '<div></div>', css: '', js: ''
    }}]
  }), config, proposal);
  assert.deepEqual(unsafeCode.operations, []);
  assert.deepEqual(expanded.operations, []);
});

test('assistant window exposes design memory and widget confirmation controls', () => {
  const config = cloneConfig(defaultConfig);
  config.aiAssistant.designBrief.preferences = ['低饱和绿色'];
  const memoryHtml = renderAiAssistantPanel(config, { open: true, panelView: 'memory' });
  const proposalHtml = renderAiAssistantPanel(config, { open: true, panelView: 'chat', pendingWidgetProposal: {
    name: '时光卡', purpose: '显示时间', visual: '极简', layout: { w: 4, h: 2 }, dataPermissions: ['time'], actionPermissions: []
  }});
  assert.match(memoryHtml, /低饱和绿色/);
  assert.match(memoryHtml, /data-ai-memory-remove/);
  assert.match(proposalHtml, /data-ai-widget-generate/);
  assert.match(proposalHtml, /生成组件/);
});

test('assistant quick prompts disappear after the user starts a conversation', () => {
  const config = cloneConfig(defaultConfig);
  const firstOpen = renderAiAssistantPanel(config, { open: true, messages: [] });
  const afterChat = renderAiAssistantPanel(config, {
    open: true,
    messages: [
      { role: 'user', content: '我们先聊聊。' },
      { role: 'assistant', content: '好。' }
    ]
  });
  assert.match(firstOpen, /ai-assistant-suggestions/);
  assert.doesNotMatch(afterChat, /ai-assistant-suggestions/);
});

test('assistant image operations resolve local attachments without exposing image data to the model context', () => {
  const config = cloneConfig(defaultConfig);
  const attachments = [{
    id: 'attachment-1', label: '附件 1', name: 'chat.png', kind: 'image', type: 'image/png', size: 120,
    image: 'data:image/webp;base64,GENERAL', squareImage: 'data:image/webp;base64,SQUARE'
  }];
  const context = createBuilderAssistantContext(config, { currentApp: 'home' }, attachments);
  assert.equal(JSON.stringify(context).includes('base64'), false);
  const parsed = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'change', reply: '已替换聊天图标。', operations: [{ tool: 'applyImageAsset', args: {
      attachmentId: 'attachment-1', targetType: 'appIcon', targetId: 'chat', slot: 'icon'
    }}]
  }), config, { attachments });
  assert.equal(parsed.operations.length, 1);
  const draft = applyBuilderAssistantOperations(config, parsed.operations, { attachments });
  assert.equal(draft.config.theme.appLooks.chat.icon.value, 'data:image/webp;base64,SQUARE');
  assert.equal(config.theme.appLooks.chat, undefined);
  assert.equal(draft.previewAppId, 'home');
});

test('assistant image operations reject unknown attachments and unsafe target slots', () => {
  const config = cloneConfig(defaultConfig);
  const attachments = [{ id: 'attachment-1', kind: 'image', image: 'data:image/webp;base64,AAAA' }];
  const parsed = parseBuilderAssistantResponse(JSON.stringify({
    intent: 'change', reply: '尝试替换。', operations: [
      { tool: 'applyImageAsset', args: { attachmentId: 'missing', targetType: 'appIcon', targetId: 'chat', slot: 'icon' } },
      { tool: 'applyImageAsset', args: { attachmentId: 'attachment-1', targetType: 'appMedia', targetId: 'chat', slot: 'script' } }
    ]
  }), config, { attachments });
  assert.deepEqual(parsed.operations, []);
});
