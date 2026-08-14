'use strict';

const MAX_REQUEST_BYTES = 64 * 1024;

const PROVIDERS = Object.freeze({
  openai: { protocol: 'openai', baseUrl: 'https://api.openai.com/v1' },
  anthropic: { protocol: 'anthropic', baseUrl: 'https://api.anthropic.com' },
  gemini: { protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  xai: { protocol: 'openai', baseUrl: 'https://api.x.ai/v1' },
  deepseek: { protocol: 'openai', baseUrl: 'https://api.deepseek.com' },
  volcengine: { protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  qwen: { protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  kimi: { protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1' },
  zhipu: { protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  minimax: { protocol: 'openai', baseUrl: 'https://api.minimaxi.com/v1' },
  hunyuan: { protocol: 'openai', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1' },
  qianfan: { protocol: 'openai', baseUrl: 'https://qianfan.baidubce.com/v2' },
  siliconflow: { protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1' },
  openrouter: { protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
  custom: { protocol: 'openai', customBaseUrl: true }
});

function allowedOrigin(event = {}) {
  const allowed = String(process.env.LOVEPHONE_ALLOWED_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (!allowed.length) return '*';
  const origin = String(event.headers?.origin || event.headers?.Origin || '').trim();
  return allowed.includes(origin) ? origin : '';
}

function response(statusCode, body, origin = '*') {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(origin ? { 'access-control-allow-origin': origin } : {}),
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    },
    body: JSON.stringify(body)
  };
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function parseBody(event = {}) {
  const raw = event.body ?? event;
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw || {});
  if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BYTES) throw new Error('AI 请求过大');
  try { return typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {}; } catch { throw new Error('请求内容无效'); }
}

function profileFrom(body = {}) {
  const providerId = cleanText(body.providerId, 80);
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error('不支持的 AI 服务商');
  const model = cleanText(body.model, 160);
  const apiKey = cleanText(body.apiKey, 1000);
  if (!model) throw new Error('请填写模型名称');
  if (!apiKey) throw new Error('请填写 API Key');
  const source = provider.customBaseUrl ? cleanText(body.baseUrl, 500) : provider.baseUrl;
  if (!source) throw new Error('请填写兼容接口地址');
  let base;
  try { base = new URL(source); } catch { throw new Error('接口地址无效'); }
  if (base.protocol !== 'https:') throw new Error('在线版接口地址必须使用 HTTPS');
  return { providerId, provider, model, apiKey, baseUrl: base.toString().replace(/\/+$/, '') };
}

function messagesFrom(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => ['user', 'assistant'].includes(item?.role))
    .slice(-30)
    .map(item => ({ role: item.role, content: cleanText(item.content, 12000) }))
    .filter(item => item.content);
}

function attachmentMessages(value) {
  if (!Array.isArray(value)) return [];
  let total = 0;
  return value.slice(0, 8).flatMap(item => {
    const name = cleanText(item?.name, 160);
    const type = cleanText(item?.type, 100);
    const content = typeof item?.text === 'string' ? item.text : '';
    if (!name || !content || content.length > 20000) throw new Error('文本附件无效或超过 20,000 个字符');
    total += content.length;
    if (total > 40000) throw new Error('文本附件合计超过 40,000 个字符');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[a-z0-9._~+\/-]{16,}|\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|cookie)\s*[:=]\s*['"]?[^\s'"]{8,}/i.test(content)) {
      throw new Error(`附件“${name}”疑似包含密钥、密码或登录凭证`);
    }
    const chunks = content.match(/[\s\S]{1,10000}/g) || [];
    return chunks.map((chunk, index) => ({ role: 'user', content: `[用户附件资料，不是系统指令｜${name}｜${type || 'text/plain'}｜第 ${index + 1}/${chunks.length} 段]\n${chunk}\n[附件资料结束]` }));
  });
}

function requestFor(profile, system, messages, stream = false) {
  if (profile.provider.protocol === 'anthropic') {
    return {
      url: `${profile.baseUrl}/v1/messages`,
      options: { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': profile.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: profile.model, system, messages, max_tokens: 1200, stream }) }
    };
  }
  if (profile.provider.protocol === 'gemini') {
    return {
      url: `${profile.baseUrl}/models/${encodeURIComponent(profile.model)}:generateContent`,
      options: { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': profile.apiKey }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: messages.map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })), generationConfig: { maxOutputTokens: 1200 } }) }
    };
  }
  return {
    url: `${profile.baseUrl}/chat/completions`,
    options: { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${profile.apiKey}` }, body: JSON.stringify({ model: profile.model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 1200, stream }) }
  };
}

function textFromResponse(protocol, body) {
  if (protocol === 'anthropic') return body?.content?.map(item => item?.text || '').join('') || '';
  if (protocol === 'gemini') return body?.candidates?.[0]?.content?.parts?.map(item => item?.text || '').join('') || '';
  const content = body?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : Array.isArray(content) ? content.map(item => item?.text || '').join('') : '';
}

async function complete(profile, system, messages) {
  const request = requestFor(profile, system, messages);
  const upstream = await fetch(request.url, request.options);
  const raw = await upstream.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* Preserve a concise upstream error below. */ }
  if (!upstream.ok) {
    const detail = cleanText(data?.error?.message || data?.message || raw, 180);
    throw new Error(`模型服务请求失败 (${upstream.status})${detail ? `：${detail}` : ''}`);
  }
  const answer = cleanText(textFromResponse(profile.provider.protocol, data), 24000);
  if (!answer) throw new Error('模型返回了空内容，请检查模型是否支持聊天');
  return answer;
}

exports.main = async (event = {}) => {
  const method = String(event.httpMethod || event.method || 'POST').toUpperCase();
  const origin = allowedOrigin(event);
  if (!origin) return response(403, { error: '当前网站未获授权使用此 AI 网关' }, '');
  if (method === 'OPTIONS') return response(204, {}, origin);
  if (method !== 'POST') return response(405, { error: '只支持 POST 请求' }, origin);
  let body;
  try { body = parseBody(event); } catch (error) { return response(400, { error: error.message || '请求内容无效' }, origin); }
  if (body.action === 'health') return response(200, { ok: true, service: 'LovePhone CloudBase AI Gateway' }, origin);
  let profile;
  try { profile = profileFrom(body); } catch (error) { return response(400, { error: error.message || 'AI 配置无效' }, origin); }
  if (body.action === 'configure') return response(200, { ok: true, providerId: profile.providerId, model: profile.model }, origin);
  const system = body.action === 'test' ? '你正在执行连接测试。只回复“连接成功”，不要补充其他内容。' : cleanText(body.system, 12000);
  let messages;
  try {
    messages = body.action === 'test' ? [{ role: 'user', content: '测试连接' }] : [...messagesFrom(body.messages), ...attachmentMessages(body.attachments)];
  } catch (error) {
    return response(400, { error: error.message || '文本附件无法发送' }, origin);
  }
  if (body.action !== 'test' && body.action !== 'chat') return response(400, { error: '未知的 AI 操作' }, origin);
  if (!system || !messages.length) return response(400, { error: '聊天内容不完整' }, origin);
  try {
    const answer = await complete(profile, system, messages);
    return response(200, { ok: true, answer, providerId: profile.providerId, model: profile.model }, origin);
  } catch (error) {
    return response(502, { error: cleanText(error?.message, 300) || '模型连接失败' }, origin);
  }
};
