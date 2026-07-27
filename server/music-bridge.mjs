import { execFile, spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const host = '127.0.0.1';
const port = Number(process.env.LOVEPHONE_MUSIC_PORT || 5188);
const cliPath = process.env.NCM_CLI_JS || path.join(
  path.dirname(process.execPath),
  'node_modules',
  '@music163',
  'ncm-cli',
  'dist',
  'index.js'
);
const mpvDirectory = process.env.MPV_DIRECTORY || 'C:\\Program Files\\MPV Player';
const commandEnv = {
  ...process.env,
  PATH: `${mpvDirectory};${process.env.PATH || ''}`
};
const responseCache = new Map();
const loginHelperPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ncm-login.ps1');
const loginLauncherPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'open-ncm-login.ps1');
const sessionToken = randomBytes(32).toString('base64url');
const sessionCookieName = 'lovephone_music_session';
const trustedOrigins = new Set(
  String(process.env.LOVEPHONE_TRUSTED_ORIGINS || 'http://127.0.0.1:5177,http://localhost:5177')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

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

async function runCli(args, timeout = 30000) {
  const { stdout = '', stderr = '' } = await execFileAsync(process.execPath, [cliPath, ...args], {
    env: commandEnv,
    timeout,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
  const output = stdout.trim();
  if (!output) return { success: true, message: stderr.trim() };
  try {
    return JSON.parse(output);
  } catch {
    return { success: true, message: output };
  }
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32 * 1024) throw new Error('请求内容过大');
  }
  return raw ? JSON.parse(raw) : {};
}

function cleanKeyword(value) {
  return String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
}

function validEncryptedId(value) {
  return /^[A-F0-9]{32}$/i.test(String(value || ''));
}

function validOriginalId(value) {
  return /^\d{1,20}$/.test(String(value || ''));
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function cached(key, ttl, loader) {
  const stored = responseCache.get(key);
  if (stored && stored.expiresAt > Date.now()) return stored.value;
  const value = await loader();
  responseCache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

async function startPlayback(playArgs) {
  await runCli(playArgs, 45000);
  await wait(500);
  let state = await runCli(['state', '--output', 'json']);
  if (state.state?.status === 'stopped') {
    await runCli(playArgs, 45000);
    await wait(800);
    state = await runCli(['state', '--output', 'json']);
  }
  if (state.state?.status === 'stopped' && state.state?.duration) {
    await runCli(['resume']);
    await wait(300);
    state = await runCli(['state', '--output', 'json']);
  }
  return state;
}

async function handle(request, response) {
  if (!prepareCors(request, response)) {
    return json(response, 403, { error: '此页面无权访问本机音乐服务' });
  }
  if (request.method === 'OPTIONS') return json(response, 204, {});

  const url = new URL(request.url, `http://${host}:${port}`);
  if (request.method === 'POST' && url.pathname === '/session') {
    response.setHeader(
      'Set-Cookie',
      `${sessionCookieName}=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`
    );
    return json(response, 200, {
      ok: true,
      expiresIn: 43200
    });
  }

  if (!isAuthorized(request)) {
    return json(response, 401, { error: '音乐服务会话已失效，请重新连接' });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    const login = await runCli(['login', '--check']);
    return json(response, 200, {
      ok: true,
      authenticated: Boolean(login.success),
      service: 'LovePhone NetEase Music Bridge',
      login
    });
  }

  if (request.method === 'POST' && url.pathname === '/login-window') {
    const loginProcess = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', loginLauncherPath,
      '-HelperPath', loginHelperPath,
      '-NodePath', process.execPath,
      '-CliPath', cliPath
    ], {
      cwd: path.dirname(cliPath),
      env: commandEnv,
      stdio: 'ignore',
      windowsHide: true
    });
    loginProcess.unref();
    return json(response, 200, {
      ok: true,
      message: '网易云登录窗口已打开'
    });
  }

  if (request.method === 'GET' && url.pathname === '/search') {
    const keyword = cleanKeyword(url.searchParams.get('keywords'));
    if (!keyword) return json(response, 400, { error: '请输入搜索关键词' });
    const result = await runCli([
      'search', 'song',
      '--keyword', keyword,
      '--limit', '12',
      '--output', 'json'
    ]);
    return json(response, 200, {
      songs: result.data?.records || [],
      total: result.data?.recordCount || 0
    });
  }

  if (request.method === 'GET' && url.pathname === '/discover') {
    const data = await cached('discover', 5 * 60 * 1000, async () => {
      const [daily, radar, charts, ranking, created, collected] = await Promise.all([
        runCli(['recommend', 'daily', '--limit', '12', '--output', 'json']),
        runCli(['playlist', 'radar', '--output', 'json']),
        runCli(['search', 'playlist', '--keyword', '云音乐榜单', '--limit', '8', '--output', 'json']),
        runCli(['user', 'listen-ranking', '--type', '1', '--offset', '0', '--limit', '10', '--output', 'json']),
        runCli(['playlist', 'created', '--limit', '100', '--offset', '0', '--output', 'json']),
        runCli(['playlist', 'collected', '--limit', '100', '--offset', '0', '--output', 'json'])
      ]);
      return {
        daily: daily.data || [],
        radar: radar.data || [],
        charts: charts.data?.records || [],
        created: created.data?.records || [],
        collected: collected.data?.records || [],
        ranking: (ranking.data || []).map(item => ({
          ...item.song,
          playCount: item.playCount,
          score: item.score
        }))
      };
    });
    return json(response, 200, data);
  }

  if (request.method === 'GET' && url.pathname === '/playlist') {
    const playlistId = String(url.searchParams.get('id') || '');
    if (!validEncryptedId(playlistId)) return json(response, 400, { error: '歌单 ID 无效' });
    const offset = Math.max(0, Math.min(500, Number(url.searchParams.get('offset')) || 0));
    const data = await cached(`playlist:${playlistId}:${offset}`, 10 * 60 * 1000, async () => {
      const [detail, tracks] = await Promise.all([
        runCli(['playlist', 'get', '--playlistId', playlistId, '--output', 'json']),
        runCli([
          'playlist', 'tracks',
          '--playlistId', playlistId,
          '--limit', '50',
          '--offset', String(offset),
          '--output', 'json'
        ])
      ]);
      return {
        playlist: detail.data || null,
        songs: tracks.data || []
      };
    });
    return json(response, 200, data);
  }

  if (request.method === 'GET' && url.pathname === '/lyrics') {
    const songId = String(url.searchParams.get('id') || '');
    if (!validEncryptedId(songId)) return json(response, 400, { error: '歌曲 ID 无效' });
    const lyrics = await cached(`lyrics:${songId}`, 60 * 60 * 1000, () => (
      runCli(['song', 'lyric', '--songId', songId, '--output', 'json'])
    ));
    return json(response, 200, lyrics.data || {});
  }

  if (request.method === 'POST' && url.pathname === '/play') {
    const body = await readBody(request);
    if (!validEncryptedId(body.encryptedId) || !validOriginalId(body.originalId)) {
      return json(response, 400, { error: '歌曲 ID 无效' });
    }
    const state = await startPlayback([
      'play', '--song',
      '--encrypted-id', String(body.encryptedId),
      '--original-id', String(body.originalId),
      '--output', 'json'
    ]);
    return json(response, 200, state);
  }

  if (request.method === 'POST' && url.pathname === '/play-playlist') {
    const body = await readBody(request);
    if (!validEncryptedId(body.encryptedId) || !validOriginalId(body.originalId)) {
      return json(response, 400, { error: '歌单 ID 无效' });
    }
    const state = await startPlayback([
      'play', '--playlist',
      '--encrypted-id', String(body.encryptedId),
      '--original-id', String(body.originalId),
      '--output', 'json'
    ]);
    return json(response, 200, state);
  }

  if (request.method === 'POST' && url.pathname === '/control') {
    const body = await readBody(request);
    const allowed = new Set(['pause', 'resume', 'stop', 'next', 'prev']);
    if (!allowed.has(body.action)) return json(response, 400, { error: '不支持的播放操作' });
    await runCli([body.action]);
    const state = await runCli(['state', '--output', 'json']);
    return json(response, 200, state);
  }

  if (request.method === 'POST' && url.pathname === '/seek') {
    const body = await readBody(request);
    const seconds = Math.max(0, Math.min(24 * 60 * 60, Number(body.seconds) || 0));
    await runCli(['seek', String(seconds), '--output', 'json']);
    return json(response, 200, await runCli(['state', '--output', 'json']));
  }

  if (request.method === 'POST' && url.pathname === '/volume') {
    const body = await readBody(request);
    const level = Math.max(0, Math.min(100, Math.round(Number(body.level) || 0)));
    await runCli(['volume', String(level), '--output', 'json']);
    return json(response, 200, await runCli(['state', '--output', 'json']));
  }

  if (request.method === 'GET' && url.pathname === '/state') {
    return json(response, 200, await runCli(['state', '--output', 'json']));
  }

  return json(response, 404, { error: '接口不存在' });
}

createServer((request, response) => {
  handle(request, response).catch(error => {
    json(response, 500, {
      error: error.code === 'ENOENT'
        ? '没有找到网易云 CLI，请先安装 @music163/ncm-cli'
        : (error.message || '音乐服务发生错误')
    });
  });
}).listen(port, host, () => {
  console.log(`LovePhone music bridge: http://${host}:${port}`);
  console.log(`Trusted music origins: ${[...trustedOrigins].join(', ')}`);
});
