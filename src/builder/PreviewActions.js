function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function enabledAppCount(config, customApps = []) {
  return Object.values(config.apps || {}).filter(app => app?.enabled).length
    + customApps.filter(app => app.enabled !== false).length;
}

export function renderPreviewActions(config, uiState = {}) {
  const characters = [config.character, ...(config.characters || [])].filter(character => character?.name);
  const aiConnected = Object.values(config.aiProviders?.profiles || {}).some(profile => profile?.model)
    || characters.some(character => Object.values(character.aiProfiles || {}).some(profile => profile?.model));
  const exportState = uiState.exportState || {};
  const isGenerating = exportState.status === 'generating';

  return `
    <section class="panel-section completion-panel">
      <div class="section-heading">
        <span>第三步</span>
        <h2>完成并下载</h2>
        <p>最后检查一次。下载后会得到一个可直接双击打开的 HTML 小手机。</p>
      </div>
      <div class="save-card completion-card">
        <strong>${escapeHtml(config.meta.title || '我的小手机')}</strong>
        <span>已经准备好，可以先全屏体验，再下载到电脑。</span>
      </div>
      <div class="completion-checklist" aria-label="完成检查">
        <div><span>已启用 App</span><strong>${enabledAppCount(config, uiState.customApps || [])} 个</strong></div>
        <div><span>角色</span><strong>${characters.length ? `已创建 ${characters.length} 个` : '尚未创建'}</strong></div>
        <div><span>AI</span><strong>${aiConnected ? '已选择模型' : '可稍后在设置中连接'}</strong></div>
        <div><span>保存状态</span><strong>${uiState.storageStatus?.state === 'error' ? '自动保存失败' : '修改已自动保存'}</strong></div>
      </div>
      <div class="completion-actions">
        <button class="primary-action" type="button" data-action="download-html" ${isGenerating ? 'disabled' : ''}>
          ${isGenerating ? '正在生成…' : '下载我的小手机'}
        </button>
        <button type="button" data-action="open-phone">全屏体验</button>
      </div>
      ${exportState.message ? `<div class="export-result is-${escapeHtml(exportState.status || 'idle')}">${escapeHtml(exportState.message)}</div>` : ''}
      <p class="install-hint">下载文件不会包含 API Key、登录凭证、私人网关或本地音频。在线能力可在成品小手机的设置 App 中自行连接。</p>
      <div class="flow-actions sticky-flow-actions">
        <button type="button" data-next-step="appearance">上一步</button>
      </div>
    </section>
  `;
}

export function bindPreviewActions(root, handlers) {
  root.querySelector('[data-action="open-phone"]')?.addEventListener('click', handlers.openStandalone);
  root.querySelector('[data-action="download-html"]')?.addEventListener('click', handlers.downloadStandaloneHtml);
}
