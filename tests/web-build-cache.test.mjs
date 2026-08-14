import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheBustModuleSource } from '../server/cache-bust-build.mjs';

test('web builds give every local JavaScript module one deployment version', () => {
  const source = `
    import { one } from './one.js';
    import { two } from '../two.js?v=old';
    import { zip } from '../../assets/vendor/zip.js';
  `;

  const output = cacheBustModuleSource(source, 'release-42');

  assert.match(output, /'\.\/one\.js\?v=release-42'/);
  assert.match(output, /'\.\.\/two\.js\?v=release-42'/);
  assert.match(output, /'\.\.\/\.\.\/assets\/vendor\/zip\.js\?v=release-42'/);
  assert.doesNotMatch(output, /v=old/);
});
