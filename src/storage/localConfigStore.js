import { defaultConfig } from '../config/defaultConfig.js?v=app-config-62';
import { normalizeConfig, parseConfigJson } from '../config/schema.js?v=app-config-62';

const DB_NAME = 'lovePhoneStudio';
const DB_VERSION = 1;
const CONFIG_STORE = 'configs';
const BACKUP_STORE = 'backups';
const CURRENT_KEY = 'current';
const LEGACY_CONFIG_KEY = 'lovePhoneStudioConfig';
const LEGACY_KEYS = [
  LEGACY_CONFIG_KEY,
  'lovePhoneStudioLastExportName',
  'lovePhoneStudioAppsFlowMigrated',
  'lovePhoneStudioMusicAppAdded',
  'lovePhoneStudioOfficialMusicBridgeAdded',
  'lovePhoneStudioDoubaoProviderAdded'
];
const BACKUP_INTERVAL_MS = 15 * 60 * 1000;
const MAX_BACKUPS = 10;

let databasePromise = null;
let saveQueue = Promise.resolve();
let lastBackupAt = 0;
let statusListener = null;
let storageStatus = {
  state: 'idle',
  message: '正在准备本地数据库…',
  usedBytes: 0,
  quotaBytes: 0,
  backupCount: 0,
  persisted: false
};

function emitStatus(patch) {
  storageStatus = { ...storageStatus, ...patch };
  statusListener?.({ ...storageStatus });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('数据库事务已取消。'));
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('当前浏览器不支持 IndexedDB。'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CONFIG_STORE)) {
        database.createObjectStore(CONFIG_STORE);
      }
      if (!database.objectStoreNames.contains(BACKUP_STORE)) {
        const backups = database.createObjectStore(BACKUP_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        backups.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error);
    };
    request.onblocked = () => reject(new Error('数据库升级被其他页面阻止，请关闭旧页面后重试。'));
  });
  return databasePromise;
}

async function readCurrentRecord(database) {
  const transaction = database.transaction(CONFIG_STORE, 'readonly');
  const done = transactionDone(transaction);
  const record = await requestResult(transaction.objectStore(CONFIG_STORE).get(CURRENT_KEY));
  await done;
  return record || null;
}

async function readBackups(database) {
  const transaction = database.transaction(BACKUP_STORE, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestResult(transaction.objectStore(BACKUP_STORE).getAll());
  await done;
  return records.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

async function pruneBackups(database) {
  const backups = await readBackups(database);
  const expired = backups.slice(MAX_BACKUPS);
  if (!expired.length) return backups.length;

  const transaction = database.transaction(BACKUP_STORE, 'readwrite');
  const done = transactionDone(transaction);
  expired.forEach(backup => transaction.objectStore(BACKUP_STORE).delete(backup.id));
  await done;
  return backups.length - expired.length;
}

async function insertBackup(database, config, reason) {
  const record = {
    createdAt: new Date().toISOString(),
    reason,
    config
  };
  const transaction = database.transaction(BACKUP_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(BACKUP_STORE).add(record);
  await done;
  lastBackupAt = Date.now();
  return pruneBackups(database);
}

async function writeCurrent(database, config, options = {}) {
  const previous = await readCurrentRecord(database);
  const shouldBackup = options.forceBackup
    || (!options.suppressBackup && Date.now() - lastBackupAt >= BACKUP_INTERVAL_MS);

  let backupCount = storageStatus.backupCount;
  if (shouldBackup) {
    const backupConfig = options.reason === 'manual'
      ? config
      : previous?.config || config;
    backupCount = await insertBackup(database, backupConfig, options.reason || 'automatic');
  }

  const transaction = database.transaction(CONFIG_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(CONFIG_STORE).put({
    config,
    schemaVersion: Number(config.version) || 1,
    updatedAt: new Date().toISOString()
  }, CURRENT_KEY);
  await done;
  return backupCount;
}

function readLegacyConfig() {
  try {
    const text = localStorage.getItem(LEGACY_CONFIG_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function removeLegacyStorage() {
  try {
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    // IndexedDB is already authoritative; unavailable localStorage needs no cleanup.
  }
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function storageErrorMessage(error) {
  if (error?.name === 'QuotaExceededError') {
    return '存储空间不足，保存失败。请先导出备份并删除较大的图片。';
  }
  return error?.message || '本地数据库保存失败，请立即导出 JSON 备份。';
}

async function refreshStorageStatus(config, patch = {}) {
  const backups = await readBackups(await openDatabase());
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const usedBytes = estimate?.usage || byteLength(config);
  const quotaBytes = estimate?.quota || 0;
  const ratio = quotaBytes ? usedBytes / quotaBytes : 0;
  emitStatus({
    state: ratio >= 0.8 ? 'warning' : 'saved',
    message: ratio >= 0.8
      ? '存储空间已使用超过 80%，请导出备份并清理大图片。'
      : '数据已保存到本地数据库。',
    usedBytes,
    quotaBytes,
    backupCount: backups.length,
    persisted: Boolean(persisted),
    ...patch
  });
}

export function getStorageStatusSnapshot() {
  return { ...storageStatus };
}

export function setStorageStatusListener(listener) {
  statusListener = typeof listener === 'function' ? listener : null;
  statusListener?.({ ...storageStatus });
  return () => {
    if (statusListener === listener) statusListener = null;
  };
}

export async function loadConfig() {
  try {
    const database = await openDatabase();
    const stored = await readCurrentRecord(database);
    const legacy = stored ? null : readLegacyConfig();
    const normalized = normalizeConfig(stored?.config || legacy || defaultConfig);
    const backups = await readBackups(database);
    lastBackupAt = backups.length ? Date.parse(backups[0].createdAt) : 0;
    await writeCurrent(database, normalized, {
      forceBackup: Boolean(legacy),
      reason: legacy ? 'localStorage-migration' : 'initial',
      suppressBackup: Boolean(stored)
    });
    if (legacy) removeLegacyStorage();
    await refreshStorageStatus(normalized, {
      message: legacy
        ? '旧版数据已安全迁移到本地数据库。'
        : '已从本地数据库加载。'
    });
    return normalized;
  } catch (error) {
    const fallback = normalizeConfig(readLegacyConfig() || defaultConfig);
    emitStatus({
      state: 'error',
      message: storageErrorMessage(error)
    });
    return fallback;
  }
}

export function saveConfig(config, options = {}) {
  const normalized = normalizeConfig(config);
  emitStatus({ state: 'saving', message: '正在保存…' });

  const operation = async () => {
    try {
      const database = await openDatabase();
      await writeCurrent(database, normalized, options);
      await refreshStorageStatus(normalized);
    } catch (error) {
      emitStatus({
        state: 'error',
        message: storageErrorMessage(error)
      });
    }
  };
  saveQueue = saveQueue.then(operation, operation);
  return normalized;
}

export async function flushConfigSaves() {
  await saveQueue;
  return getStorageStatusSnapshot();
}

export function resetConfig() {
  return saveConfig(normalizeConfig(defaultConfig), {
    forceBackup: true,
    reason: 'before-reset'
  });
}

export async function createConfigBackup(config) {
  await saveQueue;
  const normalized = normalizeConfig(config);
  try {
    const database = await openDatabase();
    await writeCurrent(database, normalized, {
      forceBackup: true,
      reason: 'manual'
    });
    await navigator.storage?.persist?.().catch(() => false);
    await refreshStorageStatus(normalized, {
      message: '已创建本地备份。'
    });
    return getStorageStatusSnapshot();
  } catch (error) {
    emitStatus({ state: 'error', message: storageErrorMessage(error) });
    throw error;
  }
}

export async function restoreLatestConfigBackup() {
  await saveQueue;
  const database = await openDatabase();
  const backups = await readBackups(database);
  if (!backups.length) throw new Error('还没有可以恢复的本地备份。');

  const selected = normalizeConfig(backups[0].config);
  const current = await readCurrentRecord(database);
  if (current?.config) {
    await insertBackup(database, normalizeConfig(current.config), 'before-restore');
  }
  await writeCurrent(database, selected, { suppressBackup: true });
  await refreshStorageStatus(selected, {
    message: `已恢复 ${new Date(backups[0].createdAt).toLocaleString('zh-CN')} 的备份。`
  });
  return selected;
}

export function exportConfig(config) {
  const title = (config.meta?.title || 'lovephone').replace(/[\\/:*?"<>|]/g, '-');
  const filename = `${title || 'lovephone'}-config.json`;
  const blob = new Blob([JSON.stringify(normalizeConfig(config), null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export async function importConfigFromFile(file) {
  const text = await file.text();
  return parseConfigJson(text);
}
