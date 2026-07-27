import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { AI_PROVIDER_CATALOG, getAiProvider } from '../src/config/aiProviderCatalog.js';
import { createSecureProfileStore } from './secure-profile-store.mjs';

const host = '127.0.0.1';
const port = Number(process.env.LOVEPHONE_AI_PORT || 5189);
const secureProfileStore = createSecureProfileStore();
let secretStorageError = '';
let restoredProfiles = [];
try {
  restoredProfiles = await secureProfileStore.load();
} catch (error) {
  secretStorageError = error.message || '加密密钥存储无法读取';
  console.error(`LovePhone AI secret storage: ${secretStorageError}`);
}
const profiles = new Map(restoredProfiles);
const sessionToken = randomBytes(32).toString('base64url');
const sessionCookieName = 'lovephone_ai_session';
const trustedOrigins = new Set(
  String(process.env.LOVEPHONE_TRUSTED_ORIGINS || 'http://127.0.0.1:5177,http://localhost:5177')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

const environmentKeys = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  xai: 'XAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  volcengine: 'ARK_API_KEY',
  qwen: 'DASHSCOPE_API_KEY',
  kimi: 'MOONSHOT_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  hunyuan: 'HUNYUAN_API_KEY',
  qianfan: 'QIANFAN_API_KEY',
  siliconflow: 'SILICONFLOW_API_KEY',
  openrouter: 'OPENROUTER_API_KEY'
};

async function persistProfiles() {
  try {
    await secureProfileStore.save([...profiles.entries()]);
    secretStorageError = '';
  } catch (error) {
    secretStorageError = error.message || '密钥加密保存失败';
    throw new Error(`AI 配置未能安全保存：${secretStorageError}`);
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function prepareCors(request, response) {
  const origin = String(request.headers.origin || '');
  if (!origin || !trustedOrigins.has(origin)) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Vary', 'Origin');
  return true;
}

function cookieValue(request, name) {
  const cookies = String(request.headers.cookie || '').split(';');
  const prefix = `${name}=`;
  const match = cookies.map(value => value.trim()).find(value => value.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : '';
}

function matchesSession(value) {
  const received = Buffer.from(String(value || ''));
  const expected = Buffer.from(sessionToken);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function isAuthorized(request) {
  return matchesSession(cookieValue(request, sessionCookieName));
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw new Error('请求内容过大');
  }
  return raw ? JSON.parse(raw) : {};
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function cleanProfileId(value, fallback = '') {
  const profileId = cleanText(value || fallback, 120);
  if (!/^[a-zA-Z0-9_-]{2,120}$/.test(profileId)) {
    throw new Error('AI 配置标识无效');
  }
  return profileId;
}

function validateBaseUrl(value, provider) {
  const candidate = provider.customBaseUrl ? cleanText(value, 500) : provider.baseUrl;
  if (!candidate) throw new Error('请填写兼容接口地址');
  const url = new URL(candidate);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('接口地址必须使用 HTTPS；本机服务可以使用 HTTP');
  }
  return candidate.replace(/\/+$/, '');
}

function configuredProfile(profileIdValue, providerIdValue) {
  const profileId = cleanProfileId(profileIdValue, providerIdValue);
  const stored = profiles.get(profileId) || {};
  const providerId = cleanText(stored.providerId || providerIdValue, 80);
  const provider = getAiProvider(providerId);
  if (!provider) throw new Error('不支持的 AI 服务商');
  if (stored.providerId && providerIdValue && stored.providerId !== providerIdValue) {
    throw new Error('角色 AI 配置与所选服务商不一致，请重新连接');
  }
  const apiKey = stored.apiKey || process.env[environmentKeys[providerId]] || '';
  if (!apiKey && !provider.apiKeyOptional) throw new Error('请先在设置中连接这个服务商');
  if (!stored.model) throw new Error('请先填写模型名称');
  return {
    profileId,
    provider,
    apiKey,
    model: stored.model,
    baseUrl: validateBaseUrl(stored.baseUrl, provider)
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(message => ['user', 'assistant'].includes(message?.role))
    .slice(-30)
    .map(message => ({
      role: message.role,
      content: cleanText(message.content, 12000)
    }))
    .filter(message => message.content);
}

function errorMessage(status, detail = '') {
  if (status === 401 || status === 403) return 'API Key 无效或没有访问这个模型的权限';
  if (status === 402) return '账户余额不足，请前往服务商控制台充值';
  if (status === 404) return '没有找到这个模型，请检查模型名称';
  if (status === 408) return '模型响应超时，请稍后重试';
  if (status === 429) return '请求过于频繁或额度已用完，请稍后重试';
  if (status >= 500) return '模型服务暂时不可用，请稍后重试';
  return cleanText(detail, 300) || `模型请求失败（${status}）`;
}

async function fetchUpstream(url, options, retries = 1, externalSignal) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (externalSignal?.aborted) throw new DOMException('请求已取消', 'AbortError');
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', relayAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) return response;
      externalSignal?.removeEventListener('abort', relayAbort);
      const detail = await response.text();
      const error = new Error(errorMessage(response.status, detail));
      error.status = response.status;
      if (attempt < retries && (response.status === 429 || response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
      throw error;
    } catch (error) {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', relayAbort);
      if (externalSignal?.aborted) throw new DOMException('请求已取消', 'AbortError');
      lastError = error.name === 'AbortError' ? new Error('模型响应超时，请稍后重试') : error;
      if (attempt < retries && !error.status) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

function upstreamRequest(profile, system, messages) {
  const { provider, apiKey, model, baseUrl } = profile;
  if (provider.protocol === 'anthropic') {
    return {
      url: `${baseUrl}/v1/messages`,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          system,
          messages,
          max_tokens: 1200,
          stream: true
        })
      }
    };
  }

  if (provider.protocol === 'gemini') {
    return {
      url: `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }]
          })),
          generationConfig: { maxOutputTokens: 1200 }
        })
      }
    };
  }

  return {
    url: `${baseUrl}/chat/completions`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 1200,
        stream: true
      })
    }
  };
}

function textFromEvent(protocol, payload) {
  if (protocol === 'anthropic') {
    return payload.type === 'content_block_delta' ? payload.delta?.text || '' : '';
  }
  if (protocol === 'gemini') {
    return payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  }
  const content = payload.choices?.[0]?.delta?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(part => part.text || '').join('');
  return '';
}

async function streamCompletion(profile, system, messages, onDelta, signal) {
  const request = upstreamRequest(profile, system, messages);
  const upstream = await fetchUpstream(request.url, request.options, 1, signal);
  if (!upstream.body) throw new Error('模型没有返回可读取的内容');

  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  for await (const chunk of upstream.body) {
    if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const text = textFromEvent(profile.provider.protocol, JSON.parse(data));
        if (text) {
          answer += text;
          onDelta(text);
        }
      } catch {
        // Ignore provider heartbeat and non-JSON event lines.
      }
    }
  }
  if (!answer.trim()) throw new Error('模型返回了空内容，请检查模型是否支持聊天');
  return answer;
}

async function handle(request, response) {
  if (!prepareCors(request, response)) {
    return json(response, 403, { error: '此页面无权访问本机 AI 服务' });
  }
  if (request.method === 'OPTIONS') return json(response, 204, {});

  const url = new URL(request.url, `http://${host}:${port}`);
  if (request.method === 'POST' && url.pathname === '/session') {
    response.setHeader(
      'Set-Cookie',
      `${sessionCookieName}=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`
    );
    return json(response, 200, { ok: true, expiresIn: 43200 });
  }

  if (!isAuthorized(request)) {
    return json(response, 401, { error: 'AI 服务会话已失效，请重新连接' });
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(response, 200, {
      ok: true,
      service: 'LovePhone AI Bridge',
      configured: [...profiles.keys()],
      secretStorage: secureProfileStore.kind,
      secretStorageError
    });
  }

  if (request.method === 'GET' && url.pathname === '/providers') {
    return json(response, 200, {
      providers: AI_PROVIDER_CATALOG.map(provider => ({
        id: provider.id,
        name: provider.name,
        configured: profiles.has(provider.id) || Boolean(process.env[environmentKeys[provider.id]]),
        model: profiles.get(provider.id)?.model || ''
      })),
      profiles: [...profiles.entries()].map(([profileId, profile]) => ({
        profileId,
        providerId: profile.providerId,
        model: profile.model,
        configured: true
      }))
    });
  }

  if (request.method === 'POST' && url.pathname === '/profiles/configure') {
    const body = await readBody(request);
    const provider = getAiProvider(body.providerId);
    if (!provider) return json(response, 400, { error: '不支持的 AI 服务商' });
    const profileId = cleanProfileId(body.profileId, provider.id);
    const existing = profiles.get(profileId);
    const model = cleanText(body.model, 160);
    const suppliedApiKey = cleanText(body.apiKey, 1000);
    const retainedApiKey = existing?.providerId === provider.id ? existing.apiKey : '';
    const apiKey = suppliedApiKey || retainedApiKey || process.env[environmentKeys[provider.id]] || '';
    if (!model) return json(response, 400, { error: '请填写模型名称' });
    if (!apiKey && !provider.apiKeyOptional) {
      return json(response, 400, { error: '请填写 API Key' });
    }
    const baseUrl = validateBaseUrl(body.baseUrl, provider);
    const previous = profiles.get(profileId);
    profiles.set(profileId, { providerId: provider.id, apiKey, model, baseUrl });
    try {
      await persistProfiles();
    } catch (error) {
      if (previous) profiles.set(profileId, previous);
      else profiles.delete(profileId);
      throw error;
    }
    return json(response, 200, {
      ok: true,
      profileId,
      providerId: provider.id,
      model,
      keyStored: secureProfileStore.kind
    });
  }

  if (request.method === 'POST' && url.pathname === '/profiles/remove') {
    const body = await readBody(request);
    const profileId = cleanProfileId(body.profileId);
    const previous = profiles.get(profileId);
    profiles.delete(profileId);
    try {
      await persistProfiles();
    } catch (error) {
      if (previous) profiles.set(profileId, previous);
      throw error;
    }
    return json(response, 200, { ok: true, profileId });
  }

  if (request.method === 'POST' && url.pathname === '/profiles/test') {
    const body = await readBody(request);
    const profile = configuredProfile(body.profileId, body.providerId);
    let answer = '';
    await streamCompletion(
      profile,
      '你正在执行连接测试。只回复“连接成功”，不要补充其他内容。',
      [{ role: 'user', content: '测试连接' }],
      text => { answer += text; }
    );
    return json(response, 200, { ok: true, answer: cleanText(answer, 200) });
  }

  if (request.method === 'POST' && url.pathname === '/chat') {
    const body = await readBody(request);
    const profile = configuredProfile(body.profileId, body.providerId);
    const system = cleanText(body.system, 12000);
    const messages = normalizeMessages(body.messages);
    if (!system || !messages.length) return json(response, 400, { error: '聊天内容不完整' });

    response.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    const controller = new AbortController();
    const stopUpstream = () => {
      if (!response.writableEnded) controller.abort();
    };
    request.once('aborted', stopUpstream);
    response.once('close', stopUpstream);
    const send = payload => {
      if (!response.destroyed && !response.writableEnded) {
        response.write(`${JSON.stringify(payload)}\n`);
      }
    };
    try {
      const answer = await streamCompletion(
        profile,
        system,
        messages,
        text => send({ type: 'delta', text }),
        controller.signal
      );
      send({
        type: 'done',
        text: answer,
        profileId: profile.profileId,
        providerId: profile.provider.id,
        model: profile.model
      });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        send({ type: 'error', error: error.message || '模型请求失败' });
      }
    }
    if (!response.destroyed && !response.writableEnded) response.end();
    return;
  }

  return json(response, 404, { error: '接口不存在' });
}

createServer((request, response) => {
  handle(request, response).catch(error => {
    json(response, 500, { error: error.message || 'AI 服务发生错误' });
  });
}).listen(port, host, () => {
  console.log(`LovePhone AI bridge: http://${host}:${port}`);
  console.log(`Trusted AI origins: ${[...trustedOrigins].join(', ')}`);
});
