import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import { activeCharacter, makeId, shortDate } from './appData.js?v=app-config-40';
import {
  removeItemWithUndo,
  restoreItemFromUndo
} from '../services/listUndo.js?v=app-config-44';
import { memorySimilarity, mergeMemoryEntries, normalizeMemoryEntry } from '../services/memoryRetrievalService.js';

const typeLabels = {
  profile: '关于你',
  preferences: '偏好',
  relationship: '关系',
  event: '重要事件'
};

function memorySourceLabel(entry) {
  if (entry.sourceRef?.label) return `来自${entry.sourceRef.label}`;
  if (entry.source === 'chat-auto') return '来自聊天自动记录';
  if (entry.source === 'diary') return '来自日记';
  if (entry.source === 'goodnight') return '来自问候记录';
  if (entry.source === 'anniversary') return '来自纪念日';
  if (entry.source === 'chat') return '来自最近聊天';
  return '手动添加';
}

function memorySourceExists(config, entry) {
  const sourceRef = entry.sourceRef;
  if (!sourceRef?.appId || !sourceRef.sourceId) return true;
  const sourceId = String(sourceRef.sourceId);
  if (sourceRef.appId === 'chat') {
    return (config.apps.chat.messages || []).some(item => String(item.id) === sourceId);
  }
  if (sourceRef.appId === 'diary') {
    return (config.apps.diary.entries || []).some(item => String(item.id) === sourceId);
  }
  if (sourceRef.appId === 'anniversary') {
    return (config.apps.anniversary.events || []).some(item => String(item.id) === sourceId);
  }
  if (sourceRef.appId === 'goodnight') {
    return [
      ...(config.apps.goodnight.entries || []),
      ...(config.apps.goodnight.greetings || [])
    ].some(item => String(item.id) === sourceId);
  }
  if (sourceRef.appId === 'music') {
    return (config.companion?.events || []).some(item => (
      item.sourceApp === 'music' && String(item.sourceId) === sourceId
    ));
  }
  return true;
}

function renderMemorySource(config, entry) {
  const label = escapeHtml(memorySourceLabel(entry));
  if (!entry.sourceRef?.appId) return label;
  if (!memorySourceExists(config, entry)) return `${label} · 原内容已删除`;
  return `<button type="button" data-memory-source-app="${escapeHtml(entry.sourceRef.appId)}" data-memory-source-id="${escapeHtml(entry.sourceRef.sourceId || '')}">${label}</button>`;
}

function renderForm(entry = {}, allowedTypes = Object.keys(typeLabels)) {
  entry = entry || {};
  const types = allowedTypes.length ? allowedTypes : Object.keys(typeLabels);
  return `
    <form class="companion-editor" data-memory-form data-entry-id="${escapeHtml(entry.id || '')}" data-candidate-id="${escapeHtml(entry.candidateId || '')}">
      <div class="editor-title-row">
        <strong>${entry.id ? '编辑记忆' : '记住一件事'}</strong>
        ${entry.id ? '<button type="button" data-memory-cancel>取消</button>' : ''}
      </div>
      <select name="type">
        ${types.map(value => `<option value="${value}" ${entry.type === value ? 'selected' : ''}>${typeLabels[value] || value}</option>`).join('')}
      </select>
      <input name="title" value="${escapeHtml(entry.title || '')}" maxlength="30" placeholder="一句话标题" required />
      <textarea name="content" rows="3" maxlength="240" placeholder="写下希望角色记住的内容" required>${escapeHtml(entry.content || '')}</textarea>
      <label><span>重要度</span><select name="importance">${[1, 2, 3, 4, 5].map(value => `<option value="${value}" ${Number(entry.importance || 3) === value ? 'selected' : ''}>${value} 级</option>`).join('')}</select></label>
      <label><span>有效期</span><select name="expiry"><option value="" ${!entry.expiresAt ? 'selected' : ''}>永不过期</option><option value="30">30 天</option><option value="90">90 天</option><option value="custom" ${entry.expiresAt ? 'selected' : ''}>自定义日期</option></select></label>
      <input type="date" name="expiresAt" value="${escapeHtml(entry.expiresAt ? entry.expiresAt.slice(0, 10) : '')}" />
      <button class="companion-primary-button" type="submit">${entry.candidateId ? '编辑后记住' : entry.id ? '保存修改' : '加入记忆'}</button>
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
    const candidateEditing = (config.companion?.memoryCandidates || []).find(item => item.id === osState.memoryCandidateEditingId);
    const editing = entries.find(item => item.id === osState.memoryEditingId)
      || (candidateEditing ? { ...candidateEditing, id: '', candidateId: candidateEditing.id, importance: 3 } : null);
    const allowedTypes = config.apps.memory.types || [];
    const candidates = (config.companion?.memoryCandidates || [])
      .filter(item => item.characterId === character.id && item.status === 'pending')
      .slice(0, 5);
    const timeline = (config.companion?.timeline || [])
      .filter(item => item.characterId === character.id)
      .slice(0, 12);
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
          ${candidates.length ? `
            <section class="memory-candidate-section">
              <header><strong>待确认记忆</strong><span>${candidates.length} 条</span></header>
              <p>这些内容来自最近的相处，确认后才会进入角色的长期记忆。</p>
              ${candidates.map(item => `
                <article class="memory-candidate">
                  <div><small>${escapeHtml(memorySourceLabel({ source: item.sourceApp }))}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.content)}</p></div>
                  <footer><button type="button" data-memory-candidate-dismiss="${escapeHtml(item.id)}">忽略</button><button type="button" data-memory-candidate-edit="${escapeHtml(item.id)}">编辑后记住</button><button type="button" data-memory-candidate-accept="${escapeHtml(item.id)}">直接记住</button></footer>
                </article>`).join('')}
            </section>` : ''}
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
                <header><span>${escapeHtml(typeLabels[entry.type] || '记忆')} · 重要度 ${entry.importance || 3}</span><time>${escapeHtml(shortDate(entry.date || entry.createdAt))}</time></header>
                <strong>${escapeHtml(entry.title)}</strong>
                <p>${escapeHtml(entry.content)}</p>
                ${entry.previewOnly ? '' : `<small class="memory-source-label">${renderMemorySource(config, entry)}${entry.expiresAt ? ` · ${Date.parse(entry.expiresAt) <= Date.now() ? '已过期' : `有效至 ${escapeHtml(entry.expiresAt.slice(0, 10))}`}` : ' · 永不过期'}</small>`}
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
          ${timeline.length ? `
            <section class="relationship-timeline">
              <header><strong>最近经历</strong><span>${escapeHtml(character.name)}与你</span></header>
              <ol>${timeline.map(item => `
                <li><i></i><div><time>${escapeHtml(shortDate(item.createdAt))}</time><strong>${escapeHtml(item.title)}</strong>${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}</div></li>
              `).join('')}</ol>
            </section>` : ''}
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
      const candidateId = form.dataset.candidateId;
      const expiryMode = form.elements.expiry.value;
      const expiresAt = expiryMode === 'custom'
        ? (form.elements.expiresAt.value ? new Date(`${form.elements.expiresAt.value}T23:59:59`).toISOString() : '')
        : expiryMode ? new Date(Date.now() + Number(expiryMode) * 86400000).toISOString() : '';
      const entry = normalizeMemoryEntry({
        id: id || makeId('memory'),
        type: form.elements.type.value,
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim(),
        date: entries.find(item => item.id === id)?.date || new Date().toISOString().slice(0, 10),
        characterId: character.id,
        importance: Number(form.elements.importance.value),
        expiresAt,
        sourceRef: entries.find(item => item.id === id)?.sourceRef || null,
        updatedAt: new Date().toISOString()
      }, character.id);
      if (candidateId) {
        handlers.updatePhoneState?.({ memoryCandidateEditingId: null });
        handlers.acceptMemoryCandidate?.(candidateId, entry);
        return;
      }
      const similar = !id ? entries.find(item => memorySimilarity(item, entry) >= 0.65) : null;
      let next;
      if (similar) {
        const choice = globalThis.prompt?.(`发现相似记忆“${similar.title}”。输入 1 保留两条、2 替换旧记忆、3 合并，取消则不保存。`, '3');
        if (!choice) return;
        if (choice === '2') next = entries.map(item => item.id === similar.id ? { ...entry, id: similar.id } : item);
        else if (choice === '3') next = entries.map(item => item.id === similar.id ? mergeMemoryEntries(similar, entry) : item);
        else next = [entry, ...entries];
      } else next = id ? entries.map(item => item.id === id ? entry : item) : [entry, ...entries];
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
    container.querySelectorAll('[data-memory-candidate-accept]').forEach(button => {
      button.addEventListener('click', () => handlers.acceptMemoryCandidate?.(button.dataset.memoryCandidateAccept));
    });
    container.querySelectorAll('[data-memory-candidate-edit]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        memoryCandidateEditingId: button.dataset.memoryCandidateEdit,
        memoryEditingId: null
      }));
    });
    container.querySelectorAll('[data-memory-candidate-dismiss]').forEach(button => {
      button.addEventListener('click', () => handlers.dismissMemoryCandidate?.(button.dataset.memoryCandidateDismiss));
    });
    container.querySelectorAll('[data-memory-source-app]').forEach(button => {
      button.addEventListener('click', () => handlers.openCharacterContext?.(
        button.dataset.memorySourceApp,
        character.id,
        button.dataset.memorySourceId
      ));
    });
  }
};
