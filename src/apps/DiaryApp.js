import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import { activeCharacter, localDateKey, makeId, shortDate } from './appData.js?v=app-config-40';
import {
  diaryProviderId,
  generateDiarySummary
} from '../services/diarySummaryService.js?v=app-config-45';
import { friendlyAiError } from '../services/aiErrors.js?v=app-config-36';
import {
  removeItemWithUndo,
  restoreItemFromUndo
} from '../services/listUndo.js?v=app-config-44';

const moods = [
  { id: 'great', icon: '☀', label: '很好', score: 90 },
  { id: 'good', icon: '◐', label: '还不错', score: 72 },
  { id: 'calm', icon: '○', label: '平静', score: 58 },
  { id: 'tired', icon: '☁', label: '有点累', score: 38 },
  { id: 'sad', icon: '〰', label: '低落', score: 22 }
];

function characterComment(character, mood) {
  if (mood === 'sad' || mood === 'tired') return `${character.name}：今天先到这里也没关系，我会陪着你。`;
  return `${character.name}：谢谢你把今天交给我保存。`;
}

function renderForm(entry = {}, moodTags = true) {
  return `
    <form class="companion-editor diary-editor" data-diary-form data-entry-id="${escapeHtml(entry.id || '')}">
      <div class="editor-title-row"><strong>${entry.id ? '编辑这一天' : '记录今天'}</strong>${entry.id ? '<button type="button" data-diary-cancel>取消</button>' : ''}</div>
      <input type="date" name="date" value="${escapeHtml(entry.date || localDateKey())}" required />
      ${moodTags ? `<div class="mood-picker">
        ${moods.map(mood => `
          <label title="${mood.label}">
            <input type="radio" name="mood" value="${mood.id}" ${(entry.mood || 'good') === mood.id ? 'checked' : ''} />
            <span>${mood.icon}<small>${mood.label}</small></span>
          </label>`).join('')}
      </div>` : ''}
      <input name="title" value="${escapeHtml(entry.title || '')}" maxlength="30" placeholder="今天的标题" required />
      <textarea name="content" rows="4" maxlength="600" placeholder="今天发生了什么？" required>${escapeHtml(entry.content || '')}</textarea>
      <button class="companion-primary-button" type="submit">${entry.id ? '保存修改' : '保存今天'}</button>
    </form>`;
}

function renderSummary(entry, aiSummaryEnabled, generatingId) {
  const generating = generatingId === entry.id;
  if (!entry.aiSummary && !aiSummaryEnabled && !generating) return '';
  return `
    <section class="diary-ai-summary ${generating ? 'is-generating' : ''}">
      <header>
        <strong>AI 小结</strong>
        ${aiSummaryEnabled && !generating ? `
          <button type="button" data-diary-summary="${escapeHtml(entry.id)}">
            ${entry.aiSummary ? '重新总结' : '生成总结'}
          </button>
        ` : ''}
      </header>
      <p>${generating ? '正在整理这一天…' : escapeHtml(entry.aiSummary || '还没有生成总结。')}</p>
    </section>
  `;
}

async function summarizeEntry(config, handlers, osState, entry, character) {
  const latestConfig = handlers.getConfig?.() || config;
  if (!latestConfig.apps?.diary?.aiSummary) return;

  osState.diarySummaryId = entry.id;
  osState.diaryStatus = `正在使用 ${diaryProviderId(latestConfig, character) || '当前模型'} 总结…`;
  handlers.updatePhoneState?.({
    diarySummaryId: entry.id,
    diaryStatus: osState.diaryStatus
  });

  try {
    const mood = moods.find(item => item.id === entry.mood) || moods[1];
    const summary = await generateDiarySummary(latestConfig, {
      character,
      date: entry.date,
      moodLabel: mood.label,
      title: entry.title,
      content: entry.content
    });
    const currentConfig = handlers.getConfig?.() || latestConfig;
    const entries = Array.isArray(currentConfig.apps?.diary?.entries)
      ? currentConfig.apps.diary.entries
      : [];
    const currentEntry = entries.find(item => item.id === entry.id);
    if (!currentEntry || currentEntry.content !== entry.content || currentEntry.title !== entry.title) {
      handlers.updatePhoneState?.({
        diarySummaryId: null,
        diaryStatus: currentEntry ? '日记已修改，请重新生成总结。' : ''
      });
      return;
    }
    const next = entries.map(item => item.id === entry.id
      ? {
          ...item,
          aiSummary: summary,
          aiSummaryAt: new Date().toISOString(),
          aiSummaryProviderId: diaryProviderId(currentConfig, character)
        }
      : item);
    handlers.updatePhoneState?.({
      diarySummaryId: null,
      diaryStatus: 'AI 小结已生成。'
    });
    handlers.updatePath?.('apps.diary.entries', next, { keepPhone: true });
  } catch (error) {
    handlers.updatePhoneState?.({
      diarySummaryId: null,
      diaryStatus: `总结失败：${friendlyAiError(error)}`
    });
  }
}

export const DiaryApp = {
  render(app, config, osState = {}) {
    const character = activeCharacter(config, osState);
    const allEntries = Array.isArray(config.apps.diary.entries) ? config.apps.diary.entries : [];
    const entries = allEntries.filter(entry => (
      (entry.characterId || config.character.id) === character.id
    ));
    const editing = entries.find(item => item.id === osState.diaryEditingId);
    return `
      <section class="phone-screen companion-data-app phone-diary-app">
        ${renderStatusBar('chat-statusbar')}
        <header class="app-top">
          <button class="chat-back" type="button" data-go-home aria-label="返回桌面">‹</button>
          <h3>${escapeHtml(app.name)}</h3>
          <span class="app-count">${entries.length}篇</span>
        </header>
        <div class="companion-app-content">
          ${renderForm(editing, config.apps.diary.moodTags)}
          ${osState.diaryStatus ? `<p class="diary-ai-status">${escapeHtml(osState.diaryStatus)}</p>` : ''}
          ${osState.diaryUndo?.item ? `
            <div class="companion-undo">
              <span>已删除“${escapeHtml(osState.diaryUndo.item.title)}”</span>
              <button type="button" data-diary-undo>撤销</button>
            </div>
          ` : ''}
          <div class="diary-timeline">
            ${entries.length ? entries.map(entry => {
              const mood = moods.find(item => item.id === entry.mood) || moods[1];
              const confirming = osState.diaryDeleteConfirmId === entry.id;
              return `
                <article class="diary-entry">
                  <time>${escapeHtml(shortDate(entry.date))}</time>
                  <div>
                    <header><span>${mood.icon}</span><strong>${escapeHtml(entry.title)}</strong></header>
                    <p>${escapeHtml(entry.content)}</p>
                    ${renderSummary(entry, config.apps.diary.aiSummary, osState.diarySummaryId)}
                    ${entry.comment ? `<blockquote>${escapeHtml(entry.comment)}</blockquote>` : ''}
                    ${confirming ? `
                      <div class="inline-delete-confirm">
                        <p>确定删除这篇日记吗？删除后仍可立即撤销。</p>
                        <button type="button" data-diary-delete-cancel>取消</button>
                        <button type="button" data-diary-delete-confirm="${escapeHtml(entry.id)}">确认删除</button>
                      </div>
                    ` : `
                      <footer><button type="button" data-diary-edit="${escapeHtml(entry.id)}">编辑</button><button type="button" data-diary-delete="${escapeHtml(entry.id)}">删除</button></footer>
                    `}
                  </div>
                </article>`;
            }).join('') : `<div class="companion-empty"><i>□</i><strong>日子还没落笔</strong><p>写下第一篇，心情小组件也会跟着变化。</p></div>`}
          </div>
        </div>
      </section>`;
  },

  bind(container, config, handlers, osState = {}) {
    const character = activeCharacter(config, osState);
    const allEntries = Array.isArray(config.apps.diary.entries) ? config.apps.diary.entries : [];
    const entries = allEntries.filter(entry => (
      (entry.characterId || config.character.id) === character.id
    ));
    const mergeEntries = roleEntries => [
      ...allEntries.filter(entry => (entry.characterId || config.character.id) !== character.id),
      ...roleEntries
    ];
    container.querySelector('[data-diary-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const id = form.dataset.entryId;
      const mood = form.elements.mood?.value || 'calm';
      const existing = id ? entries.find(item => item.id === id) : null;
      const entry = {
        ...existing,
        id: id || makeId('diary'),
        date: form.elements.date.value,
        mood,
        moodScore: moods.find(item => item.id === mood)?.score || 50,
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim(),
        comment: config.apps.diary.characterComment ? characterComment(character, mood) : '',
        characterId: character.id
      };
      const diaryChanged = !existing
        || existing.title !== entry.title
        || existing.content !== entry.content
        || existing.mood !== entry.mood
        || existing.date !== entry.date;
      if (diaryChanged) {
        delete entry.aiSummary;
        delete entry.aiSummaryAt;
        delete entry.aiSummaryProviderId;
      }
      const next = id ? entries.map(item => item.id === id ? entry : item) : [entry, ...entries];
      handlers.updatePhoneState?.({
        diaryEditingId: null,
        diaryStatus: config.apps.diary.aiSummary && diaryChanged ? '日记已保存，准备生成 AI 小结…' : '日记已保存。'
      });
      handlers.updatePath?.('apps.diary.entries', mergeEntries(next), { keepPhone: true });
      if (config.apps.diary.aiSummary && diaryChanged) {
        void summarizeEntry(config, handlers, osState, entry, character);
      }
    });
    container.querySelector('[data-diary-cancel]')?.addEventListener('click', () => handlers.updatePhoneState?.({ diaryEditingId: null }));
    container.querySelectorAll('[data-diary-edit]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        diaryEditingId: button.dataset.diaryEdit,
        diaryDeleteConfirmId: null
      }));
    });
    container.querySelectorAll('[data-diary-delete]').forEach(button => {
      button.addEventListener('click', () => handlers.updatePhoneState?.({
        diaryDeleteConfirmId: button.dataset.diaryDelete
      }));
    });
    container.querySelector('[data-diary-delete-cancel]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ diaryDeleteConfirmId: null });
    });
    container.querySelector('[data-diary-delete-confirm]')?.addEventListener('click', event => {
      const result = removeItemWithUndo(entries, event.currentTarget.dataset.diaryDeleteConfirm);
      if (!result.undo) return;
      handlers.updatePhoneState?.({
        diaryDeleteConfirmId: null,
        diaryEditingId: null,
        diaryUndo: result.undo
      });
      handlers.updatePath?.('apps.diary.entries', mergeEntries(result.next), { keepPhone: true });
    });
    container.querySelector('[data-diary-undo]')?.addEventListener('click', () => {
      const latest = handlers.getConfig?.() || config;
      const current = Array.isArray(latest.apps.diary.entries) ? latest.apps.diary.entries : [];
      const roleEntries = current.filter(entry => (
        (entry.characterId || latest.character.id) === character.id
      ));
      const otherEntries = current.filter(entry => (
        (entry.characterId || latest.character.id) !== character.id
      ));
      handlers.updatePhoneState?.({ diaryUndo: null });
      handlers.updatePath?.(
        'apps.diary.entries',
        [...otherEntries, ...restoreItemFromUndo(roleEntries, osState.diaryUndo)],
        { keepPhone: true }
      );
    });
    container.querySelectorAll('[data-diary-summary]').forEach(button => {
      button.addEventListener('click', () => {
        const latestConfig = handlers.getConfig?.() || config;
        const entry = latestConfig.apps?.diary?.entries?.find(item => item.id === button.dataset.diarySummary);
        if (!entry || osState.diarySummaryId) return;
        void summarizeEntry(
          latestConfig,
          handlers,
          osState,
          entry,
          activeCharacter(latestConfig, osState)
        );
      });
    });
  }
};
