const exportedPhoneId = String(globalThis.__LOVE_PHONE_EXPORT__?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
const DB_NAME = exportedPhoneId ? `lovePhoneCustomApps-${exportedPhoneId}` : 'lovePhoneCustomApps';
const DB_VERSION = 1;
const APPS = 'apps';
const DATA = 'data';
const SAFE_ID = /^[a-zA-Z][a-zA-Z0-9_-]{2,79}$/;

function appId(value) {
  const id = String(value || '').trim();
  if (!SAFE_ID.test(id)) throw new Error('无效的自定义 App ID。');
  return id;
}
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function requestResult(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function done(transaction) { return new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error('存储操作失败。')); }); }

export function createIndexedDbCustomAppAdapter(indexedDb = globalThis.indexedDB) {
  let databasePromise;
  const open = () => {
    if (!indexedDb) return Promise.reject(new Error('当前浏览器不支持 IndexedDB。'));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(APPS)) db.createObjectStore(APPS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { databasePromise = null; reject(request.error); };
    });
    return databasePromise;
  };
  const run = async (storeName, mode, operation) => { const db = await open(); const transaction = db.transaction(storeName, mode); const completion = done(transaction); const result = await operation(transaction.objectStore(storeName)); await completion; return result; };
  return { get: (store, id) => run(store, 'readonly', value => requestResult(value.get(id))), getAll: store => run(store, 'readonly', value => requestResult(value.getAll())), put: (store, record) => run(store, 'readwrite', value => requestResult(value.put(record))), delete: (store, id) => run(store, 'readwrite', value => requestResult(value.delete(id))) };
}

export function createMemoryCustomAppAdapter() {
  const stores = { [APPS]: new Map(), [DATA]: new Map() };
  return { async get(store, id) { return stores[store].get(id); }, async getAll(store) { return [...stores[store].values()]; }, async put(store, record) { stores[store].set(record.id, record); return record.id; }, async delete(store, id) { stores[store].delete(id); } };
}

export function createCustomAppStore({ adapter = createIndexedDbCustomAppAdapter(), now = () => new Date().toISOString() } = {}) {
  const listApps = async () => (await adapter.getAll(APPS)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
  const getApp = id => adapter.get(APPS, appId(id));
  async function install(packageInfo, { replace = false, permissions } = {}) {
    const manifest = packageInfo?.manifest;
    const id = appId(manifest?.id);
    const existing = await getApp(id);
    if (existing && !replace) { const error = new Error('已安装同 ID 的 App。'); error.code = 'DUPLICATE_APP'; throw error; }
    const timestamp = now();
    const record = {
      id, manifest: clone(manifest), archive: packageInfo.archive instanceof Uint8Array ? packageInfo.archive : new Uint8Array(packageInfo.archive),
      name: existing?.name || manifest.name, iconOverride: existing?.iconOverride || '', enabled: existing?.enabled !== false,
      permissions: Array.isArray(permissions) ? [...permissions] : (existing?.permissions || [...manifest.permissions]),
      createdAt: existing?.createdAt || timestamp, updatedAt: timestamp, sizeBytes: packageInfo.summary?.archiveBytes || packageInfo.archive?.byteLength || 0
    };
    await adapter.put(APPS, record); return record;
  }
  async function update(id, patch) { const record = await getApp(id); if (!record) throw new Error('找不到这个自定义 App。'); const next = { ...record, ...patch, id: record.id, updatedAt: now() }; await adapter.put(APPS, next); return next; }
  async function remove(id) { const normalized = appId(id); const records = await adapter.getAll(DATA); await Promise.all(records.filter(row => row.appId === normalized).map(row => adapter.delete(DATA, row.id))); await adapter.delete(APPS, normalized); }
  const dataKey = (id, key) => `${appId(id)}--${String(key || '').trim().slice(0, 120)}`;
  async function getData(id, key) { return (await adapter.get(DATA, dataKey(id, key)))?.value; }
  async function setData(id, key, value) { const normalized = appId(id); const json = clone(value); await adapter.put(DATA, { id: dataKey(normalized, key), appId: normalized, key: String(key || '').trim().slice(0, 120), value: json, updatedAt: now() }); return json; }
  async function deleteData(id, key) { await adapter.delete(DATA, dataKey(id, key)); }
  async function getUsage(id) { const app = await getApp(id); const data = (await adapter.getAll(DATA)).filter(row => row.appId === appId(id)); const bytes = value => new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength; return { appBytes: app?.sizeBytes || 0, dataBytes: data.reduce((sum, row) => sum + bytes(row.value), 0), dataCount: data.length }; }
  return { listApps, getApp, install, update, remove, getData, setData, deleteData, getUsage, exportApps: listApps };
}

let defaultStore;
export function getCustomAppStore() { if (!defaultStore) defaultStore = createCustomAppStore(); return defaultStore; }
