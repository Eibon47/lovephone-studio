import { friendlyAiError } from './aiErrors.js';

const DEFAULT_AI_BRIDGE = 'http://127.0.0.1:5189';
const sessionPromises = new Map();

function bridgeUrl(config) {
  return String(config.aiProviders?.bridgeUrl || DEFAULT_AI_BRIDGE).trim().replace(/\/+$/, '');
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

export async function ensureAiSession(url) {
  const base = localBridgeBase(url);
  if (!base) return;
  if (sessionPromises.has(base)) return sessionPromises.get(base);

  const operation = fetch(`${base}/session`, {
    method: 'POST',
    credentials: 'include'
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '无法连接本机 AI 服务');
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
  if (base) await ensureAiSession(base);
  const response = await fetch(url, {
    ...options,
    credentials: base ? 'include' : options.credentials
  });
  if (response.status === 401 && base && retry) {
    sessionPromises.delete(base);
    await ensureAiSession(base);
    return requestWithSession(url, options, false);
  }
  return response;
}

async function requestJson(config, path, options = {}) {
  let response;
  try {
    response = await requestWithSession(`${bridgeUrl(config)}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(friendlyAiError(error));
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(friendlyAiError(data.error || `AI 服务请求失败（${response.status}）`));
  }
  return data;
}

export function getAiBridgeHealth(config) {
  return requestJson(config, '/health');
}

export function getAiProviderStatuses(config) {
  return requestJson(config, '/providers');
}

export function configureAiProvider(config, profile) {
  return requestJson(config, '/profiles/configure', {
    method: 'POST',
    body: JSON.stringify(profile)
  });
}

export function removeAiProfile(config, profileId) {
  return requestJson(config, '/profiles/remove', {
    method: 'POST',
    body: JSON.stringify({ profileId })
  });
}

export function testAiProvider(config, profile) {
  const payload = typeof profile === 'string'
    ? { providerId: profile, profileId: profile }
    : profile;
  return requestJson(config, '/profiles/test', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function streamAiChat(config, payload, handlers = {}) {
  let response;
  try {
    response = await requestWithSession(`${bridgeUrl(config)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: handlers.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error(friendlyAiError(error));
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(friendlyAiError(data.error || `AI 服务请求失败（${response.status}）`));
  }
  if (!response.body) throw new Error('浏览器无法读取流式回复');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === 'delta') {
        finalText += event.text || '';
        handlers.onDelta?.(event.text || '', finalText);
      }
      if (event.type === 'done') {
        finalText = event.text || finalText;
        handlers.onDone?.(event);
      }
      if (event.type === 'error') throw new Error(friendlyAiError(event.error || '模型回复失败'));
    }
    if (done) break;
  }
  return finalText.trim();
}

export function clearAiSession(configOrBase = DEFAULT_AI_BRIDGE) {
  const base = typeof configOrBase === 'string'
    ? String(configOrBase).replace(/\/+$/, '')
    : bridgeUrl(configOrBase);
  sessionPromises.delete(base);
}
