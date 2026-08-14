import { normalizeConfig } from '../config/schema.js';
import { getCustomAppStore } from '../storage/customAppStore.js';

const RUNTIME_JS = 'assets/generated/phone-runtime.js';
const RUNTIME_CSS = 'assets/generated/phone-runtime.css';
const RUNTIME_VENDOR = 'assets/generated/phone-vendor.js';
const ICON_NAMES = [
  'bell', 'camera', 'cat', 'chat', 'clock', 'cloud', 'crown', 'diary', 'dragon', 'empty',
  'fire', 'flower', 'forbid', 'fox', 'ghost', 'globe', 'handshake', 'heart', 'ice', 'letter',
  'moon', 'music', 'people', 'pin', 'relationship', 'sparkle', 'sprout', 'sword', 'tag', 'thought'
];
const MAX_EXPORT_BYTES = 48 * 1024 * 1024;

function safeFileName(value, fallback = 'lovephone') {
  return String(value || fallback).replace(/[\\/:*?"<>|]/g, '-').trim() || fallback;
}

function exportId() {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `phone-${String(random).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`;
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function bytesToBase64(bytes) {
  let text = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(text);
}

function mimeFor(path) {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function fetchBytes(path, fetchImpl) {
  const response = await fetchImpl(new URL(path, globalThis.location.href), { cache: 'no-store' });
  if (!response.ok) throw new Error(`缺少成品运行资源：${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

function removePrivateRuntimeData(config) {
  const copy = structuredClone(config);
  if (copy.apps?.music) copy.apps.music.apiBaseUrl = '';
  if (copy.aiAssistant) {
    copy.aiAssistant.providerId = '';
    copy.aiAssistant.model = '';
    copy.aiAssistant.baseUrl = '';
    copy.aiAssistant.designBrief = { preferences: [], avoid: [], decisions: [], updatedAt: '' };
  }
  return copy;
}

async function loadIconAssets(fetchImpl) {
  const entries = await Promise.all(ICON_NAMES.map(async name => {
    const path = `assets/theme-fantasy/ui-icons/${name}.png`;
    const bytes = await fetchBytes(path, fetchImpl);
    return [name, `data:${mimeFor(path)};base64,${bytesToBase64(bytes)}`];
  }));
  return Object.fromEntries(entries);
}

function buildHtml({ title, id, config, customApps, css, vendor = '', runtime, iconAssets = {} }) {
  const exportApps = customApps.map(app => ({
    id: app.id,
    permissions: app.permissions || [],
    archive: bytesToBase64(app.archive instanceof Uint8Array ? app.archive : new Uint8Array(app.archive))
  }));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#10201a">
  <title>${safeFileName(title, '我的小手机')}</title>
  <style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
  <div id="app"></div>
  <script>
    globalThis.__LOVE_PHONE_RUNTIME_CONFIG__ = Object.freeze({ aiGatewayUrl: '', musicGatewayUrl: '' });
    globalThis.__LOVE_PHONE_EXPORT__ = ${scriptJson({ formatVersion: 1, id, config })};
    globalThis.__LOVE_PHONE_EXPORT_APPS__ = ${scriptJson({ formatVersion: 1, apps: exportApps })};
    globalThis.__LOVE_PHONE_ICON_ASSETS__ = Object.freeze(${scriptJson(iconAssets)});
  </script>
  <script>${vendor.replace(/<\/script/gi, '<\\/script')}</script>
  <script type="module">${runtime.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;
}

export async function createStandalonePhoneHtml(config, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const normalized = removePrivateRuntimeData(normalizeConfig(config));
  const customApps = await getCustomAppStore().exportApps().catch(() => []);
  const [runtime, css, vendor, iconAssets] = await Promise.all([
    fetchBytes(RUNTIME_JS, fetchImpl).then(bytes => new TextDecoder().decode(bytes)),
    fetchBytes(RUNTIME_CSS, fetchImpl).then(bytes => new TextDecoder().decode(bytes)),
    fetchBytes(RUNTIME_VENDOR, fetchImpl).then(bytes => new TextDecoder().decode(bytes)),
    loadIconAssets(fetchImpl)
  ]);
  const html = buildHtml({
    title: normalized.meta?.title,
    id: exportId(),
    config: normalized,
    customApps,
    css,
    vendor,
    runtime,
    iconAssets
  });
  const size = new TextEncoder().encode(html).byteLength;
  if (size > MAX_EXPORT_BYTES) {
    throw new Error(`成品约 ${(size / 1024 / 1024).toFixed(1)} MB，超过单 HTML 的安全下载范围。请先压缩或移除较大的图片与自定义 App。`);
  }
  return {
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    html,
    size,
    filename: `${safeFileName(normalized.meta?.title, 'lovephone')}-小手机.html`
  };
}

export function downloadStandalonePhoneHtml(result) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const standalonePhoneExportForTest = { buildHtml, removePrivateRuntimeData };
