import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCustomizationRuntime,
  scopeCustomCss
} from '../src/system/customizationRuntime.js';

test('runtime exposes validated CSS variables', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        tokens: { accent: '#225588', radius: 20 },
        desktop: { columns: 5 },
        appThemes: {
          chat: {
            enabled: true,
            variables: { accent: '#119977' }
          }
        }
      }
    }
  }, 'chat');
  assert.match(runtime.style, /--custom-accent:#225588/);
  assert.match(runtime.style, /--custom-radius:20px/);
  assert.match(runtime.style, /--custom-desktop-columns:5/);
  assert.match(runtime.style, /--custom-app-accent:#119977/);
});

test('phone CSS is scoped and cannot reach the builder', () => {
  const scoped = scopeCustomCss(
    '.phone-screen, .app-top { color: #112233; }',
    '.phone-frame'
  );
  assert.equal(
    scoped,
    '.phone-frame .phone-screen, .phone-frame .app-top { color: #112233; }'
  );
  assert.doesNotMatch(scoped, /^\.phone-screen/);
});

test('App CSS is restricted to one current App', () => {
  const scoped = scopeCustomCss(
    '.app-top { background: #ffffff; }',
    '.phone-frame[data-current-app="chat"]'
  );
  assert.match(scoped, /^\.phone-frame\[data-current-app="chat"\] \.app-top/);
  assert.doesNotMatch(scoped, /character/);
});

test('unsupported nested rules and unsafe scope are dropped', () => {
  assert.equal(scopeCustomCss('@media (min-width: 1px) { .x { color: red; } }', '.phone-frame'), '');
  assert.equal(scopeCustomCss('.x { color: red; }', 'body'), '');
});

test('chat appearance exposes scoped variables and visibility classes', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          chat: {
            enabled: true,
            chat: {
              enabled: true,
              overall: { headerAlign: 'right' },
              list: { showRelationship: false, showArrow: false },
              bubbles: { outgoingBackground: '#123456', showAvatar: false, tail: 'soft' },
              composer: { floating: true, showQuickReplies: false }
            }
          }
        }
      }
    }
  }, 'chat');
  assert.match(runtime.style, /--chat-outgoing-bg:#123456/);
  assert.equal(runtime.classes.includes('custom-chat-appearance'), true);
  assert.equal(runtime.classes.includes('chat-header-align-right'), true);
  assert.equal(runtime.classes.includes('chat-hide-list-relationship'), true);
  assert.equal(runtime.classes.includes('chat-hide-list-arrow'), true);
  assert.equal(runtime.classes.includes('chat-hide-message-avatar'), true);
  assert.equal(runtime.classes.includes('chat-bubble-tail-soft'), true);
  assert.equal(runtime.classes.includes('chat-floating-composer'), true);
  assert.equal(runtime.classes.includes('chat-hide-quick-replies'), true);
});

test('chat appearance never leaks into another app runtime', () => {
  const config = {
    theme: {
      customization: {
        appThemes: {
          chat: { enabled: true, chat: { enabled: true } }
        }
      }
    }
  };
  const runtime = getCustomizationRuntime(config, 'diary');
  assert.equal(runtime.classes.includes('custom-chat-appearance'), false);
  assert.doesNotMatch(runtime.style, /--chat-/);
});

test('character appearance exposes list, detail and visibility controls', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          character: {
            enabled: true,
            character: {
              enabled: true,
              overall: { headerAlign: 'left' },
              list: { rowHeight: 92, showMeta: false },
              detail: { profileBackground: '#112233', showTools: false, showTags: false }
            }
          }
        }
      }
    }
  }, 'character');
  assert.match(runtime.style, /--character-row-height:92px/);
  assert.match(runtime.style, /--character-profile-bg:#112233/);
  assert.equal(runtime.classes.includes('custom-character-appearance'), true);
  assert.equal(runtime.classes.includes('character-header-align-left'), true);
  assert.equal(runtime.classes.includes('character-hide-list-meta'), true);
  assert.equal(runtime.classes.includes('character-hide-tools'), true);
  assert.equal(runtime.classes.includes('character-hide-tags'), true);
});

test('character appearance never leaks into chat runtime', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          character: { enabled: true, character: { enabled: true } }
        }
      }
    }
  }, 'chat');
  assert.equal(runtime.classes.includes('custom-character-appearance'), false);
  assert.doesNotMatch(runtime.style, /--character-/);
});

test('settings appearance exposes group, control and visibility values', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          settings: {
            enabled: true,
            settings: {
              enabled: true,
              overall: { headerAlign: 'right', showProfilePrelude: false },
              groups: { headerHeight: 78, iconBackground: '#123456' },
              controls: { rowHeight: 66, fieldRadius: 16, showSecurityNotes: false }
            }
          }
        }
      }
    }
  }, 'settings');
  assert.match(runtime.style, /--settings-group-header-height:78px/);
  assert.match(runtime.style, /--settings-icon-bg:#123456/);
  assert.match(runtime.style, /--settings-row-height:66px/);
  assert.match(runtime.style, /--settings-field-radius:16px/);
  assert.equal(runtime.classes.includes('custom-settings-appearance'), true);
  assert.equal(runtime.classes.includes('settings-header-align-right'), true);
  assert.equal(runtime.classes.includes('settings-hide-profile-prelude'), true);
  assert.equal(runtime.classes.includes('settings-hide-security-notes'), true);
});

test('settings appearance never leaks into another app runtime', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          settings: { enabled: true, settings: { enabled: true } }
        }
      }
    }
  }, 'memory');
  assert.equal(runtime.classes.includes('custom-settings-appearance'), false);
  assert.doesNotMatch(runtime.style, /--settings-/);
});

test('memory appearance exposes editor, card and visibility values', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          memory: {
            enabled: true,
            memory: {
              enabled: true,
              overall: { headerAlign: 'left', showSearch: false },
              editor: { fieldRadius: 16, accent: '#123456' },
              cards: { gap: 18, radius: 24, showDate: false, showActions: false }
            }
          }
        }
      }
    }
  }, 'memory');
  assert.match(runtime.style, /--memory-field-radius:16px/);
  assert.match(runtime.style, /--memory-accent:#123456/);
  assert.match(runtime.style, /--memory-card-gap:18px/);
  assert.match(runtime.style, /--memory-card-radius:24px/);
  assert.equal(runtime.classes.includes('custom-memory-appearance'), true);
  assert.equal(runtime.classes.includes('memory-header-align-left'), true);
  assert.equal(runtime.classes.includes('memory-hide-search'), true);
  assert.equal(runtime.classes.includes('memory-hide-date'), true);
  assert.equal(runtime.classes.includes('memory-hide-actions'), true);
});

test('memory appearance never leaks into another app runtime', () => {
  const runtime = getCustomizationRuntime({
    theme: {
      customization: {
        appThemes: {
          memory: { enabled: true, memory: { enabled: true } }
        }
      }
    }
  }, 'diary');
  assert.equal(runtime.classes.includes('custom-memory-appearance'), false);
  assert.doesNotMatch(runtime.style, /--memory-/);
});

test('music appearance exposes home, mini-player and player values', () => {
  const runtime = getCustomizationRuntime({
    theme: { customization: { appThemes: { music: {
      enabled: true,
      music: {
        enabled: true,
        overall: { headerAlign: 'right' },
        home: { trackRowHeight: 70, showHero: false },
        mini: { height: 76, showTime: false },
        player: { recordSize: 230, coverSize: 140, showNeedle: false, showVolume: false }
      }
    } } } }
  }, 'music');
  assert.match(runtime.style, /--music-track-height:70px/);
  assert.match(runtime.style, /--music-mini-height:76px/);
  assert.match(runtime.style, /--music-record-size:230px/);
  assert.match(runtime.style, /--music-record-cover-size:140px/);
  assert.equal(runtime.classes.includes('custom-music-appearance'), true);
  assert.equal(runtime.classes.includes('music-header-align-right'), true);
  assert.equal(runtime.classes.includes('music-hide-hero'), true);
  assert.equal(runtime.classes.includes('music-hide-mini-time'), true);
  assert.equal(runtime.classes.includes('music-hide-needle'), true);
  assert.equal(runtime.classes.includes('music-hide-volume'), true);
});

test('music appearance never leaks into another app runtime', () => {
  const runtime = getCustomizationRuntime({
    theme: { customization: { appThemes: { music: { enabled: true, music: { enabled: true } } } } }
  }, 'chat');
  assert.equal(runtime.classes.includes('custom-music-appearance'), false);
  assert.doesNotMatch(runtime.style, /--music-custom-|--music-record-/);
});

test('shared companion appearance is scoped to diary, anniversary and goodnight', () => {
  const config = {
    theme: { customization: { appThemes: {
      diary: { enabled: true, companion: { enabled: true, editor: { radius: 22 }, cards: { showActions: false } } },
      anniversary: { enabled: true, companion: { enabled: true, overall: { showDecorations: false } } },
      goodnight: { enabled: true, companion: { enabled: true, cards: { showExtraPanels: false } } }
    } } }
  };
  const diary = getCustomizationRuntime(config, 'diary');
  const anniversary = getCustomizationRuntime(config, 'anniversary');
  const goodnight = getCustomizationRuntime(config, 'goodnight');
  const chat = getCustomizationRuntime(config, 'chat');
  assert.match(diary.style, /--companion-editor-radius:22px/);
  assert.equal(diary.classes.includes('companion-hide-actions'), true);
  assert.equal(anniversary.classes.includes('companion-hide-decorations'), true);
  assert.equal(goodnight.classes.includes('companion-hide-extra-panels'), true);
  assert.equal(chat.classes.includes('custom-companion-appearance'), false);
  assert.doesNotMatch(chat.style, /--companion-/);
});

test('App media exposes local image variables and never leaks to another App', () => {
  const image = 'data:image/png;base64,AAAA';
  const config = {
    theme: { customization: { appThemes: {
      chat: {
        enabled: true,
        media: {
          backgroundImage: image,
          backgroundFit: 'tile',
          backgroundPosition: 'top',
          primaryButtonImage: image,
          primaryButtonMode: 'replace',
          primaryButtonFit: 'contain',
          backButtonImage: image
        }
      }
    } } }
  };
  const chat = getCustomizationRuntime(config, 'chat');
  const diary = getCustomizationRuntime(config, 'diary');
  assert.match(chat.style, /--custom-app-background-image:url\('data:image\/png;base64,AAAA'\)/);
  assert.match(chat.style, /--custom-app-background-repeat:repeat/);
  assert.match(chat.style, /--custom-app-primary-button-fit:contain/);
  assert.equal(chat.classes.includes('custom-app-background-image'), true);
  assert.equal(chat.classes.includes('custom-app-primary-button-replace'), true);
  assert.equal(chat.classes.includes('custom-app-back-button-image'), true);
  assert.doesNotMatch(diary.style, /--custom-app-(?:background|primary|back)-button?-?image/);
  assert.equal(diary.classes.includes('custom-app-background-image'), false);
});
