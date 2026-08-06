function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function enabledAppCount(config) {
  const optionalCount = ['memory', 'diary', 'anniversary', 'goodnight']
    .filter(key => config.apps?.[key]?.enabled ?? config.components?.[key])
    .length;
  return optionalCount + 3;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function renderPreviewActions(config, uiState) {
  const installHint = uiState.installAvailable
    ? '当前浏览器支持直接安装。'
    : '当前窗口没有直接安装入口。请在 Chrome、Edge 或 Safari 中打开后，从浏览器菜单安装。';
  const storage = uiState.storageStatus || {};
  const storageUsage = storage.quotaBytes
    ? `${formatBytes(storage.usedBytes)} / ${formatBytes(storage.quotaBytes)}`
    : formatBytes(storage.usedBytes);
  return `
    <section class="panel-section">
      <div class="section-heading">
        <span>第三步</span>
        <h2>确认并收好这台小手机</h2>
        <p>现在已经有功能配置和基础美化。第一版先保存到本地，也可以导出 JSON，后续网页、桌面端或运行时都读取同一份配置。</p>
      </div>
      <div class="save-card">
        <strong>${escapeHtml(config.meta.title || '我的小手机')}</strong>
        <span>${enabledAppCount(config)} 个 App · ${escapeHtml(config.character.name)} · ${escapeHtml(uiState.statusMessage || '修改会自动保存，也可以手动导出。')}</span>
      </div>
      <div class="storage-card storage-${escapeHtml(storage.state || 'idle')}">
        <div>
          <strong>本地数据库</strong>
          <span>${escapeHtml(storage.message || '正在读取存储状态…')}</span>
        </div>
        <dl>
          <div><dt>自动备份</dt><dd>${Number(storage.backupCount) || 0} 份</dd></div>
          <div><dt>空间占用</dt><dd>${escapeHtml(storageUsage)}</dd></div>
          <div><dt>持久存储</dt><dd>${storage.persisted ? '已保护' : '普通'}</dd></div>
        </dl>
      </div>
      <div class="action-grid">
        <button class="primary-action" type="button" data-action="save">保存到本地</button>
        <button type="button" data-action="open-phone">打开我的小手机</button>
        <button type="button" data-action="download-html">下载本地 HTML</button>
        <button type="button" data-action="install">安装到设备</button>
        <button type="button" data-action="backup">立即备份</button>
        <button type="button" data-action="restore-backup"${storage.backupCount ? '' : ' disabled'}>恢复最近备份</button>
        <button type="button" data-action="export">导出 JSON</button>
        <label class="import-button">
          导入 JSON
          <input type="file" accept="application/json,.json" data-action="import" hidden />
        </label>
        <button type="button" data-action="reset">重置</button>
      </div>
      <p class="install-hint">${installHint}</p>
      <div class="flow-actions">
        <button type="button" data-next-step="appearance">上一步</button>
        <button type="button" data-open-phone-app="chat">试打开聊天</button>
      </div>
    </section>
  `;
}

export function bindPreviewActions(root, handlers) {
  root.querySelector('[data-action="save"]')?.addEventListener('click', handlers.save);
  root.querySelector('[data-action="open-phone"]')?.addEventListener('click', handlers.openStandalone);
  root.querySelector('[data-action="download-html"]')?.addEventListener('click', handlers.downloadStandaloneHtml);
  root.querySelector('[data-action="install"]')?.addEventListener('click', handlers.install);
  root.querySelector('[data-action="backup"]')?.addEventListener('click', handlers.backup);
  root.querySelector('[data-action="restore-backup"]')?.addEventListener('click', handlers.restoreBackup);
  root.querySelector('[data-action="export"]')?.addEventListener('click', handlers.exportJson);
  root.querySelector('[data-action="reset"]')?.addEventListener('click', handlers.reset);
  root.querySelector('[data-action="import"]')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) handlers.importJson(file);
    event.target.value = '';
  });
  root.querySelectorAll('[data-open-phone-app]').forEach(button => {
    button.addEventListener('click', () => {
      handlers.openPhoneApp(button.dataset.openPhoneApp);
    });
  });
}
