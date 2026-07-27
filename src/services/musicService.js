const sessionPromises = new Map();

function normalizedBase(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function localBridgeBase(url) {
  try {
    const parsed = new URL(url, globalThis.location?.href);
    return ['127.0.0.1', 'localhost'].includes(parsed.hostname)
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

export function musicBaseUrl(config) {
  return normalizedBase(config.apps?.music?.apiBaseUrl || 'http://127.0.0.1:5188');
}

export async function ensureMusicSession(url) {
  const base = localBridgeBase(url);
  if (!base) return;
  if (sessionPromises.has(base)) return sessionPromises.get(base);

  const operation = fetch(`${base}/session`, {
    method: 'POST',
    credentials: 'include'
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '无法连接本机音乐服务');
    }
    return true;
  }).catch(error => {
    sessionPromises.delete(base);
    throw error;
  });
  sessionPromises.set(base, operation);
  return operation;
}

async function requestWithSession(url, options = {}, retry = true) {
  const base = localBridgeBase(url);
  if (base) await ensureMusicSession(base);
  const response = await fetch(url, {
    ...options,
    credentials: base ? 'include' : options.credentials
  });
  if (response.status === 401 && base && retry) {
    sessionPromises.delete(base);
    await ensureMusicSession(base);
    return requestWithSession(url, options, false);
  }
  return response;
}

export async function musicFetchJson(url, options) {
  const response = await requestWithSession(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `音乐接口返回 ${response.status}`);
  return data;
}

export function musicPostJson(base, path, body) {
  return musicFetchJson(`${normalizedBase(base)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function clearMusicSession(base) {
  sessionPromises.delete(normalizedBase(base));
}
