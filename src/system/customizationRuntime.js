import {
  normalizeCustomization,
  validateCustomCss
} from '../services/customizationModel.js?v=app-config-83';

const SAFE_APP_ID = /^[a-zA-Z0-9_-]{1,80}$/;

function cssVariableName(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function styleValue(value) {
  return String(value).replace(/[;"'<>]/g, '');
}

function imageVariableValue(value) {
  return `url('${value}')`;
}

function scopeSelectors(selectorText, scope) {
  return selectorText
    .split(',')
    .map(selector => selector.trim())
    .filter(Boolean)
    .map(selector => {
      if (selector === '.phone-frame' || selector.startsWith('.phone-frame ')) {
        return `${scope}${selector.slice('.phone-frame'.length)}`;
      }
      return `${scope} ${selector}`;
    })
    .join(', ');
}

export function scopeCustomCss(css, scope) {
  const checked = validateCustomCss(css);
  if (!checked.valid || !checked.css) return '';
  if (!/^\.phone-frame(?:\[data-current-app="[a-zA-Z0-9_-]+"\])?$/.test(scope)) return '';

  const output = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  let consumed = '';
  while ((match = pattern.exec(checked.css))) {
    consumed += match[0];
    const selectors = match[1].trim();
    const declarations = match[2].trim();
    if (!selectors || !declarations || selectors.startsWith('@')) return '';
    output.push(`${scopeSelectors(selectors, scope)} { ${declarations} }`);
  }
  const compactSource = checked.css.replace(/\s+/g, '');
  const compactConsumed = consumed.replace(/\s+/g, '');
  return compactSource === compactConsumed ? output.join('\n') : '';
}

export function getCustomizationRuntime(config, currentApp = 'home') {
  const customization = normalizeCustomization(config.theme?.customization);
  const tokens = customization.tokens;
  const shell = customization.phoneShell;
  const desktop = customization.desktop;
  const variables = {
    '--custom-background': tokens.background,
    '--custom-surface': tokens.surface,
    '--custom-text': tokens.text,
    '--custom-muted': tokens.muted,
    '--custom-secondary': tokens.secondary,
    '--custom-accent': tokens.accent,
    '--custom-danger': tokens.danger,
    '--custom-radius': `${tokens.radius}px`,
    '--custom-border-width': `${tokens.borderWidth}px`,
    '--custom-shadow': `${tokens.shadow}px`,
    '--custom-opacity': tokens.opacity / 100,
    '--custom-spacing': `${tokens.spacing}px`,
    '--custom-font-size': `${tokens.fontSize}px`,
    '--custom-frame-color': shell.frameColor,
    '--custom-frame-width': `${shell.frameWidth}px`,
    '--custom-phone-radius': `${shell.radius}px`,
    '--custom-screen-inset': `${shell.screenInset}px`,
    '--custom-island-width': `${shell.islandWidth}px`,
    '--custom-island-height': `${shell.islandHeight}px`,
    '--custom-indicator-width': `${shell.indicatorWidth}px`,
    '--custom-desktop-columns': desktop.columns,
    '--custom-desktop-gap': `${desktop.gap}px`,
    '--custom-icon-size': `${desktop.iconSize}px`,
    '--custom-label-size': `${desktop.labelSize}px`,
    '--custom-dock-opacity': desktop.dockOpacity / 100
  };

  const appId = SAFE_APP_ID.test(currentApp) ? currentApp : 'home';
  const appTheme = customization.appThemes[appId];
  if (appTheme?.enabled) {
    Object.entries(appTheme.variables).forEach(([key, value]) => {
      variables[`--custom-app-${cssVariableName(key)}`] = styleValue(value);
    });
    if (appTheme.media.backgroundImage) {
      variables['--custom-app-background-image'] = imageVariableValue(appTheme.media.backgroundImage);
      variables['--custom-app-background-size'] = appTheme.media.backgroundFit === 'tile'
        ? 'auto'
        : appTheme.media.backgroundFit;
      variables['--custom-app-background-repeat'] = appTheme.media.backgroundFit === 'tile'
        ? 'repeat'
        : 'no-repeat';
      variables['--custom-app-background-position'] = appTheme.media.backgroundPosition;
    }
    if (appTheme.media.primaryButtonImage) {
      variables['--custom-app-primary-button-image'] = imageVariableValue(appTheme.media.primaryButtonImage);
      variables['--custom-app-primary-button-fit'] = appTheme.media.primaryButtonFit;
    }
    if (appTheme.media.backButtonImage) {
      variables['--custom-app-back-button-image'] = imageVariableValue(appTheme.media.backButtonImage);
    }
  }

  const chat = appId === 'chat' && appTheme?.enabled && appTheme.chat?.enabled
    ? appTheme.chat
    : null;
  if (chat) {
    Object.assign(variables, {
      '--chat-page-bg': chat.overall.pageBackground,
      '--chat-conversation-bg': chat.overall.conversationBackground,
      '--chat-header-bg': chat.overall.headerBackground,
      '--chat-header-text': chat.overall.headerText,
      '--chat-content-padding': `${chat.overall.contentPadding}px`,
      '--chat-list-row-height': `${chat.list.rowHeight}px`,
      '--chat-list-avatar-size': `${chat.list.avatarSize}px`,
      '--chat-list-avatar-radius': `${chat.list.avatarRadius}px`,
      '--chat-list-divider': chat.list.divider,
      '--chat-list-name': chat.list.nameColor,
      '--chat-list-summary': chat.list.summaryColor,
      '--chat-list-meta': chat.list.metaColor,
      '--chat-bubble-max-width': `${chat.bubbles.maxWidth}%`,
      '--chat-message-gap': `${chat.bubbles.messageGap}px`,
      '--chat-message-avatar-size': `${chat.bubbles.avatarSize}px`,
      '--chat-message-avatar-radius': `${chat.bubbles.avatarRadius}px`,
      '--chat-incoming-bg': chat.bubbles.incomingBackground,
      '--chat-incoming-text': chat.bubbles.incomingText,
      '--chat-incoming-radius': `${chat.bubbles.incomingRadius}px`,
      '--chat-outgoing-bg': chat.bubbles.outgoingBackground,
      '--chat-outgoing-text': chat.bubbles.outgoingText,
      '--chat-outgoing-radius': `${chat.bubbles.outgoingRadius}px`,
      '--chat-bubble-padding-x': `${chat.bubbles.paddingX}px`,
      '--chat-bubble-padding-y': `${chat.bubbles.paddingY}px`,
      '--chat-composer-bg': chat.composer.background,
      '--chat-input-bg': chat.composer.inputBackground,
      '--chat-input-text': chat.composer.text,
      '--chat-composer-accent': chat.composer.accent,
      '--chat-composer-radius': `${chat.composer.radius}px`,
      '--chat-composer-height': `${chat.composer.height}px`,
      '--chat-quick-bg': chat.composer.quickReplyBackground,
      '--chat-quick-text': chat.composer.quickReplyText,
      '--chat-quick-radius': `${chat.composer.quickReplyRadius}px`
    });
  }

  const character = appId === 'character' && appTheme?.enabled && appTheme.character?.enabled
    ? appTheme.character
    : null;
  if (character) {
    Object.assign(variables, {
      '--character-page-bg': character.overall.pageBackground,
      '--character-header-bg': character.overall.headerBackground,
      '--character-header-text': character.overall.headerText,
      '--character-content-padding': `${character.overall.contentPadding}px`,
      '--character-section-gap': `${character.overall.sectionGap}px`,
      '--character-list-bg': character.list.containerBackground,
      '--character-list-radius': `${character.list.containerRadius}px`,
      '--character-row-height': `${character.list.rowHeight}px`,
      '--character-list-avatar-size': `${character.list.avatarSize}px`,
      '--character-list-avatar-radius': `${character.list.avatarRadius}px`,
      '--character-list-divider': character.list.divider,
      '--character-list-name': character.list.nameColor,
      '--character-list-summary': character.list.summaryColor,
      '--character-list-meta': character.list.metaColor,
      '--character-list-active': character.list.activeBackground,
      '--character-profile-bg': character.detail.profileBackground,
      '--character-profile-text': character.detail.profileText,
      '--character-profile-muted': character.detail.profileMuted,
      '--character-profile-radius': `${character.detail.profileRadius}px`,
      '--character-profile-avatar-size': `${character.detail.profileAvatarSize}px`,
      '--character-profile-avatar-radius': `${character.detail.profileAvatarRadius}px`,
      '--character-section-bg': character.detail.sectionBackground,
      '--character-section-radius': `${character.detail.sectionRadius}px`,
      '--character-field-bg': character.detail.fieldBackground,
      '--character-field-text': character.detail.fieldText,
      '--character-field-radius': `${character.detail.fieldRadius}px`,
      '--character-detail-accent': character.detail.accent,
      '--character-action-radius': `${character.detail.actionRadius}px`,
      '--character-tag-bg': character.detail.tagBackground,
      '--character-tag-text': character.detail.tagText,
      '--character-tag-radius': `${character.detail.tagRadius}px`
    });
  }

  const settings = appId === 'settings' && appTheme?.enabled && appTheme.settings?.enabled
    ? appTheme.settings
    : null;
  if (settings) {
    Object.assign(variables, {
      '--settings-page-bg': settings.overall.pageBackground,
      '--settings-header-bg': settings.overall.headerBackground,
      '--settings-header-text': settings.overall.headerText,
      '--settings-content-padding': `${settings.overall.contentPadding}px`,
      '--settings-section-gap': `${settings.overall.sectionGap}px`,
      '--settings-group-bg': settings.groups.background,
      '--settings-group-radius': `${settings.groups.radius}px`,
      '--settings-group-border': settings.groups.border,
      '--settings-group-header-height': `${settings.groups.headerHeight}px`,
      '--settings-icon-bg': settings.groups.iconBackground,
      '--settings-icon-text': settings.groups.iconText,
      '--settings-icon-size': `${settings.groups.iconSize}px`,
      '--settings-icon-radius': `${settings.groups.iconRadius}px`,
      '--settings-title-text': settings.groups.titleText,
      '--settings-subtitle-text': settings.groups.subtitleText,
      '--settings-divider': settings.groups.divider,
      '--settings-row-height': `${settings.controls.rowHeight}px`,
      '--settings-label-text': settings.controls.labelText,
      '--settings-muted-text': settings.controls.mutedText,
      '--settings-field-bg': settings.controls.fieldBackground,
      '--settings-field-text': settings.controls.fieldText,
      '--settings-field-radius': `${settings.controls.fieldRadius}px`,
      '--settings-accent': settings.controls.accent,
      '--settings-button-bg': settings.controls.buttonBackground,
      '--settings-button-text': settings.controls.buttonText,
      '--settings-button-radius': `${settings.controls.buttonRadius}px`,
      '--settings-note-bg': settings.controls.noteBackground,
      '--settings-note-text': settings.controls.noteText
    });
  }

  const memory = appId === 'memory' && appTheme?.enabled && appTheme.memory?.enabled
    ? appTheme.memory
    : null;
  if (memory) {
    Object.assign(variables, {
      '--memory-page-bg': memory.overall.pageBackground,
      '--memory-header-bg': memory.overall.headerBackground,
      '--memory-header-text': memory.overall.headerText,
      '--memory-content-padding': `${memory.overall.contentPadding}px`,
      '--memory-section-gap': `${memory.overall.sectionGap}px`,
      '--memory-editor-bg': memory.editor.background,
      '--memory-editor-title': memory.editor.titleText,
      '--memory-editor-radius': `${memory.editor.radius}px`,
      '--memory-field-bg': memory.editor.fieldBackground,
      '--memory-field-text': memory.editor.fieldText,
      '--memory-field-radius': `${memory.editor.fieldRadius}px`,
      '--memory-accent': memory.editor.accent,
      '--memory-button-text': memory.editor.buttonText,
      '--memory-button-radius': `${memory.editor.buttonRadius}px`,
      '--memory-card-gap': `${memory.cards.gap}px`,
      '--memory-card-bg': memory.cards.background,
      '--memory-card-accent': memory.cards.borderAccent,
      '--memory-card-radius': `${memory.cards.radius}px`,
      '--memory-card-title': memory.cards.titleText,
      '--memory-card-body': memory.cards.bodyText,
      '--memory-card-meta': memory.cards.metaText,
      '--memory-tag-bg': memory.cards.tagBackground,
      '--memory-tag-text': memory.cards.tagText,
      '--memory-tag-radius': `${memory.cards.tagRadius}px`,
      '--memory-action-text': memory.cards.actionText
    });
  }

  const music = appId === 'music' && appTheme?.enabled && appTheme.music?.enabled
    ? appTheme.music
    : null;
  if (music) {
    Object.assign(variables, {
      '--music-custom-page-bg': music.overall.pageBackground,
      '--music-custom-header-text': music.overall.headerText,
      '--music-custom-accent': music.overall.accent,
      '--music-custom-padding': `${music.overall.contentPadding}px`,
      '--music-custom-gap': `${music.overall.sectionGap}px`,
      '--music-search-bg': music.home.searchBackground,
      '--music-search-text': music.home.searchText,
      '--music-search-radius': `${music.home.searchRadius}px`,
      '--music-hero-radius': `${music.home.heroRadius}px`,
      '--music-shortcut-bg': music.home.shortcutBackground,
      '--music-shortcut-text': music.home.shortcutText,
      '--music-shortcut-size': `${music.home.shortcutSize}px`,
      '--music-section-title': music.home.sectionTitle,
      '--music-muted-text': music.home.mutedText,
      '--music-cover-radius': `${music.home.coverRadius}px`,
      '--music-track-height': `${music.home.trackRowHeight}px`,
      '--music-divider': music.home.divider,
      '--music-mini-bg': music.mini.background,
      '--music-mini-text': music.mini.text,
      '--music-mini-muted': music.mini.mutedText,
      '--music-mini-radius': `${music.mini.radius}px`,
      '--music-mini-height': `${music.mini.height}px`,
      '--music-mini-progress-bg': music.mini.progressBackground,
      '--music-mini-progress-accent': music.mini.progressAccent,
      '--music-player-bg': music.player.background,
      '--music-player-text': music.player.text,
      '--music-player-muted': music.player.mutedText,
      '--music-player-accent': music.player.accent,
      '--music-record-size': `${music.player.recordSize}px`,
      '--music-record-cover-size': `${music.player.coverSize}px`,
      '--music-stage-height': `${music.player.stageHeight}px`,
      '--music-main-control-bg': music.player.mainControlBackground,
      '--music-main-control-text': music.player.mainControlText
    });
  }

  const companion = ['diary', 'anniversary', 'goodnight'].includes(appId)
    && appTheme?.enabled && appTheme.companion?.enabled
    ? appTheme.companion
    : null;
  if (companion) {
    Object.assign(variables, {
      '--companion-page-bg': companion.overall.pageBackground,
      '--companion-header-bg': companion.overall.headerBackground,
      '--companion-header-text': companion.overall.headerText,
      '--companion-content-padding': `${companion.overall.contentPadding}px`,
      '--companion-section-gap': `${companion.overall.sectionGap}px`,
      '--companion-editor-bg': companion.editor.background,
      '--companion-editor-title': companion.editor.titleText,
      '--companion-editor-radius': `${companion.editor.radius}px`,
      '--companion-field-bg': companion.editor.fieldBackground,
      '--companion-field-text': companion.editor.fieldText,
      '--companion-field-radius': `${companion.editor.fieldRadius}px`,
      '--companion-accent': companion.editor.accent,
      '--companion-button-text': companion.editor.buttonText,
      '--companion-button-radius': `${companion.editor.buttonRadius}px`,
      '--companion-card-bg': companion.cards.background,
      '--companion-card-accent': companion.cards.accent,
      '--companion-card-radius': `${companion.cards.radius}px`,
      '--companion-card-gap': `${companion.cards.gap}px`,
      '--companion-card-title': companion.cards.titleText,
      '--companion-card-body': companion.cards.bodyText,
      '--companion-card-meta': companion.cards.metaText,
      '--companion-action-text': companion.cards.actionText
    });
  }

  const style = Object.entries(variables)
    .map(([key, value]) => {
      const safeValue = [
        '--custom-app-background-image',
        '--custom-app-primary-button-image',
        '--custom-app-back-button-image'
      ].includes(key)
        ? value
        : styleValue(value);
      return `${key}:${safeValue}`;
    })
    .join(';');
  const globalCss = scopeCustomCss(customization.css, '.phone-frame');
  const appCss = appTheme?.enabled
    ? scopeCustomCss(appTheme.css, `.phone-frame[data-current-app="${appId}"]`)
    : '';

  const classes = Object.entries(customization.active)
    .filter(([, enabled]) => enabled)
    .map(([name]) => `custom-${name}`);
  if (appTheme?.enabled && appTheme.media.backgroundImage) {
    classes.push(
      'custom-app-background-image',
      `custom-app-background-${appTheme.media.backgroundFit}`,
      `custom-app-background-position-${appTheme.media.backgroundPosition}`
    );
  }
  if (appTheme?.enabled && appTheme.media.primaryButtonImage) {
    classes.push(
      'custom-app-primary-button-image',
      `custom-app-primary-button-${appTheme.media.primaryButtonMode}`
    );
  }
  if (appTheme?.enabled && appTheme.media.backButtonImage) {
    classes.push('custom-app-back-button-image');
  }
  if (chat) {
    classes.push(
      'custom-chat-appearance',
      `chat-header-align-${chat.overall.headerAlign}`,
      `chat-bubble-tail-${chat.bubbles.tail}`
    );
    if (!chat.list.showRelationship) classes.push('chat-hide-list-relationship');
    if (!chat.list.showArrow) classes.push('chat-hide-list-arrow');
    if (!chat.bubbles.showAvatar) classes.push('chat-hide-message-avatar');
    if (!chat.bubbles.showTime) classes.push('chat-hide-message-time');
    if (!chat.bubbles.showSessionTools) classes.push('chat-hide-session-tools');
    if (chat.composer.floating) classes.push('chat-floating-composer');
    if (!chat.composer.showQuickReplies) classes.push('chat-hide-quick-replies');
  }
  if (character) {
    classes.push(
      'custom-character-appearance',
      `character-header-align-${character.overall.headerAlign}`
    );
    if (!character.list.showStatus) classes.push('character-hide-list-status');
    if (!character.list.showMeta) classes.push('character-hide-list-meta');
    if (!character.detail.showStatus) classes.push('character-hide-detail-status');
    if (!character.detail.showTools) classes.push('character-hide-tools');
    if (!character.detail.showManagement) classes.push('character-hide-management');
    if (!character.detail.showTags) classes.push('character-hide-tags');
  }
  if (settings) {
    classes.push(
      'custom-settings-appearance',
      `settings-header-align-${settings.overall.headerAlign}`
    );
    if (!settings.overall.showProfilePrelude) classes.push('settings-hide-profile-prelude');
    if (!settings.controls.showSecurityNotes) classes.push('settings-hide-security-notes');
  }
  if (memory) {
    classes.push(
      'custom-memory-appearance',
      `memory-header-align-${memory.overall.headerAlign}`
    );
    if (!memory.overall.showSearch) classes.push('memory-hide-search');
    if (!memory.overall.showCount) classes.push('memory-hide-count');
    if (!memory.cards.showDate) classes.push('memory-hide-date');
    if (!memory.cards.showActions) classes.push('memory-hide-actions');
  }
  if (music) {
    classes.push(
      'custom-music-appearance',
      `music-header-align-${music.overall.headerAlign}`
    );
    if (!music.home.showHero) classes.push('music-hide-hero');
    if (!music.home.showShortcuts) classes.push('music-hide-shortcuts');
    if (!music.mini.showTime) classes.push('music-hide-mini-time');
    if (!music.player.showNeedle) classes.push('music-hide-needle');
    if (!music.player.showVolume) classes.push('music-hide-volume');
    if (!music.player.showQueue) classes.push('music-hide-queue');
  }
  if (companion) {
    classes.push('custom-companion-appearance', `companion-header-align-${companion.overall.headerAlign}`);
    if (!companion.overall.showHeaderMeta) classes.push('companion-hide-header-meta');
    if (!companion.overall.showDecorations) classes.push('companion-hide-decorations');
    if (!companion.cards.showActions) classes.push('companion-hide-actions');
    if (!companion.cards.showExtraPanels) classes.push('companion-hide-extra-panels');
  }

  return {
    customization,
    style,
    scopedCss: [globalCss, appCss].filter(Boolean).join('\n'),
    appThemeEnabled: Boolean(appTheme?.enabled),
    classes
  };
}
