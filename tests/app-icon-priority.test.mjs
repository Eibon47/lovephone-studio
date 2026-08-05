import test from 'node:test';
import assert from 'node:assert/strict';

import { getAppIcon } from '../src/system/appAppearance.js';

const app = { id: 'chat', icon: 'chat' };
const appUpload = 'data:image/png;base64,YXBw';
const themeUpload = 'data:image/png;base64,dGhlbWU=';
const packUpload = 'data:image/png;base64,cGFjaw==';

function configWith(iconMode = 'upload') {
  return {
    theme: {
      appLooks: {
        chat: { icon: { mode: iconMode, value: appUpload } }
      },
      customization: {
        active: { iconPack: true },
        iconPack: { icons: { chat: packUpload } },
        appThemes: { chat: { icon: themeUpload } }
      }
    }
  };
}

test('an App-specific upload overrides the whole-phone icon pack', () => {
  assert.equal(getAppIcon(configWith('upload'), app), appUpload);
});

test('the icon pack remains the fallback when no App-specific icon exists', () => {
  const config = configWith('preset');
  config.theme.customization.appThemes.chat.icon = '';
  assert.equal(getAppIcon(config, app), packUpload);
});

test('an imported App theme icon overrides the whole-phone icon pack', () => {
  assert.equal(getAppIcon(configWith('preset'), app), themeUpload);
});
