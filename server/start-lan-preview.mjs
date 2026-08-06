import { startStaticServer } from './static-server.mjs';

// This is intentionally web-only: the local AI bridge keeps credentials on
// this computer and must not be exposed to every device on the Wi-Fi network.
await startStaticServer({
  host: '0.0.0.0',
  port: Number(process.env.LOVEPHONE_LAN_PORT || 5178)
});
