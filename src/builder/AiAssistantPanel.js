import { escapeHtml } from '../system/html.js';
import { describeBuilderAssistantOperation } from '../services/builderAssistantService.js';

const QUICK_PROMPTS = [
  '把整机做成深色玻璃风，保留聊天的舒适感。',
  '给桌面加一个时间和天气组件，排得干净一点。',
  '把聊天 App 做成清爽的绿色社交风格。',
  '帮我把桌面图标做得更小、更紧凑。'
];

function messageHtml(message) {
  return `
    <div class="ai-assistant-message is-${message.role === 'user' ? 'user' : 'assistant'}">
      ${escapeHtml(message.content)}
    </div>
  `;
}

export function renderAiAssistantPanel(config, assistant = {}) {
  const isOpen = Boolean(assistant.open);
  const messages = Array.isArray(assistant.messages) && assistant.messages.length
    ? assistant.messages
    : [{ role: 'assistant', content: '告诉我你想把小手机变成什么感觉，我会先生成可预览的美化草稿。' }];
  const assistantConfig = config.aiAssistant || {};
  const activeProviderId = assistantConfig.providerId || '';
  const activeModel = assistantConfig.model || '';
  const hasDraft = Boolean(assistant.draftBase);
  const draftOperations = Array.isArray(assistant.lastOperations) ? assistant.lastOperations : [];

  return `
    <div class="ai-assistant-root ${isOpen ? 'is-open' : ''}" aria-live="polite">
      <button class="ai-assistant-fab" type="button" data-ai-assistant-toggle aria-label="打开 AI 助手" title="AI 助手">
        <span>AI</span><b>搭建助手</b>
      </button>
      <aside class="ai-assistant-panel" aria-label="AI 搭建助手" ${isOpen ? '' : 'hidden'}>
        <header class="ai-assistant-header">
          <div>
            <strong>AI 搭建助手</strong>
            <small>${activeProviderId ? `使用 ${escapeHtml(activeModel || activeProviderId)} 模型` : '请先完成接口连接'}</small>
          </div>
          <div class="ai-assistant-header-actions">
            <button type="button" data-ai-assistant-configure>配置接口</button>
            <button type="button" data-ai-assistant-close aria-label="收起 AI 助手" title="收起">×</button>
          </div>
        </header>
        <div class="ai-assistant-chat" data-ai-assistant-chat>
          ${messages.map(messageHtml).join('')}
          ${assistant.isSending ? '<div class="ai-assistant-message is-assistant is-loading">正在整理可预览的方案...</div>' : ''}
        </div>
        ${draftOperations.length ? `
          <section class="ai-assistant-draft">
            <header><strong>本次草稿</strong><span>${draftOperations.length} 项</span></header>
            <ul>${draftOperations.map(operation => `<li>${escapeHtml(describeBuilderAssistantOperation(operation))}</li>`).join('')}</ul>
          </section>
        ` : ''}
        ${hasDraft ? `
          <div class="ai-assistant-draft-actions">
            <button type="button" class="subtle" data-ai-assistant-undo ${assistant.draftHistory?.length ? '' : 'disabled'}>撤销上一步</button>
            <button type="button" class="subtle" data-ai-assistant-discard>放弃草稿</button>
            <button type="button" class="primary" data-ai-assistant-apply>应用修改</button>
          </div>
        ` : ''}
        <div class="ai-assistant-suggestions">
          ${QUICK_PROMPTS.map(prompt => `<button type="button" data-ai-assistant-suggestion="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('')}
        </div>
        <form class="ai-assistant-composer" data-ai-assistant-form>
          <textarea rows="2" maxlength="500" placeholder="例如：做成奶油绿的手账风，加一个唱片机组件" data-ai-assistant-input ${assistant.isSending ? 'disabled' : ''}></textarea>
          <button type="submit" class="primary" ${assistant.isSending || !activeProviderId ? 'disabled' : ''}>发送</button>
        </form>
      </aside>
    </div>
  `;
}

export function bindAiAssistantPanel(root, handlers) {
  root.querySelector('[data-ai-assistant-toggle]')?.addEventListener('click', handlers.toggle);
  root.querySelector('[data-ai-assistant-close]')?.addEventListener('click', handlers.close);
  root.querySelector('[data-ai-assistant-configure]')?.addEventListener('click', handlers.configure);
  root.querySelectorAll('[data-ai-assistant-suggestion]').forEach(button => {
    button.addEventListener('click', () => handlers.suggest(button.dataset.aiAssistantSuggestion || ''));
  });
  root.querySelector('[data-ai-assistant-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const input = root.querySelector('[data-ai-assistant-input]');
    handlers.send(input?.value || '');
  });
  root.querySelector('[data-ai-assistant-apply]')?.addEventListener('click', handlers.apply);
  root.querySelector('[data-ai-assistant-discard]')?.addEventListener('click', handlers.discard);
  root.querySelector('[data-ai-assistant-undo]')?.addEventListener('click', handlers.undo);
}
