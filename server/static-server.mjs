import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' http://127.0.0.1:5188 http://127.0.0.1:5189 https://api.open-meteo.com https://geocoding-api.open-meteo.com",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ');

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function safeFilePath(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return '';
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  const prefix = `${path.resolve(root)}${path.sep}`;
  return resolved.startsWith(prefix) ? resolved : '';
}

export function startStaticServer(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const host = options.host || '127.0.0.1';
  const port = Number(options.port ?? process.env.LOVEPHONE_WEB_PORT ?? 5177);
  const runtimeToken = String(options.runtimeToken || '');
  const runtimeProof = runtimeToken
    ? createHash('sha256').update(runtimeToken).digest('hex')
    : '';
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', contentSecurityPolicy);
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');

    if (!['GET', 'HEAD'].includes(request.method || '')) {
      return sendJson(response, 405, { error: '请求方法不允许' });
    }

    const url = new URL(request.url, `http://${host}:${port}`);
    if (url.pathname === '/__lovephone_runtime') {
      return sendJson(response, 200, {
        desktop: Boolean(runtimeToken),
        instance: runtimeProof
      });
    }
    if (url.pathname === '/node_modules' || url.pathname.startsWith('/node_modules/')) {
      return sendJson(response, 403, { error: '依赖目录不允许网页访问。' });
    }

    const filePath = safeFilePath(root, url.pathname);
    if (!filePath) return sendJson(response, 403, { error: '路径无效' });

    try {
      const info = await stat(filePath);
      if (!info.isFile()) return sendJson(response, 404, { error: '文件不存在' });
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600'
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(filePath).pipe(response);
    } catch {
      sendJson(response, 404, { error: '文件不存在' });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      console.log(`LovePhone web: http://${host}:${port}`);
      resolve(server);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startStaticServer({
    root: process.env.LOVEPHONE_APP_ROOT || process.cwd()
  });
}
