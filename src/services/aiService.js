import { friendlyAiError } from './aiErrors.js';

const LOCAL_AI_BRIDGE = 'http://127.0.0.1:5189';
const NETLIFY_AI_GATEWAY = '/.netlify/functions/ai';
const CLOUDBASE_AI_GATEWAY = '/api-ai';
const CLOUDBASE_GATEWAY_ORIGIN = 'https://xiaoye-d4ggsw4zt7bce7dba.service.tcloudbase.com';
const REMOTE_PROFILE_KEY = 'lovephone-ai-session-profiles-v1';
const sessionPromises = new Map();
let memoryProfiles = {};

function runningLocally() {
  const hostname = globalThis.location?.hostname || '';
  return ['127.0.0.1', 'localhost'].includes(hostname);
}

function bridgeUrl(config) {
  const configured = String(config.aiProviders?.bridgeUrl || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (runningLocally()) return LOCAL_AI_BRIDGE;
  const hostname = String(globalThis.location?.hostname || '').toLowerCase();
  return hostname.endsWith('.netlify.app') ? NETLIFY_AI_GATEWAY : `${CLOUDBASE_GATEWAY_ORIGIN}${CLOUDBASE_AI_GATEWAY}`;
}

function localBridgeBase(url) {
  try {
    const parsed = new URL(url, globalThis.location?.href);
    return ['127.0.0.1', 'localhost'].includes(parsed.hostname) ? parsed.origin : '';
  } catch {
    return '';
  }
}

function remoteGateway(config) {
  return localBridgeBase(bridgeUrl(config)) ? '' : bridgeUrl(config);
}

function loadRemoteProfiles() {
  try {
    const raw = globalThis.sessionStorage?.getItem(REMOTE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : memoryProfiles;
  } catch {
    return memoryProfiles;
  }
}

function saveRemoteProfiles(profiles) {
  memoryProfiles = profiles;
  try {
    globalThis.sessionStorage?.setItem(REMOTE_PROFILE_KEY, JSON.stringify(profiles));
  } catch {
    // Private browsing can deny storage; the in-memory session is still usable.
  }
}

function saveRemoteProfile(profile) {
  const profiles = loadRemoteProfiles();
  saveRemoteProfiles({
    ...profiles,
    [profile.profileId]: {
      providerId: profile.providerId,
      apiKey: profile.apiKey,
      model: profile.model,
      baseUrl: profile.baseUrl || ''
    }
  });
}

function remoteProfile(profileId, providerId) {
  const profile = loadRemoteProfiles()[profileId];
  if (!profile || profile.providerId !== providerId || !profile.apiKey) {
    throw new Error('请先在设置中填写 API Key 并连接测试。在线版密钥只在当前浏览器会话中保存。');
  }
  return profile;
}

async function remoteRequest(config, body, options = {}) {
  const response = await fetch(remoteGateway(config), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal
  });
  return response;
}

export async function ensureAiSession(url) {
  const base = localBridgeBase(url);
  if (!base) return;
  if (sessionPromises.has(base)) return sessionPromises.get(base);
  const operation = fetch(`${base}/session`, { method: 'POST', credentials: 'include' })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '无法连接本机 AI 服务');
      return true;
    })
    .catch(error => {
      sessionPromises.delete(base);
      throw error;
    });
  sessionPromises.set(base, operation);
  return operation;
}

async function localRequest(config, path, options = {}, retry = true) {
  const base = localBridgeBase(bridgeUrl(config));
  if (base) await ensureAiSession(base);
  const response = await fetch(`${bridgeUrl(config)}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: base ? 'include' : options.credentials
  });
  if (response.status === 401 && base && retry) {
    sessionPromises.delete(base);
    return localRequest(config, path, options, false);
  }
  return response;
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(friendlyAiError(data.error || `AI 服务请求失败（${response.status}）`));
  return data;
}

export async function getAiBridgeHealth(config) {
  try {
    const response = remoteGateway(config)
      ? await remoteRequest(config, { action: 'health' })
      : await localRequest(config, '/health');
    return responseJson(response);
  } catch (error) {
    throw new Error(friendlyAiError(error));
  }
}

export async function getAiProviderStatuses(config) {
  if (remoteGateway(config)) {
    await getAiBridgeHealth(config);
    const profiles = Object.entries(loadRemoteProfiles()).map(([profileId, profile]) => ({
      profileId,
      providerId: profile.providerId,
      model: profile.model,
      configured: true
    }));
    return {
      providers: profiles.map(profile => ({ providerId: profile.providerId, id: profile.providerId, model: profile.model, configured: true })),
      profiles
    };
  }
  return responseJson(await localRequest(config, '/providers'));
}

export async function configureAiProvider(config, profile) {
  try {
    if (remoteGateway(config)) {
      const response = await remoteRequest(config, { action: 'configure', ...profile });
      const result = await responseJson(response);
      saveRemoteProfile(profile);
      return result;
    }
    return responseJson(await localRequest(config, '/profiles/configure', { method: 'POST', body: JSON.stringify(profile) }));
  } catch (error) {
    throw new Error(friendlyAiError(error));
  }
}

export async function removeAiProfile(config, profileId) {
  if (remoteGateway(config)) {
    const profiles = loadRemoteProfiles();
    delete profiles[profileId];
    saveRemoteProfiles(profiles);
    return { ok: true, profileId };
  }
  return responseJson(await localRequest(config, '/profiles/remove', { method: 'POST', body: JSON.stringify({ profileId }) }));
}

export async function testAiProvider(config, profile) {
  const payload = typeof profile === 'string' ? { providerId: profile, profileId: profile } : profile;
  try {
    if (remoteGateway(config)) {
      const saved = remoteProfile(payload.profileId, payload.providerId);
      return responseJson(await remoteRequest(config, { action: 'test', ...payload, ...saved }));
    }
    return responseJson(await localRequest(config, '/profiles/test', { method: 'POST', body: JSON.stringify(payload) }));
  } catch (error) {
    throw new Error(friendlyAiError(error));
  }
}

export async function streamAiChat(config, payload, handlers = {}) {
  let response;
  try {
    if (remoteGateway(config)) {
      const saved = remoteProfile(payload.profileId, payload.providerId);
      response = await remoteRequest(config, { action: 'chat', ...payload, ...saved }, { signal: handlers.signal });
    } else {
      response = await localRequest(config, '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: handlers.signal
      });
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error(friendlyAiError(error));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(friendlyAiError(data.error || `AI 服务请求失败（${response.status}）`));
  }
  if (!response.body) throw new Error('浏览器无法读取流式回复');
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => ({}));
    const answer = String(data.answer || '').trim();
    if (!answer) throw new Error(friendlyAiError(data.error || '模型返回了空内容，请检查模型是否支持聊天'));
    handlers.onDelta?.(answer, answer);
    handlers.onDone?.({ type: 'done', text: answer, providerId: data.providerId, model: data.model });
    return answer;
  }
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

export function clearAiSession(configOrBase = LOCAL_AI_BRIDGE) {
  const base = typeof configOrBase === 'string' ? String(configOrBase).replace(/\/+$/, '') : bridgeUrl(configOrBase);
  sessionPromises.delete(base);
}
