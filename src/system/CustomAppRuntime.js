import { strFromU8, unzipSync } from '../../assets/vendor/fflate/fflate.js';
import { escapeHtml } from './html.js';

const MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', json: 'application/json', txt: 'text/plain' };

function dataUrl(path, bytes) {
  const ext = String(path).split('.').pop().toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  let binary = '';
  bytes.forEach(value => { binary += String.fromCharCode(value); });
  return `data:${mime};base64,${btoa(binary)}`;
}

let activeCleanup = null;

function archiveFiles(record) {
  try { return unzipSync(record.archive instanceof Uint8Array ? record.archive : new Uint8Array(record.archive)); } catch { return null; }
}

function documentFor(record, pagePath = '') {
  const files = archiveFiles(record);
  const manifest = record.manifest || {};
  const activePage = manifest.pages?.includes(pagePath) ? pagePath : manifest.entry;
  const page = files?.[activePage];
  if (!files || !page) return { error: '这个 App 的安装包已损坏，请重新导入。' };
  const assets = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith('assets/')).map(([path, bytes]) => [path, dataUrl(path, bytes)]));
  const replaceAssets = text => Object.entries(assets).reduce((output, [path, url]) => output.split(path).join(url), text);
  const html = replaceAssets(strFromU8(page));
  const styles = (manifest.styles || []).map(path => files[path] ? replaceAssets(strFromU8(files[path])) : '').join('\n');
  const scripts = (manifest.scripts || []).map(path => files[path] ? strFromU8(files[path]) : '').join('\n;\n');
  const payload = JSON.stringify({ id: record.id, name: record.name, manifest: { id: manifest.id, name: manifest.name, version: manifest.version }, assets }).replace(/</g, '\\u003c');
  const bridge = `
    const __lpReady = new Promise(resolve => window.addEventListener('message', event => { if (event.data?.type === 'lovephone-app-host-ready') resolve(); }, { once: true }));
    const __lpRequest = async (method, args = {}) => { await __lpReady; return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
      const listener = event => { const data = event.data || {}; if (data.type !== 'lovephone-app-response' || data.requestId !== requestId) return; window.removeEventListener('message', listener); data.ok ? resolve(data.value) : reject(new Error(data.error || '系统能力调用失败。')); };
      window.addEventListener('message', listener);
      parent.postMessage({ type: 'lovephone-app-request', requestId, method, args }, '*');
    }); };
    globalThis.LovePhone = Object.freeze({
      info: ${payload},
      storage: { get: key => __lpRequest('storage.get', { key }), set: (key, value) => __lpRequest('storage.set', { key, value }), delete: key => __lpRequest('storage.delete', { key }) },
      data: { read: scope => __lpRequest('data.read', { scope }) },
      ai: { chat: (message, options = {}) => __lpRequest('ai.chat', { message, ...options }) },
      network: { fetch: (url, options = {}) => __lpRequest('network.fetch', { url, options }) },
      notification: message => __lpRequest('notification', { message }),
      openApp: id => __lpRequest('system.openApp', { id }),
      navigate: page => __lpRequest('navigate', { page }),
      desktop: { openHome: () => __lpRequest('desktop.home', {}) },
      asset: path => (${payload}).assets[path] || ''
    });`;
  const csp = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; font-src data:; media-src data: blob:";
  return { srcdoc: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${styles}</style></head><body>${html}<script>${bridge}</script><script>${scripts}</script></body></html>` };
}

export function customAppIcon(record) {
  if (record?.iconOverride && /^data:image\//i.test(record.iconOverride)) return record.iconOverride;
  const icon = record?.manifest?.icon;
  const bytes = icon ? archiveFiles(record)?.[icon] : null;
  return bytes ? dataUrl(icon, bytes) : '';
}

export const CustomAppRuntime = {
  render(app, config, osState) {
    const record = (osState.customApps || []).find(item => item.id === app.customAppId);
    if (!record) return `<section class="phone-screen custom-app-screen"><header class="app-top"><button type="button" data-go-home aria-label="返回">‹</button><strong>自定义 App</strong></header><p class="custom-app-error">找不到这个 App，请在设置中检查它是否仍然安装。</p></section>`;
    const result = documentFor(record, osState.customAppPages?.[record.id]);
    return `<section class="phone-screen custom-app-screen"><header class="app-top"><button type="button" data-go-home aria-label="返回桌面">‹</button><strong>${escapeHtml(record.name)}</strong><span></span></header>${result.error ? `<p class="custom-app-error">${escapeHtml(result.error)}</p>` : `<iframe class="custom-app-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" data-custom-app-id="${escapeHtml(record.id)}" srcdoc="${escapeHtml(result.srcdoc)}"></iframe>`}</section>`;
  },
  bind(container, config, handlers, osState) {
    container.querySelector('[data-go-home]')?.addEventListener('click', () => handlers.openApp?.('home'));
    const frame = container.querySelector('[data-custom-app-id]');
    if (activeCleanup) activeCleanup();
    if (frame) {
      const appId = frame.dataset.customAppId;
      const listener = async message => {
        if (message.source !== frame.contentWindow || message.data?.type !== 'lovephone-app-request') return;
        const { requestId, method, args } = message.data;
        try {
          const value = await handlers.customAppRequest?.(appId, method, args || {});
          frame.contentWindow.postMessage({ type: 'lovephone-app-response', requestId, ok: true, value }, '*');
        } catch (error) {
          frame.contentWindow.postMessage({ type: 'lovephone-app-response', requestId, ok: false, error: error.message || '系统能力调用失败。' }, '*');
        }
      };
      window.addEventListener('message', listener);
      activeCleanup = () => window.removeEventListener('message', listener);
      const ready = () => frame.contentWindow?.postMessage({ type: 'lovephone-app-host-ready' }, '*');
      frame.addEventListener('load', ready, { once: true });
      ready();
    }
  }
};
