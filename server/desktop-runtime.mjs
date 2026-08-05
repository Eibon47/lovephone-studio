import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startStaticServer } from './static-server.mjs';

const root = path.resolve(
  process.env.LOVEPHONE_APP_ROOT
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
);

await startStaticServer({
  root,
  host: '127.0.0.1',
  port: Number(process.env.LOVEPHONE_WEB_PORT || 5177),
  runtimeToken: process.env.LOVEPHONE_DESKTOP_INSTANCE_TOKEN || '',
  experimentalMusic: process.env.LOVEPHONE_EXPERIMENTAL_MUSIC === '1'
});
if (process.env.LOVEPHONE_EXPERIMENTAL_MUSIC === '1') {
  await import('./music-bridge.mjs');
}
await import('./ai-bridge.mjs');
