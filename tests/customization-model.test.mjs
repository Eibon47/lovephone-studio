import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOM_WIDGET_ACTIONS,
  CUSTOM_WIDGET_SOURCES,
  CUSTOM_WIDGET_TEMPLATES,
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_APP_MEDIA,
  DEFAULT_CHAT_APPEARANCE,
  DEFAULT_COMPANION_APPEARANCE,
  DEFAULT_MEMORY_APPEARANCE,
  DEFAULT_MUSIC_APPEARANCE,
  DEFAULT_SETTINGS_APPEARANCE,
  DEFAULT_CUSTOMIZATION,
  createCustomWidgetFromTemplate,
  normalizeCharacterAppearance,
  normalizeAppMedia,
  normalizeChatAppearance,
  normalizeCompanionAppearance,
  normalizeMemoryAppearance,
  normalizeMusicAppearance,
  normalizeSettingsAppearance,
  normalizeCustomization,
  validateCustomCss,
  validateCustomWidgetCode
} from '../src/services/customizationModel.js';

test('normalization supplies a complete customization model', () => {
  const result = normalizeCustomization();
  assert.deepEqual(result, DEFAULT_CUSTOMIZATION);
  assert.notEqual(result, DEFAULT_CUSTOMIZATION);
});

test('numeric values are clamped and unknown fields are removed', () => {
  const result = normalizeCustomization({
    tokens: { radius: 999, opacity: -3, unknown: 'remove-me' },
    phoneShell: { frameWidth: 0 },
    desktop: { columns: 99 }
  });
  assert.equal(result.tokens.radius, 32);
  assert.equal(result.tokens.opacity, 40);
  assert.equal(result.phoneShell.frameWidth, 2);
  assert.equal(result.desktop.columns, 6);
  assert.equal('unknown' in result.tokens, false);
});

test('icons only accept local raster image data URLs', () => {
  const safeImage = 'data:image/png;base64,iVBORw0KGgo=';
  const result = normalizeCustomization({
    iconPack: {
      icons: {
        chat: safeImage,
        remote: 'https://example.com/icon.png',
        vector: 'data:image/svg+xml;base64,PHN2Zz4='
      }
    }
  });
  assert.equal(result.iconPack.icons.chat, safeImage);
  assert.equal('remote' in result.iconPack.icons, false);
  assert.equal('vector' in result.iconPack.icons, false);
});

test('custom CSS rejects network, markup and executable CSS', () => {
  assert.equal(validateCustomCss('.app-title { color: #123456; }').valid, true);
  assert.equal(validateCustomCss('@import "https://example.com/a.css";').valid, false);
  assert.equal(validateCustomCss('.x { background: url(https://example.com/a.png); }').valid, false);
  assert.equal(validateCustomCss('</style><script>alert(1)</script>').valid, false);
  assert.equal(validateCustomCss('.x { width: expression(alert(1)); }').valid, false);
});

test('widgets only keep whitelisted sources and actions', () => {
  const result = normalizeCustomization({
    widgets: [{
      id: 'weather-card',
      dataSource: 'apiKey',
      action: 'runJavascript',
      type: 'html'
    }, {
      id: 'music-card',
      dataSource: 'music',
      action: 'musicNext',
      type: 'progress'
    }]
  });
  assert.equal(result.widgets[0].dataSource, 'time');
  assert.equal(result.widgets[0].action, 'none');
  assert.equal(result.widgets[0].type, 'text');
  assert.equal(CUSTOM_WIDGET_SOURCES.includes(result.widgets[1].dataSource), true);
  assert.equal(CUSTOM_WIDGET_ACTIONS.includes(result.widgets[1].action), true);
});

test('invalid app CSS is dropped while safe variables remain', () => {
  const result = normalizeCustomization({
    appThemes: {
      chat: {
        enabled: true,
        variables: {
          accent: '#334455',
          bad: 'red; position: fixed',
          remote: 'url(https://example.com/a.png)'
        },
        css: '.chat { background-image: url(//tracker.example/a); }',
        secret: 'remove-me'
      }
    }
  });
  assert.equal(result.appThemes.chat.enabled, true);
  assert.equal(result.appThemes.chat.variables.accent, '#334455');
  assert.equal('bad' in result.appThemes.chat.variables, false);
  assert.equal('remote' in result.appThemes.chat.variables, false);
  assert.equal(result.appThemes.chat.css, '');
  assert.equal('secret' in result.appThemes.chat, false);
});

test('chat appearance has complete defaults and clamps unsafe values', () => {
  const result = normalizeChatAppearance({
    enabled: true,
    overall: { contentPadding: 200, headerAlign: 'floating' },
    list: { avatarSize: 2, showArrow: false },
    bubbles: { maxWidth: 120, tail: 'sharp', incomingBackground: 'red' },
    composer: { height: 12, floating: true }
  });
  assert.equal(result.enabled, true);
  assert.equal(result.overall.contentPadding, 30);
  assert.equal(result.overall.headerAlign, DEFAULT_CHAT_APPEARANCE.overall.headerAlign);
  assert.equal(result.list.avatarSize, 36);
  assert.equal(result.list.showArrow, false);
  assert.equal(result.bubbles.maxWidth, 92);
  assert.equal(result.bubbles.tail, 'sharp');
  assert.equal(result.bubbles.incomingBackground, DEFAULT_CHAT_APPEARANCE.bubbles.incomingBackground);
  assert.equal(result.composer.height, 42);
  assert.equal(result.composer.floating, true);
});

test('chat app themes preserve structured chat appearance without affecting other apps', () => {
  const result = normalizeCustomization({
    appThemes: {
      chat: { enabled: true, chat: { enabled: true, bubbles: { outgoingRadius: 5 } } },
      diary: { enabled: true, chat: { enabled: true } }
    }
  });
  assert.equal(result.appThemes.chat.chat.enabled, true);
  assert.equal(result.appThemes.chat.chat.bubbles.outgoingRadius, 5);
  assert.equal('chat' in result.appThemes.diary, false);
});

test('character appearance has complete defaults and clamps layout values', () => {
  const result = normalizeCharacterAppearance({
    enabled: true,
    overall: { contentPadding: 2, headerAlign: 'floating' },
    list: { rowHeight: 200, avatarSize: 4, showMeta: false },
    detail: { profileAvatarSize: 100, fieldRadius: 99, showTools: false }
  });
  assert.equal(result.enabled, true);
  assert.equal(result.overall.contentPadding, 10);
  assert.equal(result.overall.headerAlign, DEFAULT_CHARACTER_APPEARANCE.overall.headerAlign);
  assert.equal(result.list.rowHeight, 104);
  assert.equal(result.list.avatarSize, 30);
  assert.equal(result.list.showMeta, false);
  assert.equal(result.detail.profileAvatarSize, 76);
  assert.equal(result.detail.fieldRadius, 24);
  assert.equal(result.detail.showTools, false);
});

test('character app themes preserve character details only for the character app', () => {
  const result = normalizeCustomization({
    appThemes: {
      character: { enabled: true, character: { enabled: true, list: { rowHeight: 88 } } },
      settings: { enabled: true, character: { enabled: true } }
    }
  });
  assert.equal(result.appThemes.character.character.enabled, true);
  assert.equal(result.appThemes.character.character.list.rowHeight, 88);
  assert.equal('character' in result.appThemes.settings, false);
});

test('settings appearance has complete defaults and clamps layout values', () => {
  const result = normalizeSettingsAppearance({
    enabled: true,
    overall: { contentPadding: 2, headerAlign: 'floating', showProfilePrelude: false },
    groups: { headerHeight: 200, iconSize: 4, radius: 99 },
    controls: { rowHeight: 2, fieldRadius: 99, showSecurityNotes: false }
  });
  assert.equal(result.enabled, true);
  assert.equal(result.overall.contentPadding, 10);
  assert.equal(result.overall.headerAlign, DEFAULT_SETTINGS_APPEARANCE.overall.headerAlign);
  assert.equal(result.overall.showProfilePrelude, false);
  assert.equal(result.groups.headerHeight, 84);
  assert.equal(result.groups.iconSize, 24);
  assert.equal(result.groups.radius, 30);
  assert.equal(result.controls.rowHeight, 40);
  assert.equal(result.controls.fieldRadius, 20);
  assert.equal(result.controls.showSecurityNotes, false);
});

test('settings app themes preserve settings details only for the settings app', () => {
  const result = normalizeCustomization({
    appThemes: {
      settings: { enabled: true, settings: { enabled: true, groups: { headerHeight: 74 } } },
      memory: { enabled: true, settings: { enabled: true } }
    }
  });
  assert.equal(result.appThemes.settings.settings.enabled, true);
  assert.equal(result.appThemes.settings.settings.groups.headerHeight, 74);
  assert.equal('settings' in result.appThemes.memory, false);
});

test('memory appearance has complete defaults and clamps layout values', () => {
  const result = normalizeMemoryAppearance({
    enabled: true,
    overall: { contentPadding: 2, headerAlign: 'floating', showSearch: false },
    editor: { radius: 99, fieldRadius: 99 },
    cards: { gap: 99, tagRadius: 99, showActions: false }
  });
  assert.equal(result.enabled, true);
  assert.equal(result.overall.contentPadding, 10);
  assert.equal(result.overall.headerAlign, DEFAULT_MEMORY_APPEARANCE.overall.headerAlign);
  assert.equal(result.overall.showSearch, false);
  assert.equal(result.editor.radius, 30);
  assert.equal(result.editor.fieldRadius, 20);
  assert.equal(result.cards.gap, 24);
  assert.equal(result.cards.tagRadius, 24);
  assert.equal(result.cards.showActions, false);
});

test('memory app themes preserve memory details only for the memory app', () => {
  const result = normalizeCustomization({
    appThemes: {
      memory: { enabled: true, memory: { enabled: true, cards: { radius: 22 } } },
      diary: { enabled: true, memory: { enabled: true } }
    }
  });
  assert.equal(result.appThemes.memory.memory.enabled, true);
  assert.equal(result.appThemes.memory.memory.cards.radius, 22);
  assert.equal('memory' in result.appThemes.diary, false);
});

test('music appearance has complete defaults and clamps player dimensions', () => {
  const result = normalizeMusicAppearance({
    enabled: true,
    overall: { contentPadding: 2, headerAlign: 'floating' },
    home: { shortcutSize: 4, trackRowHeight: 120, showHero: false },
    mini: { height: 20, radius: 99 },
    player: { recordSize: 500, coverSize: 20, stageHeight: 900, showNeedle: false }
  });
  assert.equal(result.enabled, true);
  assert.equal(result.overall.contentPadding, 10);
  assert.equal(result.overall.headerAlign, DEFAULT_MUSIC_APPEARANCE.overall.headerAlign);
  assert.equal(result.home.shortcutSize, 30);
  assert.equal(result.home.trackRowHeight, 78);
  assert.equal(result.home.showHero, false);
  assert.equal(result.mini.height, 52);
  assert.equal(result.mini.radius, 24);
  assert.equal(result.player.recordSize, 260);
  assert.equal(result.player.coverSize, 90);
  assert.equal(result.player.stageHeight, 310);
  assert.equal(result.player.showNeedle, false);
});

test('music app themes preserve music details only for the music app', () => {
  const result = normalizeCustomization({
    appThemes: {
      music: { enabled: true, music: { enabled: true, player: { recordSize: 230 } } },
      diary: { enabled: true, music: { enabled: true } }
    }
  });
  assert.equal(result.appThemes.music.music.enabled, true);
  assert.equal(result.appThemes.music.music.player.recordSize, 230);
  assert.equal('music' in result.appThemes.diary, false);
});

test('companion appearance clamps shared diary, anniversary and goodnight values', () => {
  const result = normalizeCompanionAppearance({
    enabled: true,
    overall: { contentPadding: 2, headerAlign: 'floating', showDecorations: false },
    editor: { radius: 99, fieldRadius: 99 },
    cards: { gap: 99, radius: 99, showExtraPanels: false }
  });
  assert.equal(result.enabled, true);
  assert.equal(result.overall.contentPadding, 10);
  assert.equal(result.overall.headerAlign, DEFAULT_COMPANION_APPEARANCE.overall.headerAlign);
  assert.equal(result.overall.showDecorations, false);
  assert.equal(result.editor.radius, 30);
  assert.equal(result.editor.fieldRadius, 20);
  assert.equal(result.cards.gap, 24);
  assert.equal(result.cards.radius, 30);
  assert.equal(result.cards.showExtraPanels, false);
});

test('shared companion appearance is preserved only by its three supported apps', () => {
  const result = normalizeCustomization({
    appThemes: {
      diary: { enabled: true, companion: { enabled: true, cards: { radius: 20 } } },
      anniversary: { enabled: true, companion: { enabled: true } },
      goodnight: { enabled: true, companion: { enabled: true } },
      chat: { enabled: true, companion: { enabled: true } }
    }
  });
  assert.equal(result.appThemes.diary.companion.cards.radius, 20);
  assert.equal(result.appThemes.anniversary.companion.enabled, true);
  assert.equal(result.appThemes.goodnight.companion.enabled, true);
  assert.equal('companion' in result.appThemes.chat, false);
});

test('App media only accepts local images and known display modes', () => {
  const image = 'data:image/png;base64,AAAA';
  const media = normalizeAppMedia({
    backgroundImage: image,
    backgroundFit: 'stretch',
    backgroundPosition: 'left',
    primaryButtonImage: 'https://example.com/button.png',
    primaryButtonMode: 'replace',
    primaryButtonFit: 'contain',
    backButtonImage: image
  });
  assert.equal(media.backgroundImage, image);
  assert.equal(media.backgroundFit, DEFAULT_APP_MEDIA.backgroundFit);
  assert.equal(media.backgroundPosition, DEFAULT_APP_MEDIA.backgroundPosition);
  assert.equal(media.primaryButtonImage, '');
  assert.equal(media.primaryButtonMode, 'replace');
  assert.equal(media.primaryButtonFit, 'contain');
  assert.equal(media.backButtonImage, image);
});

test('every App theme keeps an independent media collection', () => {
  const image = 'data:image/webp;base64,AAAA';
  const result = normalizeCustomization({
    appThemes: {
      chat: { enabled: true, media: { backgroundImage: image } },
      diary: { enabled: true, media: { primaryButtonImage: image } }
    }
  });
  assert.equal(result.appThemes.chat.media.backgroundImage, image);
  assert.equal(result.appThemes.chat.media.primaryButtonImage, '');
  assert.equal(result.appThemes.diary.media.backgroundImage, '');
  assert.equal(result.appThemes.diary.media.primaryButtonImage, image);
});

test('the widget studio exposes ten editable templates with stable defaults', () => {
  assert.equal(CUSTOM_WIDGET_TEMPLATES.length, 10);
  const ids = new Set(CUSTOM_WIDGET_TEMPLATES.map(template => template.id));
  assert.equal(ids.size, 10);
  for (const [index, template] of CUSTOM_WIDGET_TEMPLATES.entries()) {
    const widget = createCustomWidgetFromTemplate(template.id, index, `template-${index}`);
    assert.equal(widget.templateId, template.id);
    assert.equal(widget.layout.w, template.size[0]);
    assert.equal(widget.layout.h, template.size[1]);
    assert.equal(widget.code.dataPermissions.includes('activeCharacter'), true);
  }
});

test('sandbox widget code rejects network, storage and parent-page access', () => {
  const safe = validateCustomWidgetCode({
    html: '<button data-open>打开</button>',
    css: 'button { color: #123456; }',
    js: "document.querySelector('[data-open]').addEventListener('click', () => widget.openChat())"
  });
  assert.equal(safe.valid, true);
  assert.equal(validateCustomWidgetCode({ js: "fetch('https://example.com')" }).valid, false);
  assert.equal(validateCustomWidgetCode({ js: "localStorage.getItem('secret')" }).valid, false);
  assert.equal(validateCustomWidgetCode({ js: 'parent.document.body.innerHTML = ""' }).valid, false);
  assert.equal(validateCustomWidgetCode({ html: '<iframe src="https://example.com"></iframe>' }).valid, false);
});

test('normalization preserves safe sandbox permissions and drops unsafe code', () => {
  const result = normalizeCustomization({
    widgets: [{
      id: 'code-card',
      mode: 'code',
      code: {
        html: '<div>安全</div>',
        css: 'div { color: #123456; }',
        js: "widget.openApp('chat')",
        dataPermissions: ['weather', 'apiKey'],
        actionPermissions: ['openApp', 'runJavascript']
      }
    }, {
      id: 'bad-code-card',
      mode: 'code',
      code: { js: "fetch('https://example.com')" }
    }]
  });
  assert.equal(result.widgets[0].code.html, '<div>安全</div>');
  assert.deepEqual(result.widgets[0].code.dataPermissions, ['weather']);
  assert.deepEqual(result.widgets[0].code.actionPermissions, ['openApp']);
  assert.equal(result.widgets[1].code.js, '');
});
