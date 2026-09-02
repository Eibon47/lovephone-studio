import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterApp } from '../src/apps/CharacterApp.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';

test('WeChat-style character list only shows real controls and uses the full-page list class', () => {
  const config = cloneConfig(defaultConfig);
  config.theme.appLooks.character = {
    ...(config.theme.appLooks.character || {}),
    uiTheme: 'wechat'
  };
  config.characters = [{ ...config.character, name: '重复角色' }];
  const html = CharacterApp.render({ id: 'character', name: '角色' }, config, {
    characterView: 'list'
  });
  assert.match(html, /character-list-view/);
  assert.match(html, /<h3>角色<\/h3>/);
  assert.match(html, /data-character-add/);
  assert.doesNotMatch(html, /新的角色/);
  assert.doesNotMatch(html, /角色分组/);
  assert.doesNotMatch(html, />标签</);
  assert.doesNotMatch(html, />通讯录</);
  assert.equal((html.match(/>当前</g) || []).length, 1);
});
