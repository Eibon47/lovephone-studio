import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('phone exports use safe-area aware mobile fullscreen without changing desktop preview', async () => {
  const [html, baseCss, phoneCss] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/styles/base.css', root), 'utf8'),
    readFile(new URL('src/styles/phone-system.css', root), 'utf8')
  ]);

  assert.match(html, /viewport-fit=cover/);
  assert.match(baseCss, /@media \(max-width: 600px\) and \(pointer: coarse\)/);
  assert.match(phoneCss, /\.standalone-phone-shell \.phone-frame\s*{[\s\S]*?width: 100vw;[\s\S]*?height: 100dvh;/);
  assert.match(phoneCss, /\.standalone-phone-shell \.phone-frame \.phone-screen\s*{[\s\S]*?safe-area-inset-top/);
});

test('touch tablet landscape keeps a readable phone preview and allows scrolling', async () => {
  const css = await readFile(new URL('src/styles/base.css', root), 'utf8');

  assert.match(css, /@media \(min-width: 981px\) and \(max-width: 1366px\) and \(pointer: coarse\)/);
  assert.match(css, /\.preview-pane \.phone-frame\s*{[\s\S]*?width: clamp\(280px,/);
  assert.match(css, /\.preview-pane\s*{[\s\S]*?overflow: auto;/);
});

test('the simulated dynamic island is removed on every device', async () => {
  const css = await readFile(new URL('src/styles/phone-system.css', root), 'utf8');

  assert.match(css, /\.dynamic-island\s*{\s*display: none;\s*}/);
  assert.match(css, /\.phone-screen\s*{[\s\S]*?padding: 24px 22px;/);
});
