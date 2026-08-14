import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPhoneRuntime } from './build-phone-runtime.mjs';
import { cacheBustWebBuild } from './cache-bust-build.mjs';

const root = process.cwd();
const output = path.join(root, 'dist');
const buildVersion = `${Date.now()}`;

async function readLocalEnvironment() {
  const file = path.join(root, '.env.production.local');
  let source = '';
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return Object.fromEntries(source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=');
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      return [key, value];
    }));
}

function gateway(value) {
  const input = String(value || '').trim().replace(/\/+$/, '');
  if (!input) return '';
  const url = new URL(input);
  if (url.protocol !== 'https:') throw new Error(`Deployment gateway must use HTTPS: ${input}`);
  return url.toString().replace(/\/+$/, '');
}

const publicBuild = process.env.LOVEPHONE_PUBLIC_BUILD === '1';
const localEnvironment = publicBuild ? {} : await readLocalEnvironment();
const runtimeConfig = {
  aiGatewayUrl: gateway(publicBuild ? '' : process.env.LOVEPHONE_AI_GATEWAY_URL || localEnvironment.LOVEPHONE_AI_GATEWAY_URL),
  musicGatewayUrl: gateway(publicBuild ? '' : process.env.LOVEPHONE_MUSIC_GATEWAY_URL || localEnvironment.LOVEPHONE_MUSIC_GATEWAY_URL)
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const item of ['assets', 'src']) {
  await cp(path.join(root, item), path.join(output, item), { recursive: true });
}
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  await cp(path.join(root, item), path.join(output, item));
}
await buildPhoneRuntime({ root, output: path.join(output, 'assets', 'generated') });
await cacheBustWebBuild(output, buildVersion);
await writeFile(
  path.join(output, 'runtime-config.js'),
  `globalThis.__LOVE_PHONE_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(runtimeConfig)});\n`,
  'utf8'
);
console.log(`LovePhone web build: ${output} (version: ${buildVersion}, AI gateway: ${runtimeConfig.aiGatewayUrl ? 'configured' : 'not configured'}, music gateway: ${runtimeConfig.musicGatewayUrl ? 'configured' : 'not configured'})`);
