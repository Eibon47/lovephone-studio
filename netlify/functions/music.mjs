const MAX_COOKIE_LENGTH = 8192;
const MAX_REQUEST_BYTES = 24 * 1024;

const ROUTES = {
  '/cloudsearch': { module: 'cloudsearch', fields: ['keywords', 'limit'] },
  '/personalized': { module: 'personalized', fields: ['limit'] },
  '/toplist/detail': { module: 'toplist_detail', fields: [] },
  '/playlist/track/all': { module: 'playlist_track_all', fields: ['id', 'limit'] },
  '/lyric': { module: 'lyric', fields: ['id'] },
  '/song/url': { module: 'song_url', fields: ['id', 'br'] },
  '/login/qr/key': { module: 'login_qr_key', fields: [] },
  '/login/qr/create': { module: 'login_qr_create', fields: ['key', 'qrimg'] },
  '/login/qr/check': { module: 'login_qr_check', fields: ['key'] },
  '/user/playlist': { module: 'user_playlist', fields: ['uid', 'limit', 'offset'] }
};

const moduleLoaders = {
  cloudsearch: () => import('NeteaseCloudMusicApi/module/cloudsearch.js'),
  personalized: () => import('NeteaseCloudMusicApi/module/personalized.js'),
  toplist_detail: () => import('NeteaseCloudMusicApi/module/toplist_detail.js'),
  playlist_track_all: () => import('NeteaseCloudMusicApi/module/playlist_track_all.js'),
  lyric: () => import('NeteaseCloudMusicApi/module/lyric.js'),
  song_url: () => import('NeteaseCloudMusicApi/module/song_url.js'),
  login_qr_key: () => import('NeteaseCloudMusicApi/module/login_qr_key.js'),
  login_qr_create: () => import('NeteaseCloudMusicApi/module/login_qr_create.js'),
  login_qr_check: () => import('NeteaseCloudMusicApi/module/login_qr_check.js'),
  user_playlist: () => import('NeteaseCloudMusicApi/module/user_playlist.js')
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, maxLength);
}

function cleanCookie(value) {
  const cookie = String(value || '').replace(/[\r\n]/g, '').trim();
  if (cookie.length > MAX_COOKIE_LENGTH) throw new Error('登录凭证长度无效');
  return cookie;
}

function cookieToObject(cookie) {
  return cookie.split(';').reduce((result, part) => {
    const index = part.indexOf('=');
    if (index > 0) result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    return result;
  }, {});
}

function cleanParams(route, input = {}) {
  const params = {};
  for (const field of route.fields) {
    const value = input?.[field];
    if (value === undefined || value === null || value === '') continue;
    if (['limit', 'offset', 'br'].includes(field)) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error('音乐请求参数无效');
      params[field] = Math.max(0, Math.min(field === 'limit' ? 100 : 999000, Math.floor(number)));
      continue;
    }
    if (field === 'id' && !/^[\d,]+$/.test(String(value))) throw new Error('歌曲或歌单标识无效');
    params[field] = cleanText(value, field === 'keywords' ? 120 : 240);
  }
  return params;
}

async function callNetease(moduleName, params, cookie) {
  const [moduleImport, requestImport] = await Promise.all([
    moduleLoaders[moduleName](),
    import('NeteaseCloudMusicApi/util/request.js')
  ]);
  const handler = moduleImport.default;
  const request = requestImport.default;
  const result = await handler(
    { ...params, cookie: cookieToObject(cookie) },
    (...args) => request(...args)
  );
  return {
    status: Number(result?.status) || 200,
    body: result?.body || {}
  };
}

export default async request => {
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST 请求' });
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) return json(413, { error: '音乐请求过大' });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: '音乐请求格式无效' });
  }
  if (body?.path === '/health') return json(200, { ok: true, service: 'LovePhone Music Gateway' });

  const route = ROUTES[cleanText(body?.path, 80)];
  if (!route) return json(403, { error: '此音乐接口未开放' });
  try {
    const result = await callNetease(route.module, cleanParams(route, body?.params), cleanCookie(body?.cookie));
    return json(Math.max(200, Math.min(599, result.status)), result.body);
  } catch (error) {
    return json(502, { error: cleanText(error?.message, 240) || '网易云音乐服务暂时不可用' });
  }
};

export const config = {
  path: '/.netlify/functions/music',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 80 }
};
