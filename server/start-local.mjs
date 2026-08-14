import './ai-bridge.mjs';
import { buildPhoneRuntime } from './build-phone-runtime.mjs';
import { startStaticServer } from './static-server.mjs';

const root = process.env.LOVEPHONE_APP_ROOT || process.cwd();

await buildPhoneRuntime({ root });
await startStaticServer({ root });
