import { escapeHtml } from '../system/html.js';
import { describeBuilderAssistantOperation } from '../services/builderAssistantService.js';
import { AI_PROVIDER_CATALOG, getAiProvider } from '../config/aiProviderCatalog.js?v=app-config-85';

const QUICK_PROMPTS = [
  '你觉得我现在的小手机哪里最需要优化？',
  '先和我聊聊适合陪伴类小手机的风格。',
  '把整机做成深色玻璃风，先给我预览。',
  '我想做一个特别的桌面小组件，帮我想方案。'
];

const INTENT_COPY = {
  chat: '正在和你讨论，不会修改小手机',
  clarify: '需要你补充一个关键信息',
  advise: '正在给出设计建议，不会自动修改',
  change: '已生成可确认的预览修改',
  proposeWidget: '组件方案待你确认，尚未生成代码',
  generateWidget: '正在生成或检查自定义组件'
};

const MEMORY_LABELS = {
  preferences: '喜欢的设计',
  avoid: '避免使用',
  decisions: '已确认决定'
};

function messageHtml(message) {
  return `<div class="ai-assistant-message is-${message.role === 'user' ? 'user' : 'assistant'}">${escapeHtml(message.content)}</div>`;
}

function connectionPanelHtml(config, assistant) {
  const assistantConfig = config.aiAssistant || {};
  const draft = assistant.connectionDraft || {};
  const provider = getAiProvider(draft.providerId || assistantConfig.providerId) || AI_PROVIDER_CATALOG[0];
  const model = draft.model || assistantConfig.model || provider.models[0] || '';
  const baseUrl = draft.baseUrl || assistantConfig.baseUrl || '';
  const status = assistant.connectionStatus || (assistantConfig.model ? `已连接：${assistantConfig.model}` : '尚未连接');
  const allModels = [...new Set(AI_PROVIDER_CATALOG.flatMap(item => item.models || []))];
  return `
    <section class="ai-assistant-connection">
      <div class="ai-assistant-connection-intro">
        <strong>连接搭建模型</strong>
        <small>API Key 不会回显，也不会写入小手机配置或导出文件。</small>
      </div>
      <label><span>服务商</span><select data-ai-assistant-provider>${AI_PROVIDER_CATALOG.map(item => `<option value="${item.id}" ${item.id === provider.id ? 'selected' : ''}>${item.name}</option>`).join('')}</select></label>
      <label><span>API Key</span><input type="password" autocomplete="new-password" value="${escapeHtml(assistant.connectionApiKey || '')}" data-ai-assistant-key placeholder="${provider.apiKeyOptional ? '本地模型可以不填' : '粘贴 API Key'}" /></label>
      <label><span>模型名称</span><input type="text" list="assistant-window-models" value="${escapeHtml(model)}" data-ai-assistant-model placeholder="输入模型 ID" /><datalist id="assistant-window-models">${allModels.map(item => `<option value="${escapeHtml(item)}"></option>`).join('')}</datalist></label>
      <label><span>接口地址 <small>可选</small></span><input type="url" value="${escapeHtml(baseUrl)}" data-ai-assistant-base-url placeholder="https://api.example.com/v1" /></label>
      <p class="ai-assistant-connection-status" data-ai-assistant-status>${escapeHtml(status)}</p>
      <div class="ai-assistant-connection-actions"><button type="button" data-ai-assistant-show-chat>返回对话</button><button class="primary" type="button" data-ai-assistant-connect>连接并测试</button></div>
    </section>`;
}

function memoryPanelHtml(config) {
  const brief = config.aiAssistant?.designBrief || {};
  return `
    <section class="ai-assistant-memory">
      <div class="ai-assistant-memory-intro"><strong>设计偏好</strong><small>这里只保存简短设计摘要，不保存完整聊天，也不会进入成品小手机。</small></div>
      ${Object.entries(MEMORY_LABELS).map(([kind, label]) => `
        <div class="ai-assistant-memory-group"><strong>${label}</strong>
          ${(brief[kind] || []).length ? `<ul>${brief[kind].map((item, index) => `<li><span>${escapeHtml(item)}</span><button type="button" aria-label="删除" data-ai-memory-remove data-kind="${kind}" data-index="${index}">×</button></li>`).join('')}</ul>` : '<small>暂无记录</small>'}
        </div>`).join('')}
      <form class="ai-assistant-memory-add" data-ai-memory-form>
        <select data-ai-memory-kind>${Object.entries(MEMORY_LABELS).map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('')}</select>
        <input type="text" maxlength="120" data-ai-memory-value placeholder="例如：喜欢低饱和的绿色" />
        <button class="primary" type="submit">添加</button>
      </form>
      <button type="button" class="ai-assistant-back" data-ai-assistant-show-chat>返回对话</button>
    </section>`;
}

function widgetProposalHtml(proposal, assistant) {
  if (!proposal) return '';
  return `
    <section class="ai-widget-proposal">
      <header><strong>${escapeHtml(proposal.name)}</strong><span>${proposal.layout.w}×${proposal.layout.h}</span></header>
      <p>${escapeHtml(proposal.purpose)}</p><small>${escapeHtml(proposal.visual)}</small>
      <dl><dt>本机数据</dt><dd>${proposal.dataPermissions.length ? proposal.dataPermissions.map(escapeHtml).join('、') : '不读取'}</dd><dt>点击能力</dt><dd>${proposal.actionPermissions.length ? proposal.actionPermissions.map(escapeHtml).join('、') : '无'}</dd></dl>
      ${assistant.widgetGenerationStatus ? `<p class="ai-widget-status">${escapeHtml(assistant.widgetGenerationStatus)}</p>` : ''}
      <div><button type="button" data-ai-widget-discard>放弃方案</button><button class="primary" type="button" data-ai-widget-generate ${assistant.isGeneratingWidget ? 'disabled' : ''}>${assistant.isGeneratingWidget ? '正在生成' : '生成组件'}</button></div>
    </section>`;
}

function generatedWidgetHtml(review, status) {
  if (!review) return status ? `<p class="ai-widget-status is-error">${escapeHtml(status)}</p>` : '';
  return `
    <section class="ai-widget-review">
      <header><strong>${escapeHtml(review.name)}</strong><span class="is-safe">安全检查通过</span></header>
      <dl><dt>尺寸</dt><dd>${review.layout.w}×${review.layout.h}</dd><dt>本机数据</dt><dd>${review.dataPermissions.length ? review.dataPermissions.map(escapeHtml).join('、') : '不读取'}</dd><dt>点击能力</dt><dd>${review.actionPermissions.length ? review.actionPermissions.map(escapeHtml).join('、') : '无'}</dd></dl>
      <details><summary>查看代码</summary><strong>HTML</strong><pre>${escapeHtml(review.html)}</pre><strong>CSS</strong><pre>${escapeHtml(review.css)}</pre><strong>JavaScript</strong><pre>${escapeHtml(review.js)}</pre></details>
    </section>`;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentHtml(attachment) {
  const preview = attachment.preflight;
  const packageDetails = attachment.kind === 'theme-package' && preview
    ? `<small>${escapeHtml(preview.manifest.name)} v${escapeHtml(preview.manifest.version)} · ${preview.summary.fileCount} 个文件 · ${formatBytes(preview.summary.archiveBytes)}</small><button type="button" data-ai-preview-theme="${escapeHtml(attachment.id)}">预览主题</button>`
    : attachment.kind === 'app-package' && preview
      ? `<small>${escapeHtml(preview.manifest.name)} v${escapeHtml(preview.manifest.version)} · ${attachment.isUpdate ? '更新现有 App' : '全新安装'} · ${preview.summary.pageCount} 个页面</small><small>权限：${preview.manifest.permissions.length ? preview.manifest.permissions.map(escapeHtml).join('、') : '无'}${preview.manifest.networkOrigins.length ? ` · 联网：${preview.manifest.networkOrigins.map(escapeHtml).join('、')}` : ''}</small>${attachment.installed ? '<small>已完成安装</small>' : `<button type="button" data-ai-install-app="${escapeHtml(attachment.id)}">确认安装</button>`}`
      : `<small>${escapeHtml(attachment.status || '')}</small>`;
  return `
    <article class="ai-attachment-card is-${escapeHtml(attachment.kind)}">
      <span class="ai-attachment-preview">${attachment.kind === 'image' ? `<img src="${escapeHtml(attachment.image)}" alt="" />` : `<b>${attachment.kind === 'text' ? 'TXT' : 'ZIP'}</b>`}</span>
      <span class="ai-attachment-copy"><strong>${escapeHtml(attachment.label)} · ${escapeHtml(attachment.name)}</strong>${packageDetails}<small>${formatBytes(attachment.size)}</small></span>
      <button class="ai-attachment-remove" type="button" data-ai-remove-attachment="${escapeHtml(attachment.id)}" aria-label="移除 ${escapeHtml(attachment.label)}" title="移除">×</button>
    </article>`;
}

export function renderAiAssistantPanel(config, assistant = {}) {
  const isOpen = Boolean(assistant.open);
  const messages = Array.isArray(assistant.messages) && assistant.messages.length ? assistant.messages : [{ role: 'assistant', content: '可以先和我聊聊你的想法。需要我动手时，请明确说“帮我改”或“直接做”。' }];
  const assistantConfig = config.aiAssistant || {};
  const panelView = ['connection', 'memory'].includes(assistant.panelView) ? assistant.panelView : 'chat';
  const hasDraft = Boolean(assistant.draftBase);
  const hasConversation = Array.isArray(assistant.messages)
    && assistant.messages.some(message => message.role === 'user');
  const draftOperations = Array.isArray(assistant.lastOperations) ? assistant.lastOperations : [];
  const changeCount = Array.isArray(assistant.draftHistory) ? assistant.draftHistory.length : 0;
  const attachments = Array.isArray(assistant.attachments) ? assistant.attachments : [];
  const positionX = Number.isFinite(Number(assistant.position?.x)) ? Number(assistant.position.x) : 420;
  const positionY = Number.isFinite(Number(assistant.position?.y)) ? Number(assistant.position.y) : 24;
  const viewLabel = panelView === 'connection' ? '接口设置' : panelView === 'memory' ? '设计偏好' : (assistantConfig.model ? `使用 ${assistantConfig.model}` : '请先完成接口连接');
  return `
    <div class="ai-assistant-root ${isOpen ? 'is-open' : ''} ${hasDraft ? 'has-pending' : ''}" style="left:${positionX}px;top:${positionY}px" aria-live="polite">
      ${hasDraft && !isOpen ? `<div class="ai-assistant-pending-bar"><span><strong>AI 预览待确认</strong><small>${changeCount} 轮修改尚未应用</small></span><button type="button" data-ai-assistant-toggle>查看</button><button type="button" class="primary" data-ai-assistant-apply>应用</button></div>` : ''}
      <button class="ai-assistant-fab" type="button" data-ai-assistant-toggle data-ai-assistant-drag-handle aria-label="打开 AI 助手" title="打开或拖动 AI 助手"><span>AI</span></button>
      <aside class="ai-assistant-panel" aria-label="AI 搭建助手" ${isOpen ? '' : 'hidden'}>
        <header class="ai-assistant-header" data-ai-assistant-drag-handle title="拖动窗口"><div><strong>AI 搭建助手</strong><small>${escapeHtml(viewLabel)}</small></div><div class="ai-assistant-header-actions"><button type="button" data-ai-assistant-memory title="设计偏好">偏好</button><button type="button" data-ai-assistant-configure title="配置接口">接口</button><button type="button" data-ai-assistant-close aria-label="收起" title="收起">×</button></div></header>
        ${panelView === 'connection' ? connectionPanelHtml(config, assistant) : panelView === 'memory' ? memoryPanelHtml(config) : `
          <div class="ai-assistant-chat" data-ai-assistant-chat><p class="ai-assistant-intent is-${escapeHtml(assistant.lastResponseIntent || 'chat')}">${escapeHtml(INTENT_COPY[assistant.lastResponseIntent] || INTENT_COPY.chat)}</p>${messages.map(messageHtml).join('')}${assistant.isSending ? '<div class="ai-assistant-message is-assistant is-loading">正在理解你的想法...</div>' : ''}</div>
          ${widgetProposalHtml(assistant.pendingWidgetProposal, assistant)}
          ${generatedWidgetHtml(assistant.generatedWidgetReview, assistant.pendingWidgetProposal ? '' : assistant.widgetGenerationStatus)}
          ${draftOperations.length ? `<section class="ai-assistant-draft"><header><strong>AI 预览草稿</strong><span>第 ${changeCount} 轮 · ${draftOperations.length} 项</span></header><ul>${draftOperations.map(operation => `<li>${escapeHtml(describeBuilderAssistantOperation(operation))}</li>`).join('')}</ul></section>` : ''}
          ${hasDraft ? `<div class="ai-assistant-draft-actions"><button type="button" class="subtle" data-ai-assistant-undo ${assistant.draftHistory?.length ? '' : 'disabled'}>撤销上一步</button><button type="button" class="subtle" data-ai-assistant-discard>放弃全部修改</button><button type="button" class="primary" data-ai-assistant-apply>应用到小手机</button></div>` : ''}
          ${hasConversation ? '' : `<div class="ai-assistant-suggestions">${QUICK_PROMPTS.map(prompt => `<button type="button" data-ai-assistant-suggestion="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('')}</div>`}
          ${attachments.length ? `<div class="ai-assistant-attachments">${attachments.map(attachmentHtml).join('')}</div>` : ''}
          ${assistant.attachmentError ? `<p class="ai-attachment-error" role="alert">${escapeHtml(assistant.attachmentError)}</p>` : ''}
          <form class="ai-assistant-composer" data-ai-assistant-form data-ai-attachment-dropzone>
            <label class="ai-assistant-attach" title="添加图片或文件" aria-label="添加图片或文件">＋<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.html,.css,.js,.mjs,.json,.zip,.lptheme.zip,.lovephone-app.zip" data-ai-assistant-files /></label>
            <textarea rows="2" maxlength="500" placeholder="聊聊想法，或明确说“帮我改……”" data-ai-assistant-input ${assistant.isSending || assistant.isGeneratingWidget ? 'disabled' : ''}></textarea>
            <button type="submit" class="primary" ${assistant.isSending || assistant.isGeneratingWidget || !assistantConfig.providerId ? 'disabled' : ''}>发送</button>
          </form>`}
      </aside>
    </div>`;
}

export function bindAiAssistantPanel(root, handlers) {
  const floatingRoot = root.querySelector('.ai-assistant-root');
  const builderPane = root.querySelector('.builder-pane');
  if (floatingRoot && builderPane) {
    const floating = floatingRoot.getBoundingClientRect();
    const builder = builderPane.getBoundingClientRect();
    floatingRoot.style.left = `${Math.round(Math.min(Math.max(builder.left + 8, floating.left), Math.max(builder.left + 8, builder.right - floating.width - 8)))}px`;
    floatingRoot.style.top = `${Math.round(Math.min(Math.max(8, floating.top), Math.max(8, window.innerHeight - floating.height - 8)))}px`;
  }
  root.querySelectorAll('[data-ai-assistant-toggle]').forEach(button => button.addEventListener('click', handlers.toggle));
  root.querySelector('[data-ai-assistant-close]')?.addEventListener('click', handlers.close);
  root.querySelector('[data-ai-assistant-configure]')?.addEventListener('click', handlers.configure);
  root.querySelector('[data-ai-assistant-memory]')?.addEventListener('click', handlers.showMemory);
  root.querySelectorAll('[data-ai-assistant-show-chat]').forEach(button => button.addEventListener('click', handlers.showChat));
  root.querySelectorAll('[data-ai-assistant-suggestion]').forEach(button => button.addEventListener('click', () => handlers.suggest(button.dataset.aiAssistantSuggestion || '')));
  root.querySelector('[data-ai-assistant-form]')?.addEventListener('submit', event => { event.preventDefault(); handlers.send(root.querySelector('[data-ai-assistant-input]')?.value || ''); });
  root.querySelectorAll('[data-ai-assistant-apply]').forEach(button => button.addEventListener('click', handlers.apply));
  root.querySelector('[data-ai-assistant-discard]')?.addEventListener('click', handlers.discard);
  root.querySelector('[data-ai-assistant-undo]')?.addEventListener('click', handlers.undo);
  root.querySelector('[data-ai-widget-generate]')?.addEventListener('click', handlers.generateWidget);
  root.querySelector('[data-ai-widget-discard]')?.addEventListener('click', handlers.discardWidgetProposal);
  root.querySelectorAll('[data-ai-remove-attachment]').forEach(button => button.addEventListener('click', () => handlers.removeAttachment(button.dataset.aiRemoveAttachment)));
  root.querySelectorAll('[data-ai-preview-theme]').forEach(button => button.addEventListener('click', () => handlers.previewThemeAttachment(button.dataset.aiPreviewTheme)));
  root.querySelectorAll('[data-ai-install-app]').forEach(button => button.addEventListener('click', () => handlers.installAppAttachment(button.dataset.aiInstallApp)));
  root.querySelector('[data-ai-assistant-files]')?.addEventListener('change', event => {
    const files = [...(event.target.files || [])];
    if (files.length) handlers.addAttachments(files);
    event.target.value = '';
  });
  const dropzone = root.querySelector('[data-ai-attachment-dropzone]');
  dropzone?.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('is-dragover'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone?.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) handlers.addAttachments(files);
  });
  root.querySelector('[data-ai-memory-form]')?.addEventListener('submit', event => { event.preventDefault(); handlers.addMemory({ kind: root.querySelector('[data-ai-memory-kind]')?.value || '', value: root.querySelector('[data-ai-memory-value]')?.value || '' }); });
  root.querySelectorAll('[data-ai-memory-remove]').forEach(button => button.addEventListener('click', () => handlers.removeMemory({ kind: button.dataset.kind, index: Number(button.dataset.index) })));
  root.querySelector('[data-ai-assistant-connect]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await handlers.connect?.({ providerId: root.querySelector('[data-ai-assistant-provider]')?.value || '', apiKey: root.querySelector('[data-ai-assistant-key]')?.value.trim() || '', model: root.querySelector('[data-ai-assistant-model]')?.value.trim() || '', baseUrl: root.querySelector('[data-ai-assistant-base-url]')?.value.trim() || '' }); } finally { button.disabled = false; }
  });
  root.querySelectorAll('[data-ai-assistant-drag-handle]').forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      if (event.target.closest('button') && event.target.closest('button') !== handle) return;
      const panel = handle.closest('.ai-assistant-root');
      const builder = root.querySelector('.builder-pane');
      if (!panel || !builder) return;
      const start = panel.getBoundingClientRect();
      const bounds = builder.getBoundingClientRect();
      const offsetX = event.clientX - start.left;
      const offsetY = event.clientY - start.top;
      let moved = false;
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      panel.classList.add('is-dragging');
      const move = moveEvent => {
        const x = Math.min(Math.max(bounds.left + 8, moveEvent.clientX - offsetX), Math.max(bounds.left + 8, bounds.right - panel.offsetWidth - 8));
        const y = Math.min(Math.max(8, moveEvent.clientY - offsetY), Math.max(8, window.innerHeight - panel.offsetHeight - 8));
        moved ||= Math.abs(x - start.left) > 3 || Math.abs(y - start.top) > 3;
        panel.style.left = `${Math.round(x)}px`; panel.style.top = `${Math.round(y)}px`;
      };
      const end = () => {
        panel.classList.remove('is-dragging');
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
        const rect = panel.getBoundingClientRect(); handlers.move?.({ x: Math.round(rect.left), y: Math.round(rect.top) });
        if (moved) handle.dataset.dragJustFinished = 'true';
        setTimeout(() => delete handle.dataset.dragJustFinished, 0);
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    });
    handle.addEventListener('click', event => { if (handle.dataset.dragJustFinished === 'true') { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  });
}
