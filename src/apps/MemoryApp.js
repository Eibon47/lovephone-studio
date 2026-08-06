import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import { activeCharacter, makeId, shortDate } from './appData.js?v=app-config-40';
import {
  removeItemWithUndo,
  restoreItemFromUndo
} from '../services/listUndo.js?v=app-config-44';

const typeLabels = {
  profile: '关于你',
  preferences: '偏好',
  relationship: '关系',
  event: '重要事件'
};

function memorySourceLabel(entry) {
  if (entry.source === 'chat-auto') return '来自聊天自动记录';
  if (entry.source === 'diary') return '来自日记';
  if (entry.source === 'goodnight') return '来自问候记录';
  return '手动添加';
}

function renderForm(entry = {}, allowedTypes = Object.keys(typeLabels)) {
  const types = allowedTypes.length ? allowedTypes : Object.keys(typeLabels);
  return `
    <form class="companion-editor" data-memory-form data-entry-id="${escapeHtml(entry.id || '')}">
      <div class="editor-title-row">
        <strong>${entry.id ? '编辑记忆' : '记住一件事'}</strong>
        ${entry.id ? '<button type="button" data-memory-cancel>取消</button>' : ''}
      </div>
      <select name="type">
        ${types.map(value => `<option value="${value}" ${entry.type === value ? 'selected' : ''}>${typeLabels[value] || value}</option>`).join('')}
      </select>
      <input name="title" value="${escapeHtml(entry.title || '')}" maxlength="30" placeholder="一句话标题" required />
      <textarea name="content" rows="3" maxlength="240" placeholder="写下希望角色记住的内容" required>${escapeHtml(entry.content || '')}</textarea>
      <button class="companion-primary-button" type="submit">${entry.id ? '保存修改' : '加入记忆'}</button>
    </form>`;
}

export const MemoryApp = {
  render(app, config, osState = {}) {
    const character = activeCharacter(config, osState);
    const allEntries = Array.isArray(config.apps.memory.entries) ? config.apps.memory.entries : [];
    const savedEntries = allEntries.filter(entry => (
      (entry.characterId || config.character.id) === character.id
    ));
    const previewEntries = osState.memoryAppearancePreviewMode ? [
      {
        id: 'memory-preview-preference',
        type: 'preferences',
        title: '喜欢安静的晚风',
        content: '比起热闹，更喜欢慢慢说话和散步。',
        date: new Date().toISOString().slice(0, 10),
        previewOnly: true
      },
      {
        id: 'memory-preview-relationship',
        type: 'relationship',
        title: '我们的称呼',
        content: `记得称呼你为“${character.userNickname || '你'}”。`,
        date: new Date().toISOString().slice(0, 10),
        previewOnly: true
      }
    ] : [];
    const entries = savedEntries.length ? savedEntries : previewEntries;
    const editing = entries.find(item => item.id === osState.memoryEditingId);
    const allowedTypes = config.apps.memory.types || [];
    return `
      <section class="phone-screen companion-data-app phone-memory-app">
        ${renderStatusBar('chat-statusbar')}
        <header class="app-top">
          <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
          <h3>${escapeHtml(character.name)}的记忆</h3>
          <span class="app-count">${entries.length}</span>
        </header>
        <div class="companion-app-content">
          <label class="companion-search"><span>⌕</span><input data-memory-search placeholder="搜索记忆" /></label>
          ${config.apps.memory.userEditable ? renderForm(editing, allowedTypes) : ''}
          ${osState.memoryUndo?.item?.characterId === character.id ? `
            <div class="companion-undo">
              <span>已删除“${escapeHtml(osState.memoryUndo.item.title)}”</span>
              <button type="button" data-memory-undo>撤销</button>
            </div>
          ` : ''}
          <div class="memory-list ${config.apps.memory.visibleCards || osState.memoryAppearancePreviewMode ? '' : 'is-compact'}" data-memory-list>
            ${entries.length ? entries.map(entry => {
              const confirming = osState.memoryDeleteConfirmId === entry.id;
              return `
              <article class="memory-entry" data-search-text="${escapeHtml(`${entry.title} ${entry.content} ${typeLabels[entry.type] || ''}`.toLowerCase())}">
                <header><span>${escapeHtml(typeLabels[entry.type] || '记忆')}</span><time>${escapeHtml(shortDate(entry.date))}</time></header>
                <strong>${escapeHtml(entry.title)}</strong>
                <p>${escapeHtml(entry.content)}</p>
                ${entry.previewOnly ? '' : `<small class="memory-source-label">${escapeHtml(memorySourceLabel(entry))}</small>`}
                ${entry.previewOnly ? '' : config.apps.memory.userEditable && confirming ? `
                  <div class="inline-delete-confirm">
                    <p>确定删除这条记忆吗？删除后仍可立即撤销。</p>
                    <button type="button" data-memory-delete-cancel>取消</button>
                    <button type="button" data-memory-delete-confirm="${escapeHtml(entry.id)}">确认删除</button>
                  </div>
                ` : config.apps.memory.userEditable ? `
                  <footer>
                    <button type="button" data-memory-edit="${escapeHtml(entry.id)}">编辑</button>
                    <button type="button" data-memory-delete="${escapeHtml(entry.id)}">删除</button>
                  </footer>` : ''}
              </article>`;
            }).join('') : `
              <div class="companion-empty"><i>◇</i><strong>还没有记忆</strong><p>把称呼、偏好和重要的小事放在这里。</p></div>`}
          </div>
        </div>
      </section>`;
  },

  bind(container, config, handlers, osState = {}) {
    const character = activeCharacter(config, osState);
    const allEntries = Array.isArray(config.apps.memory.entries) ? config.apps.memory.entries : [];
    const entries = allEntries.filter(entry => (
      (entry.characterId || config.character.id) === character.id
    ));
    const mergeEntries = currentEntries => [
      ...allEntries.filter(entry => (entry.characterId || config.character.id) !== character.id),
      ...currentEntries
    ];
    container.querySelector('[data-memory-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const id = form.dataset.entryId;
      const entry = {
        id: id || makeId('memory'),
        type: form.elements.type.value,
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim(),
        date: entries.find(item => item.id === id)?.date || new Date().toISOString().slice(0, 10),
        characterId: character.id
      };
      const next = id ? entries.map(item => item.id === id ? entry : item) : [entry, ...entries];
      handlers.updatePhoneState?.({ memoryEditingId: null });
      handlers.updatePath?.('apps.memory.entries', mergeEntries(next), { keepPhone: true });
    });
    container.querySelector('[data-memory-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ memoryEditingId: null });
    });
    container.querySelectorAll('[data-memory-edit]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        memoryEditingId: button.dataset.memoryEdit,
        memoryDeleteConfirmId: null
      }));
    });
    container.querySelectorAll('[data-memory-delete]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        memoryDeleteConfirmId: button.dataset.memoryDelete
      }));
    });
    container.querySelector('[data-memory-delete-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ memoryDeleteConfirmId: null });
    });
    container.querySelector('[data-memory-delete-confirm]')?.addEventListener('click', event => {
      const result = removeItemWithUndo(entries, event.currentTarget.dataset.memoryDeleteConfirm);
      if (!result.undo) return;
      handlers.updatePhoneState?.({
        memoryDeleteConfirmId: null,
        memoryEditingId: null,
        memoryUndo: result.undo
      });
      handlers.updatePath?.('apps.memory.entries', mergeEntries(result.next), { keepPhone: true });
    });
    container.querySelector('[data-memory-undo]')?.addEventListener('click', () => {
      const latest = handlers.getConfig?.() || config;
      const latestAll = Array.isArray(latest.apps.memory.entries) ? latest.apps.memory.entries : [];
      const latestRoleEntries = latestAll.filter(entry => (
        (entry.characterId || latest.character.id) === character.id
      ));
      const restored = restoreItemFromUndo(latestRoleEntries, osState.memoryUndo);
      const merged = [
        ...latestAll.filter(entry => (entry.characterId || latest.character.id) !== character.id),
        ...restored
      ];
      handlers.updatePhoneState?.({ memoryUndo: null });
      handlers.updatePath?.('apps.memory.entries', merged, { keepPhone: true });
    });
    container.querySelector('[data-memory-search]')?.addEventListener('input', event => {
      const query = event.currentTarget.value.trim().toLowerCase();
      container.querySelectorAll('.memory-entry').forEach(item => {
        item.hidden = Boolean(query) && !item.dataset.searchText.includes(query);
      });
    });
  }
};
