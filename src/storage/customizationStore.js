const exportedPhoneId = String(globalThis.__LOVE_PHONE_EXPORT__?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
const DB_NAME = exportedPhoneId ? `lovePhoneCustomizations-${exportedPhoneId}` : 'lovePhoneCustomizations';
const DB_VERSION = 1;
const PACKAGE_STORE = 'packages';
const ASSET_STORE = 'assets';
const SAFE_ID = /^[a-zA-Z0-9_-]{1,120}$/;

function assertId(value, label = 'ID') {
  const id = String(value || '').trim();
  if (!SAFE_ID.test(id)) throw new Error(`${label} is invalid.`);
  return id;
}

function byteLength(value) {
  if (value instanceof Uint8Array) return value.byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (value instanceof Blob) return value.size;
  return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
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
    transaction.onabort = () => reject(transaction.error || new Error('Storage transaction aborted.'));
  });
}

export function createIndexedDbCustomizationAdapter(indexedDb = globalThis.indexedDB) {
  let databasePromise;

  function openDatabase() {
    if (!indexedDb) return Promise.reject(new Error('IndexedDB is unavailable.'));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PACKAGE_STORE)) {
          database.createObjectStore(PACKAGE_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(ASSET_STORE)) {
          const assets = database.createObjectStore(ASSET_STORE, { keyPath: 'id' });
          assets.createIndex('packageId', 'packageId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        reject(request.error);
      };
    });
    return databasePromise;
  }

  async function operation(storeName, mode, run) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, mode);
    const done = transactionDone(transaction);
    const result = await run(transaction.objectStore(storeName));
    await done;
    return result;
  }

  return {
    get: (storeName, id) => operation(storeName, 'readonly', store => requestResult(store.get(id))),
    getAll: storeName => operation(storeName, 'readonly', store => requestResult(store.getAll())),
    put: (storeName, record) => operation(storeName, 'readwrite', store => requestResult(store.put(record))),
    delete: (storeName, id) => operation(storeName, 'readwrite', store => requestResult(store.delete(id)))
  };
}

export function createMemoryCustomizationAdapter() {
  const stores = {
    [PACKAGE_STORE]: new Map(),
    [ASSET_STORE]: new Map()
  };
  return {
    async get(storeName, id) {
      return stores[storeName].get(id);
    },
    async getAll(storeName) {
      return [...stores[storeName].values()];
    },
    async put(storeName, record) {
      stores[storeName].set(record.id, record);
      return record.id;
    },
    async delete(storeName, id) {
      stores[storeName].delete(id);
    }
  };
}

export function createCustomizationStore({
  adapter = createIndexedDbCustomizationAdapter(),
  now = () => new Date().toISOString()
} = {}) {
  async function listPackages() {
    const records = await adapter.getAll(PACKAGE_STORE);
    return records.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  async function savePackage(input, options = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const id = assertId(source.id, 'Package ID');
    const existing = await adapter.get(PACKAGE_STORE, id);
    if (existing && !options.replace) {
      const error = new Error('A package with this ID already exists.');
      error.code = 'DUPLICATE_PACKAGE';
      throw error;
    }
    const timestamp = now();
    const record = {
      id,
      name: String(source.name || id).trim().slice(0, 100),
      type: ['phone', 'app', 'widget', 'icon-pack'].includes(source.type) ? source.type : 'phone',
      version: String(source.version || '1.0.0').trim().slice(0, 30),
      targetAppId: source.targetAppId ? assertId(source.targetAppId, 'App ID') : '',
      manifest: source.manifest && typeof source.manifest === 'object' ? source.manifest : {},
      customization: source.customization && typeof source.customization === 'object'
        ? source.customization
        : {},
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      sizeBytes: byteLength(source.manifest) + byteLength(source.customization)
    };
    await adapter.put(PACKAGE_STORE, record);
    return record;
  }

  async function saveAsset(packageIdValue, input, options = {}) {
    const packageId = assertId(packageIdValue, 'Package ID');
    const source = input && typeof input === 'object' ? input : {};
    const localId = assertId(source.id, 'Asset ID');
    const id = `${packageId}--${localId}`;
    const existing = await adapter.get(ASSET_STORE, id);
    if (existing && !options.replace) {
      const error = new Error('An asset with this ID already exists.');
      error.code = 'DUPLICATE_ASSET';
      throw error;
    }
    const record = {
      id,
      packageId,
      localId,
      name: String(source.name || localId).trim().slice(0, 120),
      mediaType: String(source.mediaType || 'application/octet-stream').trim().slice(0, 80),
      data: source.data,
      sizeBytes: byteLength(source.data),
      updatedAt: now()
    };
    await adapter.put(ASSET_STORE, record);
    return record;
  }

  async function listAssets(packageIdValue) {
    const packageId = assertId(packageIdValue, 'Package ID');
    const records = await adapter.getAll(ASSET_STORE);
    return records.filter(record => record.packageId === packageId);
  }

  async function removePackage(packageIdValue) {
    const packageId = assertId(packageIdValue, 'Package ID');
    const assets = await listAssets(packageId);
    await Promise.all(assets.map(asset => adapter.delete(ASSET_STORE, asset.id)));
    await adapter.delete(PACKAGE_STORE, packageId);
  }

  async function getUsage() {
    const packages = await listPackages();
    const assets = await adapter.getAll(ASSET_STORE);
    return {
      packageCount: packages.length,
      assetCount: assets.length,
      sizeBytes: [...packages, ...assets].reduce((total, record) => total + (record.sizeBytes || 0), 0)
    };
  }

  return {
    listPackages,
    getPackage: id => adapter.get(PACKAGE_STORE, assertId(id, 'Package ID')),
    savePackage,
    removePackage,
    saveAsset,
    listAssets,
    getAsset: (packageId, assetId) => adapter.get(
      ASSET_STORE,
      `${assertId(packageId, 'Package ID')}--${assertId(assetId, 'Asset ID')}`
    ),
    getUsage
  };
}

let defaultStore;

export function getCustomizationStore() {
  if (!defaultStore) defaultStore = createCustomizationStore();
  return defaultStore;
}
