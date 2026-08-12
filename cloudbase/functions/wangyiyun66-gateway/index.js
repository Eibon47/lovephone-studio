'use strict';

const { mkdir, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const MAX_BODY = 24 * 1024;
const MAX_COOKIE = 8192;
let tokenReady;

const ROUTES = Object.freeze({
  '/cloudsearch': ['cloudsearch', ['keywords', 'limit']],
  '/personalized': ['personalized', ['limit']],
  '/toplist/detail': ['toplist_detail', []],
  '/playlist/track/all': ['playlist_track_all', ['id', 'limit', 'offset']],
  '/lyric': ['lyric', ['id']],
  '/song/url': ['song_url', ['id', 'br']],
  '/login/qr/key': ['login_qr_key', []],
  '/login/qr/create': ['login_qr_create', ['key', 'qrimg']],
  '/login/qr/check': ['login_qr_check', ['key']],
  '/login/status': ['login_status', []],
  '/user/playlist': ['user_playlist', ['uid', 'limit', 'offset']]
});

const MODULES = Object.freeze({
  cloudsearch: () => import('NeteaseCloudMusicApi/module/cloudsearch.js'),
  personalized: () => import('NeteaseCloudMusicApi/module/personalized.js'),
  toplist_detail: () => import('NeteaseCloudMusicApi/module/toplist_detail.js'),
  playlist_track_all: () => import('NeteaseCloudMusicApi/module/playlist_track_all.js'),
  lyric: () => import('NeteaseCloudMusicApi/module/lyric.js'),
  song_url: () => import('NeteaseCloudMusicApi/module/song_url.js'),
  login_qr_key: () => import('NeteaseCloudMusicApi/module/login_qr_key.js'),
  login_qr_create: () => import('NeteaseCloudMusicApi/module/login_qr_create.js'),
  login_qr_check: () => import('NeteaseCloudMusicApi/module/login_qr_check.js'),
  login_status: () => import('NeteaseCloudMusicApi/module/login_status.js'),
  user_playlist: () => import('NeteaseCloudMusicApi/module/user_playlist.js')
});

const clean = (value, limit = 200) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, limit);

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    },
    body: JSON.stringify(payload)
  };
}

function parseBody(event) {
  const raw = event?.body ?? event;
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY) throw new Error('音乐请求过大');
    return JSON.parse(raw || '{}');
  }
  const text = JSON.stringify(raw || {});
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY) throw new Error('音乐请求过大');
  return raw || {};
}

function cookieObject(value) {
  const raw = String(value || '').replace(/[\r\n]/g, '').trim();
  if (raw.length > MAX_COOKIE) throw new Error('登录凭证长度无效');
  return raw.split(';').reduce((all, item) => {
    const index = item.indexOf('=');
    if (index > 0) all[item.slice(0, index).trim()] = item.slice(index + 1).trim();
    return all;
  }, {});
}

function parameters(fields, raw = {}) {
  const result = {};
  fields.forEach(field => {
    const value = raw[field];
    if (value == null || value === '') return;
    if (['limit', 'offset', 'br'].includes(field)) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error('音乐请求参数无效');
      result[field] = Math.max(0, Math.min(field === 'limit' ? 100 : 999000, Math.floor(number)));
      return;
    }
    if (['id', 'uid'].includes(field) && !/^[\d,]+$/.test(String(value))) throw new Error('音乐标识无效');
    result[field] = clean(value, field === 'keywords' ? 100 : 240);
  });
  return result;
}

async function callModule(name, params, cookie) {
  if (!tokenReady) {
    const tokenPath = path.join(tmpdir(), 'anonymous_token');
    tokenReady = mkdir(path.dirname(tokenPath), { recursive: true }).then(() => writeFile(tokenPath, '', { flag: 'a' }));
  }
  await tokenReady;
  const [moduleImport, requestImport] = await Promise.all([
    MODULES[name](),
    import('NeteaseCloudMusicApi/util/request.js')
  ]);
  const result = await moduleImport.default({ ...params, cookie }, (...args) => requestImport.default(...args));
  return { status: Math.max(200, Math.min(599, Number(result?.status) || 200)), body: result?.body || {} };
}

exports.main = async (event = {}) => {
  const method = String(event.httpMethod || event.method || 'POST').toUpperCase();
  if (method === 'OPTIONS') return response(204, {});
  if (method !== 'POST') return response(405, { error: '仅支持 POST 请求' });
  try {
    const body = parseBody(event);
    if (body.path === '/health') return response(200, { ok: true, provider: 'netease', runtime: 'cloudbase', gateway: 'wangyiyun66-gateway' });
    const route = ROUTES[clean(body.path, 80)];
    if (!route) return response(403, { error: '此网易云接口未开放' });
    const result = await callModule(route[0], parameters(route[1], body.params), cookieObject(body.cookie));
    return response(result.status, result.body);
  } catch (error) {
    return response(502, { error: clean(error?.message, 240) || '网易云音乐服务暂时不可用' });
  }
};
