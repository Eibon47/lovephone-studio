import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

export async function buildPhoneRuntime(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const output = path.resolve(options.output || path.join(root, 'assets', 'generated'));
  await mkdir(output, { recursive: true });

  await build({
    absWorkingDir: root,
    entryPoints: ['src/main.js'],
    outfile: path.join(output, 'phone-runtime.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome100', 'safari15.4', 'firefox100'],
    minify: true,
    legalComments: 'none',
    charset: 'utf8'
  });

  const cssFiles = [
    'assets/vendor/gridstack/gridstack.min.css',
    'src/styles/base.css',
    'src/styles/builder.css',
    'src/styles/phone-system.css'
  ];
  const css = (await Promise.all(cssFiles.map(file => readFile(path.join(root, file), 'utf8')))).join('\n');
  await writeFile(path.join(output, 'phone-runtime.css'), css, 'utf8');
  await writeFile(
    path.join(output, 'phone-vendor.js'),
    await readFile(path.join(root, 'assets/vendor/gridstack/gridstack-all.js'), 'utf8'),
    'utf8'
  );
  return output;
}

if (process.argv[1]?.endsWith('build-phone-runtime.mjs')) {
  await buildPhoneRuntime();
}
