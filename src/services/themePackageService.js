import { strFromU8, strToU8, unzipSync, zipSync } from '../../assets/vendor/fflate/fflate.js';
import { normalizeCustomization, validateCustomCss } from './customizationModel.js';

export const THEME_PACKAGE_FORMAT = 'lovephone-theme';
export const THEME_PACKAGE_VERSION = 1;
export const THEME_PACKAGE_LIMITS = Object.freeze({
  archiveBytes: 12 * 1024 * 1024,
  fileBytes: 5 * 1024 * 1024,
  totalBytes: 24 * 1024 * 1024,
  fileCount: 80
});

const SAFE_ID = /^[a-zA-Z0-9_-]{1,120}$/;
const SAFE_FILE = /^(?:manifest\.json|customization\.json|theme\.css|preview\.(?:png|jpe?g|webp|gif)|assets\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|gif|woff2?))$/i;
const EXTERNAL_URL = /(?:https?:\/\/|\/\/)[^\s"'<>]+/i;

function packageError(message, code = 'INVALID_THEME_PACKAGE') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeId(value, label = 'ID') {
  const id = String(value || '').trim();
  if (!SAFE_ID.test(id)) throw packageError(`${label} is invalid.`);
  return id;
}

function safeText(value, fallback, length) {
  const result = String(value || fallback).trim().slice(0, length);
  return result || fallback;
}

async function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  throw packageError('Theme package must be a ZIP byte array.');
}

function assertNoExternalResources(value, path = 'customization') {
  if (typeof value === 'string') {
    if (EXTERNAL_URL.test(value)) throw packageError(`${path} contains an external network resource.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoExternalResources(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertNoExternalResources(item, `${path}.${key}`));
  }
}

async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

async function fileHashes(files) {
  const entries = await Promise.all(
    Object.entries(files).map(async ([name, bytes]) => [name, await sha256(bytes)])
  );
  return Object.fromEntries(entries);
}

function normalizeManifest(input) {
  const source = input && typeof input === 'object' ? input : {};
  if (source.format !== THEME_PACKAGE_FORMAT) {
    throw packageError('This is not a LovePhone theme package.');
  }
  if (Number(source.formatVersion) !== THEME_PACKAGE_VERSION) {
    throw packageError('This theme package version is not supported.', 'UNSUPPORTED_PACKAGE_VERSION');
  }
  const type = ['phone', 'app', 'widget', 'icon-pack'].includes(source.type)
    ? source.type
    : 'phone';
  return {
    format: THEME_PACKAGE_FORMAT,
    formatVersion: THEME_PACKAGE_VERSION,
    id: safeId(source.id, 'Package ID'),
    name: safeText(source.name, 'Untitled theme', 100),
    author: safeText(source.author, 'Unknown', 80),
    version: safeText(source.version, '1.0.0', 30),
    type,
    targetAppId: type === 'app' ? safeId(source.targetAppId, 'App ID') : '',
    createdAt: safeText(source.createdAt, new Date().toISOString(), 40),
    hashes: source.hashes && typeof source.hashes === 'object' ? source.hashes : {}
  };
}

function validateArchiveEntries(files, archiveLength) {
  const entries = Object.entries(files);
  if (archiveLength > THEME_PACKAGE_LIMITS.archiveBytes) {
    throw packageError('The ZIP file is larger than 12 MB.', 'PACKAGE_TOO_LARGE');
  }
  if (entries.length > THEME_PACKAGE_LIMITS.fileCount) {
    throw packageError('The ZIP contains too many files.', 'TOO_MANY_FILES');
  }
  let totalBytes = 0;
  entries.forEach(([name, bytes]) => {
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || !SAFE_FILE.test(name)) {
      throw packageError(`File type or path is not allowed: ${name}`, 'FORBIDDEN_FILE');
    }
    if (bytes.byteLength > THEME_PACKAGE_LIMITS.fileBytes) {
      throw packageError(`A file is larger than 5 MB: ${name}`, 'FILE_TOO_LARGE');
    }
    totalBytes += bytes.byteLength;
  });
  if (totalBytes > THEME_PACKAGE_LIMITS.totalBytes) {
    throw packageError('The uncompressed package is larger than 24 MB.', 'PACKAGE_TOO_LARGE');
  }
  if (!files['manifest.json'] || !files['customization.json']) {
    throw packageError('The package is missing manifest.json or customization.json.');
  }
  return totalBytes;
}

function parseJsonFile(bytes, label) {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw packageError(`${label} is not valid JSON.`);
  }
}

export async function createThemePackage(input = {}) {
  assertNoExternalResources(input.customization);
  const customization = normalizeCustomization(input.customization);
  const cssResult = validateCustomCss(input.css);
  if (!cssResult.valid) throw packageError(cssResult.errors[0]);

  const files = {
    'customization.json': strToU8(JSON.stringify(customization, null, 2))
  };
  if (cssResult.css) files['theme.css'] = strToU8(cssResult.css);
  const assets = Array.isArray(input.assets) ? input.assets : [];
  assets.slice(0, THEME_PACKAGE_LIMITS.fileCount - 3).forEach(asset => {
    const name = `assets/${String(asset.name || '').trim()}`;
    if (!SAFE_FILE.test(name)) throw packageError(`Asset type is not allowed: ${name}`, 'FORBIDDEN_FILE');
    files[name] = asset.data instanceof Uint8Array ? asset.data : new Uint8Array(asset.data || []);
  });

  const hashes = await fileHashes(files);
  const manifest = normalizeManifest({
    format: THEME_PACKAGE_FORMAT,
    formatVersion: THEME_PACKAGE_VERSION,
    id: input.id,
    name: input.name,
    author: input.author,
    version: input.version,
    type: input.type,
    targetAppId: input.targetAppId,
    createdAt: new Date().toISOString(),
    hashes
  });
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  const archive = zipSync(files, { level: 6 });
  validateArchiveEntries(files, archive.byteLength);
  return archive;
}

export async function inspectThemePackage(input) {
  const archive = await asBytes(input);
  if (archive.byteLength > THEME_PACKAGE_LIMITS.archiveBytes) {
    throw packageError('The ZIP file is larger than 12 MB.', 'PACKAGE_TOO_LARGE');
  }
  let files;
  let entryCount = 0;
  let declaredTotalBytes = 0;
  try {
    files = unzipSync(archive, {
      filter(entry) {
        entryCount += 1;
        declaredTotalBytes += Number(entry.originalSize) || 0;
        if (entryCount > THEME_PACKAGE_LIMITS.fileCount) {
          throw packageError('The ZIP contains too many files.', 'TOO_MANY_FILES');
        }
        if ((Number(entry.originalSize) || 0) > THEME_PACKAGE_LIMITS.fileBytes) {
          throw packageError(`A file is larger than 5 MB: ${entry.name}`, 'FILE_TOO_LARGE');
        }
        if (declaredTotalBytes > THEME_PACKAGE_LIMITS.totalBytes) {
          throw packageError('The uncompressed package is larger than 24 MB.', 'PACKAGE_TOO_LARGE');
        }
        if (
          entry.name.includes('..')
          || entry.name.startsWith('/')
          || entry.name.includes('\\')
          || !SAFE_FILE.test(entry.name)
        ) {
          throw packageError(`File type or path is not allowed: ${entry.name}`, 'FORBIDDEN_FILE');
        }
        return true;
      }
    });
  } catch (error) {
    if (error?.code) throw error;
    throw packageError('The selected file is not a readable ZIP package.');
  }
  const totalBytes = validateArchiveEntries(files, archive.byteLength);
  const manifest = normalizeManifest(parseJsonFile(files['manifest.json'], 'manifest.json'));
  const customizationSource = parseJsonFile(files['customization.json'], 'customization.json');
  assertNoExternalResources(customizationSource);
  const customization = normalizeCustomization(customizationSource);
  const cssResult = validateCustomCss(files['theme.css'] ? strFromU8(files['theme.css']) : '');
  if (!cssResult.valid) throw packageError(cssResult.errors[0]);

  const hashedFiles = Object.fromEntries(
    Object.entries(files).filter(([name]) => name !== 'manifest.json')
  );
  const hashes = await fileHashes(hashedFiles);
  for (const [name, hash] of Object.entries(hashes)) {
    if (manifest.hashes[name] !== hash) {
      throw packageError(`File verification failed: ${name}`, 'HASH_MISMATCH');
    }
  }
  if (Object.keys(manifest.hashes).length !== Object.keys(hashes).length) {
    throw packageError('The package file list does not match its manifest.', 'HASH_MISMATCH');
  }

  const assets = Object.entries(files)
    .filter(([name]) => name.startsWith('assets/'))
    .map(([name, data]) => ({
      id: name.slice(7).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120),
      name: name.slice(7),
      data,
      sizeBytes: data.byteLength
    }));
  return {
    manifest,
    customization,
    css: cssResult.css,
    assets,
    summary: {
      fileCount: Object.keys(files).length,
      totalBytes,
      archiveBytes: archive.byteLength,
      externalResources: false
    }
  };
}

export function downloadThemePackage(bytes, filename = 'lovephone-theme.lptheme.zip') {
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
