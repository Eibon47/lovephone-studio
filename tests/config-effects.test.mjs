import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultConfig } from '../src/config/defaultConfig.js';
import { buildChatSystemPrompt } from '../src/apps/ChatApp.js';
import { MemoryApp } from '../src/apps/MemoryApp.js';
import { DiaryApp } from '../src/apps/DiaryApp.js';
import { GoodnightApp } from '../src/apps/GoodnightApp.js';
import { MusicApp } from '../src/apps/MusicApp.js';
import { SettingsApp } from '../src/apps/SettingsApp.js';
import { renderAppSelectionPanel } from '../src/builder/AppSelectionPanel.js';

function configCopy() {
  return structuredClone(defaultConfig);
}

test('long-term memory controls whether role memories enter the AI prompt', () => {
  const config = configCopy();
  config.apps.memory.enabled = true;
  config.apps.memory.entries = [{
    id: 'memory-one',
    characterId: config.character.id,
    title: '饮品偏好',
    content: '喜欢无糖咖啡'
  }];

  config.apps.memory.longTerm = false;
  assert.doesNotMatch(buildChatSystemPrompt(config, config.character), /无糖咖啡/);
  config.apps.memory.longTerm = true;
  assert.match(buildChatSystemPrompt(config, config.character), /无糖咖啡/);
});

test('memory type and view switches change the rendered memory app', () => {
  const config = configCopy();
  config.apps.memory.enabled = true;
  config.apps.memory.userEditable = true;
  config.apps.memory.visibleCards = false;
  config.apps.memory.types = ['preferences'];
  config.apps.memory.entries = [{
    id: 'auto-memory',
    characterId: config.character.id,
    type: 'preferences',
    title: '偏好',
    content: '喜欢安静',
    date: '2026-08-06',
    source: 'chat-auto'
  }];
  const html = MemoryApp.render({ name: '记忆' }, config, {});

  assert.match(html, /memory-list is-compact/);
  assert.match(html, /value="preferences"/);
  assert.doesNotMatch(html, /value="relationship"/);
  assert.match(html, /来自聊天自动记录/);
});

test('diary mood switch removes mood controls and uses a neutral fallback', () => {
  const config = configCopy();
  config.apps.diary.enabled = true;
  config.apps.diary.moodTags = false;
  const html = DiaryApp.render({ name: '日记' }, config, {});

  assert.doesNotMatch(html, /mood-picker/);
  assert.doesNotMatch(html, /name="mood"/);
});

test('diary and night records render only for the active character', () => {
  const config = configCopy();
  config.characters = [{
    ...structuredClone(config.character),
    id: 'character-second',
    name: '第二角色'
  }];
  config.apps.character.activeCharacterId = 'character-second';
  config.apps.diary.entries = [
    { id: 'main-diary', characterId: config.character.id, date: '2026-07-23', title: '主角色日记', content: '主角色内容', mood: 'calm' },
    { id: 'second-diary', characterId: 'character-second', date: '2026-07-24', title: '第二角色日记', content: '第二角色内容', mood: 'good' }
  ];
  config.apps.goodnight.entries = [
    { id: 'main-night', characterId: config.character.id, date: '2026-07-23', note: '主角色夜晚', mood: 'calm', routine: [], message: '主角色晚安' },
    { id: 'second-night', characterId: 'character-second', date: '2026-07-24', note: '第二角色夜晚', mood: 'good', routine: [], message: '第二角色晚安' }
  ];

  const diary = DiaryApp.render({ name: '日记' }, config, {});
  const night = GoodnightApp.render({ name: '晚安' }, config, {});
  assert.match(diary, /第二角色日记/);
  assert.doesNotMatch(diary, /主角色日记/);
  assert.match(night, /第二角色夜晚/);
  assert.doesNotMatch(night, /主角色夜晚/);
});

test('music recommendation and lyric switches remove those surfaces', () => {
  const config = configCopy();
  config.apps.music.showRecommendations = false;
  config.apps.music.showLyrics = false;
  const discover = MusicApp.render({ name: '音乐' }, config, {
    musicView: 'discover',
    musicHome: {
      daily: [{ id: 'song', encryptedId: 'song', name: '歌', artist: '人', playable: true }],
      created: []
    }
  });
  const player = MusicApp.render({ name: '音乐' }, config, {
    musicView: 'player',
    musicTrack: { id: 'song', name: '歌', artist: '人', album: '专辑', duration: 1000 }
  });

  assert.doesNotMatch(discover, /每日推荐/);
  assert.doesNotMatch(discover, /听歌排行/);
  assert.doesNotMatch(player, /data-music-player-tab/);
});

test('local music library exposes a removable device-only track', () => {
  const config = configCopy();
  const html = MusicApp.render({ name: '音乐' }, config, {
    musicView: 'library',
    musicLocalTracks: [{ id: 'local-1', source: 'local', name: '本地歌', artist: '我', album: '音乐库', playable: true }]
  });
  assert.match(html, /data-music-delete-local="local-1"/);
});

test('settings section switches hide optional surfaces but keep data management available', () => {
  const config = configCopy();
  config.apps.settings.themeControls = false;
  config.apps.settings.apiProfiles = false;
  config.apps.settings.exportImport = false;
  const categories = SettingsApp.render({ id: 'settings', name: '设置' }, config, {});
  const appearance = SettingsApp.render({ id: 'settings', name: '设置' }, config, { settingsPage: 'appearance' });
  const services = SettingsApp.render({ id: 'settings', name: '设置' }, config, { settingsPage: 'services' });
  const data = SettingsApp.render({ id: 'settings', name: '设置' }, config, { settingsPage: 'data' });

  assert.match(categories, /外观与显示/);
  assert.match(categories, /备份与安全/);
  assert.match(appearance, /外观控制已在工坊中关闭/);
  assert.doesNotMatch(services, /AI 与模型/);
  assert.match(data, /数据与备份/);
  assert.match(data, /重置整台小手机/);
});

test('builder does not advertise unimplemented voice calling or autoplay', () => {
  const config = configCopy();
  assert.doesNotMatch(
    renderAppSelectionPanel(config, { appConfigId: 'character' }),
    /启用角色语音入口/
  );
  assert.doesNotMatch(
    renderAppSelectionPanel(config, { appConfigId: 'music' }),
    /自动播放/
  );
});
