import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const item of ['assets', 'src']) {
  await cp(path.join(root, item), path.join(output, item), { recursive: true });
}
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  await cp(path.join(root, item), path.join(output, item));
}
console.log(`LovePhone web build: ${output}`);
