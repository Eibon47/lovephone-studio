import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LOCAL_MODULE_PATTERN = /(['"])(\.\.?\/[^'"\r\n]+\.js)(?:\?[^'"\r\n]*)?\1/g;

export function cacheBustModuleSource(source, version) {
  return String(source).replace(
    LOCAL_MODULE_PATTERN,
    (_match, quote, modulePath) => `${quote}${modulePath}?v=${version}${quote}`
  );
}

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
  }));
  return files.flat();
}

export async function cacheBustWebBuild(output, version) {
  const srcDirectory = path.join(output, 'src');
  const files = await javascriptFiles(srcDirectory);
  await Promise.all(files.map(async file => {
    const source = await readFile(file, 'utf8');
    await writeFile(file, cacheBustModuleSource(source, version), 'utf8');
  }));

  const indexPath = path.join(output, 'index.html');
  const index = await readFile(indexPath, 'utf8');
  await writeFile(
    indexPath,
    index.replace(/src\/main\.js(?:\?[^"']*)?/g, `src/main.js?v=${version}`),
    'utf8'
  );

  const serviceWorkerPath = path.join(output, 'sw.js');
  const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
  await writeFile(
    serviceWorkerPath,
    serviceWorker.replace(
      /const CACHE_NAME = ['"][^'"]+['"];/,
      `const CACHE_NAME = 'lovephone-shell-${version}';`
    ),
    'utf8'
  );
}
