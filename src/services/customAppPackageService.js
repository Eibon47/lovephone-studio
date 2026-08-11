import { strFromU8, strToU8, unzipSync, zipSync } from '../../assets/vendor/fflate/fflate.js';

export const CUSTOM_APP_FORMAT = 'lovephone-app';
export const CUSTOM_APP_FORMAT_VERSION = 1;
export const CUSTOM_APP_LIMITS = Object.freeze({
  archiveBytes: 16 * 1024 * 1024,
  fileBytes: 6 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  fileCount: 120
});

export const CUSTOM_APP_PERMISSIONS = Object.freeze([
  'storage', 'character.read', 'chat.read', 'memory.read', 'diary.read',
  'media.read', 'notifications', 'network', 'ai.chat', 'system.openApp', 'desktop'
]);

const SAFE_ID = /^[a-zA-Z][a-zA-Z0-9_-]{2,79}$/;
const SAFE_PATH = /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/;
const SAFE_FILE = /^(?:manifest\.json|(?:pages\/)?[a-zA-Z0-9_.-]+\.html|(?:styles\/)?[a-zA-Z0-9_.-]+\.css|(?:scripts\/)?[a-zA-Z0-9_.-]+\.js|assets\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|gif|json|txt))$/i;
const EXTERNAL_RESOURCE = /(?:<script[^>]+\bsrc\s*=\s*["']?(?:https?:)?\/\/|<link[^>]+\bhref\s*=\s*["']?(?:https?:)?\/\/|@import\s+(?:url\()?\s*["']?(?:https?:)?\/\/)/i;

function packageError(message, code = 'INVALID_CUSTOM_APP') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeId(value) {
  const id = String(value || '').trim();
  if (!SAFE_ID.test(id)) throw packageError('App ID 只能使用字母、数字、短横线和下划线，且至少 3 位。', 'INVALID_MANIFEST');
  return id;
}

function safePath(value, label) {
  const path = String(value || '').trim();
  if (!SAFE_PATH.test(path) || path.includes('..') || !SAFE_FILE.test(path)) {
    throw packageError(`${label} 不是允许的包内文件路径。`, 'INVALID_MANIFEST');
  }
  return path;
}

function asStringArray(value, label, normalize) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw packageError(`${label} 必须是数组。`, 'INVALID_MANIFEST');
  return [...new Set(value.map(normalize))];
}

function parseManifest(value, files = {}) {
  const source = value && typeof value === 'object' ? value : {};
  if (source.format !== CUSTOM_APP_FORMAT) throw packageError('这不是 LovePhone 自定义 App 包。');
  if (Number(source.formatVersion) !== CUSTOM_APP_FORMAT_VERSION) {
    throw packageError('这个 App 包版本暂不支持，请升级 LovePhone 后再试。', 'UNSUPPORTED_PACKAGE_VERSION');
  }
  const entry = safePath(source.entry, '入口页');
  const pages = asStringArray(source.pages || [entry], 'pages', item => safePath(item, '页面'));
  if (!pages.includes(entry)) pages.unshift(entry);
  const scripts = asStringArray(source.scripts, 'scripts', item => safePath(item, '脚本'));
  const styles = asStringArray(source.styles, 'styles', item => safePath(item, '样式'));
  const icon = source.icon ? safePath(source.icon, '图标') : '';
  const permissions = asStringArray(source.permissions, 'permissions', item => {
    const permission = String(item || '').trim();
    if (!CUSTOM_APP_PERMISSIONS.includes(permission)) throw packageError(`不支持的权限：${permission}`, 'INVALID_MANIFEST');
    return permission;
  });
  const networkOrigins = asStringArray(source.networkOrigins, 'networkOrigins', item => {
    let url;
    try { url = new URL(String(item || '').trim()); } catch { throw packageError('联网域名不是有效的 HTTPS 地址。', 'INVALID_MANIFEST'); }
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
      throw packageError('联网域名必须是 HTTPS 根地址，例如 https://api.example.com。', 'INVALID_MANIFEST');
    }
    return url.origin;
  });
  if (networkOrigins.length && !permissions.includes('network')) permissions.push('network');
  return {
    format: CUSTOM_APP_FORMAT,
    formatVersion: CUSTOM_APP_FORMAT_VERSION,
    id: safeId(source.id),
    name: String(source.name || source.id || '未命名 App').trim().slice(0, 60) || '未命名 App',
    version: String(source.version || '1.0.0').trim().slice(0, 40) || '1.0.0',
    description: String(source.description || '').trim().slice(0, 240),
    icon, entry, pages, scripts, styles, permissions, networkOrigins
  };
}

function validateFiles(files, archiveBytes) {
  const entries = Object.entries(files);
  if (archiveBytes > CUSTOM_APP_LIMITS.archiveBytes) throw packageError('App 包超过 16 MB 限制。', 'PACKAGE_TOO_LARGE');
  if (entries.length > CUSTOM_APP_LIMITS.fileCount) throw packageError('App 包文件过多。', 'TOO_MANY_FILES');
  let totalBytes = 0;
  for (const [path, bytes] of entries) {
    if (path.includes('..') || path.startsWith('/') || path.includes('\\') || !SAFE_FILE.test(path)) {
      throw packageError(`不允许的文件或路径：${path}`, 'FORBIDDEN_FILE');
    }
    if (bytes.byteLength > CUSTOM_APP_LIMITS.fileBytes) throw packageError(`单个文件过大：${path}`, 'FILE_TOO_LARGE');
    totalBytes += bytes.byteLength;
  }
  if (totalBytes > CUSTOM_APP_LIMITS.totalBytes) throw packageError('解压后的 App 包超过 32 MB 限制。', 'PACKAGE_TOO_LARGE');
  if (!files['manifest.json']) throw packageError('App 包缺少 manifest.json。');
  return totalBytes;
}

function normalizeArchiveFiles(files) {
  const normalized = {};
  Object.entries(files).forEach(([rawPath, bytes]) => {
    const path = rawPath.replace(/\\/g, '/');
    if (normalized[path]) throw packageError(`App 包包含重复文件：${path}`, 'DUPLICATE_FILE');
    normalized[path] = bytes;
  });
  return normalized;
}

function readJson(bytes, label) {
  try { return JSON.parse(strFromU8(bytes)); } catch { throw packageError(`${label} 不是有效 JSON。`, 'INVALID_MANIFEST'); }
}

function checkNoExternalResources(files) {
  Object.entries(files).forEach(([path, bytes]) => {
    if (/\.(?:html|css)$/i.test(path) && EXTERNAL_RESOURCE.test(strFromU8(bytes))) {
      throw packageError(`App 包不能引用外部脚本、样式或素材：${path}`, 'EXTERNAL_RESOURCE');
    }
  });
}

export async function inspectCustomAppPackage(input) {
  let archive;
  if (input instanceof Uint8Array) archive = input;
  else if (input instanceof ArrayBuffer) archive = new Uint8Array(input);
  else if (input instanceof Blob) archive = new Uint8Array(await input.arrayBuffer());
  else throw packageError('请选择一个 .lovephone-app.zip 文件。');
  if (archive.byteLength > CUSTOM_APP_LIMITS.archiveBytes) throw packageError('App 包超过 16 MB 限制。', 'PACKAGE_TOO_LARGE');
  let files;
  try {
    files = unzipSync(archive, {
      filter(entry) {
        const path = entry.name.replace(/\\/g, '/');
        if (path.includes('..') || path.startsWith('/') || !SAFE_FILE.test(path)) {
          throw packageError(`不允许的文件或路径：${entry.name}`, 'FORBIDDEN_FILE');
        }
        return true;
      }
    });
  } catch (error) {
    if (error?.code) throw error;
    throw packageError('无法读取这个 ZIP App 包。');
  }
  files = normalizeArchiveFiles(files);
  const totalBytes = validateFiles(files, archive.byteLength);
  checkNoExternalResources(files);
  const manifest = parseManifest(readJson(files['manifest.json'], 'manifest.json'), files);
  [manifest.entry, ...manifest.pages, ...manifest.scripts, ...manifest.styles, manifest.icon].filter(Boolean).forEach(path => {
    if (!files[path]) throw packageError(`App 包缺少清单中声明的文件：${path}`, 'MISSING_FILE');
  });
  return { archive, files, manifest, summary: { archiveBytes: archive.byteLength, totalBytes, fileCount: Object.keys(files).length, pageCount: manifest.pages.length } };
}

export function appPackageFileName(app) {
  const base = String(app?.manifest?.id || app?.id || 'lovephone-app').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${base}.lovephone-app.zip`;
}

export function downloadCustomAppPackage(archive, filename) {
  const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename || 'lovephone-app.lovephone-app.zip';
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export function createExampleCustomAppPackage() {
  const manifest = {
    format: CUSTOM_APP_FORMAT, formatVersion: CUSTOM_APP_FORMAT_VERSION,
    id: 'hello-companion', name: '小小问候', version: '1.0.0',
    description: '一个可离线运行的 LovePhone 自定义 App 示例。',
    entry: 'app.html', pages: ['app.html'], styles: ['styles/app.css'], scripts: ['scripts/app.js'],
    permissions: ['storage', 'character.read']
  };
  const files = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'app.html': strToU8('<main><p class="eyebrow">自定义 App 示例</p><h1 id="title">你好</h1><p id="count">正在读取本地次数...</p><button id="hello">留下一次问候</button></main>'),
    'styles/app.css': strToU8('body{margin:0;background:#f7f6ee;color:#24352c;font:16px system-ui,sans-serif}main{padding:28px}.eyebrow{color:#7aa98e;font-size:12px}h1{font-size:28px;margin:8px 0}button{border:0;border-radius:8px;background:#7fb59a;color:white;padding:11px 14px;font:inherit}'),
    'scripts/app.js': strToU8("(async()=>{const role=await LovePhone.data.read('character');document.querySelector('#title').textContent=`你好，${role?.name||'朋友'}`;const count=Number(await LovePhone.storage.get('count')||0);const text=document.querySelector('#count');text.textContent=`你已经打开过 ${count} 次。`;document.querySelector('#hello').onclick=async()=>{const next=count+1;await LovePhone.storage.set('count',next);text.textContent=`问候已留下，这是第 ${next} 次。`;};})();")
  };
  return zipSync(files, { level: 6 });
}
