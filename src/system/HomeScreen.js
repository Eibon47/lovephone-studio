import { getEnabledApps } from './appRegistry.js?v=app-config-93';
import { escapeHtml } from './html.js';
import { getAppIcon } from './appAppearance.js?v=app-config-71';
import { safeUploadedImage } from './icons.js?v=app-config-61';
import { renderStatusBar } from './StatusBar.js';
import { WIDGET_IDS } from './widgetCatalog.js';
import { activeCharacter, localDateKey } from '../apps/appData.js?v=app-config-40';
import {
  findGreeting,
  greetingPeriodFor
} from '../services/greetingService.js?v=app-config-45';
import {
  primaryAnniversary
} from '../services/anniversaryService.js?v=app-config-44';
import { renderCustomWidgets } from './customWidgetRuntime.js?v=app-config-100';
import { phoneSetupProgress, shouldShowPhoneSetup } from '../services/phoneSetupService.js?v=app-config-1';
import { collectPhoneNotifications } from '../services/phoneNotificationService.js?v=app-config-1';
import { characterPresence } from '../services/characterPresenceService.js?v=app-config-1';

const defaultLayouts = {
  clock: { x: 0, y: 0, w: 4, h: 2 },
  weather: { x: 0, y: 2, w: 2, h: 2 },
  vinyl: { x: 0, y: 2, w: 2, h: 2 },
  photo: { x: 2, y: 2, w: 2, h: 2 },
  calendar: { x: 2, y: 2, w: 2, h: 2 },
  anniversary: { x: 0, y: 4, w: 2, h: 2 },
  characterStatus: { x: 0, y: 4, w: 4, h: 2 },
  dailyNote: { x: 0, y: 6, w: 4, h: 2 },
  mood: { x: 0, y: 6, w: 2, h: 2 },
  quickActions: { x: 2, y: 6, w: 2, h: 2 }
};

function layoutAttrs(layout) {
  return `gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}"`;
}

function widgetLayoutAttrs(id, widget = {}) {
  return layoutAttrs({ ...defaultLayouts[id], ...(widget.layout || {}) });
}

function defaultAppLayout(index) {
  return {
    x: index % 4,
    y: 4 + Math.floor(index / 4) * 2,
    w: 1,
    h: 2
  };
}

function appIconHtml(app, currentApp, config) {
  const icon = getAppIcon(config, app);
  const uploadedClass = /^data:image\//i.test(icon) ? ' is-uploaded' : '';
  const activeClass = currentApp === app.id ? ' active' : '';
  return `
    <button class="phone-app${activeClass}" type="button" data-open-app="${app.id}" aria-label="${escapeHtml(app.name)}">
      <span class="phone-app-icon${uploadedClass}"><img src="${icon}" alt="" /></span>
      <span class="phone-app-name">${escapeHtml(app.name)}</span>
    </button>
  `;
}

function gridItem(id, widget, content) {
  return `
    <div class="grid-stack-item" data-widget-id="${id}" ${widgetLayoutAttrs(id, widget)}>
      <div class="grid-stack-item-content">
        ${content}
      </div>
    </div>
  `;
}

function appGridItem(app, currentApp, index, config) {
  const layout = {
    ...defaultAppLayout(index),
    ...(config.theme?.appLayouts?.[app.id] || {})
  };
  return `
    <div class="grid-stack-item desktop-app-item" data-app-layout-id="${app.id}" data-open-app="${app.id}" ${layoutAttrs(layout)}>
      <div class="grid-stack-item-content">
        ${appIconHtml(app, currentApp, config)}
      </div>
    </div>
  `;
}

function renderClockWidget(widget) {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  return gridItem('clock', widget, `
    <article class="desktop-widget desktop-widget-clock">
      <div class="widget-clock-main">
        <strong data-widget-clock-time>${escapeHtml(time)}</strong>
        <span data-widget-clock-date>${escapeHtml(date)}</span>
      </div>
      <small>${escapeHtml(widget.subtitle || '保持一点点靠近')}</small>
    </article>
  `);
}

function renderVinylWidget(widget, osState) {
  const track = osState.musicTrack;
  const playback = osState.musicPlayback || {};
  const playing = playback.status === 'playing' || osState.musicPlaying;
  const duration = Number(playback.duration) || (Number(track?.duration) || 0) / 1000;
  const position = Number(playback.position) || 0;
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;
  const cover = track?.cover || safeUploadedImage(widget.image);
  return gridItem('vinyl', widget, `
    <article class="desktop-widget desktop-widget-vinyl">
      <button class="desktop-widget-dismiss" type="button" data-widget-dismiss="vinyl" aria-label="关闭唱片机组件" title="关闭">×</button>
      <button class="vinyl-disc ${playing ? 'is-playing' : ''}" type="button" data-widget-open-app="music" aria-label="打开音乐">
        ${cover ? `<img data-vinyl-cover src="${escapeHtml(cover)}" alt="" />` : '<span data-vinyl-cover></span>'}
      </button>
      <div class="vinyl-copy">
        <button class="vinyl-open" type="button" data-widget-open-app="music">
          <small data-vinyl-artist>${escapeHtml(track?.artist || '网易云音乐')}</small>
          <strong data-vinyl-title>${escapeHtml(track?.name || widget.title || '选择一首歌')}</strong>
        </button>
        <div class="music-controls">
          <button type="button" data-vinyl-control="prev" aria-label="上一首">‹</button>
          <button class="vinyl-play-toggle" type="button" data-vinyl-control="toggle" aria-label="${playing ? '暂停' : '播放'}">${playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" data-vinyl-control="next" aria-label="下一首">›</button>
        </div>
      </div>
      <span class="vinyl-progress"><i data-vinyl-progress style="width:${progress}%"></i></span>
    </article>
  `);
}

function renderPhotoWidget(widget) {
  const image = safeUploadedImage(widget.image);
  return gridItem('photo', widget, `
    <article class="desktop-widget desktop-widget-photo">
      ${image
        ? `<img src="${image}" alt="" />`
        : '<div class="photo-placeholder"><i></i><b>我们的回忆</b></div>'}
      <span>${escapeHtml(widget.title || '今日照片')}</span>
      <button class="photo-widget-edit" type="button" data-photo-widget-upload aria-label="更换照片" title="更换照片">＋</button>
      <input class="photo-widget-input" type="file" accept="image/*" data-photo-widget-input />
    </article>
  `);
}

function renderWeatherWidget(widget) {
  return gridItem('weather', widget, `
    <article class="desktop-widget desktop-widget-weather" data-weather-live>
      <div class="weather-heading"><span>${escapeHtml(widget.city || '上海')}</span><i data-weather-icon>☀</i></div>
      <strong data-weather-temperature>${escapeHtml(widget.temperature || '24°')}</strong>
      <small data-weather-condition>${escapeHtml(widget.condition || '晴间多云')} · 20° / 27°</small>
      <em class="weather-source">Open-Meteo</em>
    </article>
  `);
}

function renderCalendarWidget(widget, config) {
  const now = new Date();
  const day = now.getDate();
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  return gridItem('calendar', widget, `
    <article class="desktop-widget desktop-widget-calendar" data-widget-open-app="${config.apps?.diary?.enabled ? 'diary' : 'character'}">
      <header><span>${escapeHtml(widget.title || `${now.getMonth() + 1}月`)}</span><small>星期${week}</small></header>
      <strong>${day}</strong>
      <div class="calendar-dots"><i></i><i></i><i></i><i></i><i></i></div>
    </article>
  `);
}

function renderAnniversaryWidget(widget, config) {
  const primary = primaryAnniversary(config.apps?.anniversary?.events || []);
  const event = primary?.event;
  const metrics = primary?.metrics;
  const future = metrics && metrics.daysSince < 0;
  const days = metrics
    ? (future ? Math.abs(metrics.daysSince) : metrics.daysSince)
    : Math.max(0, Number(widget.days) || 365);
  return gridItem('anniversary', widget, `
    <article class="desktop-widget desktop-widget-anniversary" data-widget-open-app="anniversary">
      <span class="anniversary-heart">♥</span>
      <small>${escapeHtml(event?.title || widget.title || '我们认识')}</small>
      <em>${future ? '还有' : '已经'}</em>
      <strong>${days}<b>天</b></strong>
      <i class="anniversary-line"></i>
    </article>
  `);
}

function renderCharacterStatusWidget(widget, config, osState) {
  const character = activeCharacter(config, osState);
  const characterName = character?.name || '小满';
  const presence = characterPresence(config, character, osState);
  const initial = [...characterName][0] || '伴';
  return gridItem('characterStatus', widget, `
    <article class="desktop-widget desktop-widget-character" data-widget-open-app="character">
      <span class="character-widget-avatar">${escapeHtml(initial)}<i></i></span>
      <div><small>${escapeHtml(characterName)} · ${escapeHtml(presence.label)}</small><strong>${escapeHtml(widget.status || presence.detail || '正在陪伴')}</strong></div>
      <span class="character-widget-wave"><i></i><i></i><i></i><i></i><i></i></span>
    </article>
  `);
}

function renderDailyNoteWidget(widget, config, osState) {
  const character = activeCharacter(config, osState);
  const greetingCharacterId = config.apps?.goodnight?.useCurrentCharacter ? character.id : 'system';
  const currentGreeting = findGreeting(config, {
    date: localDateKey(),
    period: greetingPeriodFor(),
    characterId: greetingCharacterId
  });
  const latestGreeting = (config.apps?.goodnight?.greetings || [])
    .find(item => item.characterId === greetingCharacterId);
  const latest = (config.apps?.goodnight?.entries || [])
    .find(item => (item.characterId || config.character.id) === character.id);
  const greeting = currentGreeting || latestGreeting;
  const text = config.apps?.goodnight?.desktopNote
    ? greeting?.message || latest?.message || latest?.note || widget.text || '今天也会好好陪着你。'
    : widget.text || '今天也会好好陪着你。';
  const author = greeting?.characterName || character?.name || '小满';
  return gridItem('dailyNote', widget, `
    <article class="desktop-widget desktop-widget-note" data-widget-open-app="${config.apps?.goodnight?.enabled ? 'goodnight' : 'chat'}">
      <span class="note-mark">“</span>
      <div>
        <strong>${escapeHtml(text)}</strong>
        <small>来自 ${escapeHtml(author)}</small>
      </div>
    </article>
  `);
}

function renderMoodWidget(widget, config) {
  const character = activeCharacter(config);
  const savedScores = (config.apps?.diary?.entries || [])
    .filter(entry => (entry.characterId || config.character.id) === character.id)
    .slice(0, 7)
    .map(entry => Math.max(10, Math.min(100, Number(entry.moodScore) || 50)))
    .reverse();
  const bars = [...Array(Math.max(0, 7 - savedScores.length)).fill(35), ...savedScores];
  const latestScore = savedScores.at(-1);
  const label = latestScore >= 75 ? '很好' : latestScore >= 50 ? '平静' : latestScore ? '需要关心' : '待记录';
  return gridItem('mood', widget, `
    <article class="desktop-widget desktop-widget-mood" data-widget-open-app="${config.apps?.diary?.enabled ? 'diary' : 'character'}">
      <header><span>${escapeHtml(widget.title || '这周心情')}</span><b>${label}</b></header>
      <div class="mood-bars">${bars.map((value, index) => `<i style="--mood:${value}%"${index === 5 ? ' class="active"' : ''}></i>`).join('')}</div>
      <small>一 二 三 四 五 六 日</small>
    </article>
  `);
}

function renderQuickActionsWidget(widget) {
  return gridItem('quickActions', widget, `
    <article class="desktop-widget desktop-widget-actions">
      <header>${escapeHtml(widget.title || '快捷互动')}<span>•••</span></header>
      <div class="quick-action-grid">
        <button type="button" data-widget-open-app="chat"><i>✦</i><small>聊天</small></button>
        <button type="button" data-widget-open-app="chat"><i>♪</i><small>语音</small></button>
        <button type="button" data-widget-open-app="diary"><i>＋</i><small>日记</small></button>
        <button type="button" data-widget-open-app="character"><i>♡</i><small>戳戳</small></button>
      </div>
    </article>
  `);
}

const widgetRenderers = {
  clock: (widget, config) => renderClockWidget(widget, config),
  weather: (widget, config) => renderWeatherWidget(widget, config),
  vinyl: (widget, config, osState) => renderVinylWidget(widget, osState),
  photo: (widget, config) => renderPhotoWidget(widget, config),
  calendar: (widget, config) => renderCalendarWidget(widget, config),
  anniversary: (widget, config) => renderAnniversaryWidget(widget, config),
  characterStatus: (widget, config, osState) => renderCharacterStatusWidget(widget, config, osState),
  dailyNote: (widget, config, osState) => renderDailyNoteWidget(widget, config, osState),
  mood: (widget, config) => renderMoodWidget(widget, config),
  quickActions: (widget, config) => renderQuickActionsWidget(widget, config)
};

function renderWidgetItems(config, osState) {
  const widgets = config.theme?.widgets || {};
  return WIDGET_IDS
    .map(id => {
      const enabled = widgets[id]?.enabled
        || (id === 'dailyNote' && config.apps?.goodnight?.enabled && config.apps.goodnight.desktopNote);
      const appEnabled = enabled
        || (id === 'anniversary' && config.apps?.anniversary?.enabled && config.apps.anniversary.desktopWidget);
      return appEnabled ? widgetRenderers[id]?.(widgets[id] || {}, config, osState) : '';
    })
    .filter(Boolean)
    .join('');
}

function renderDesktopGrid(config, apps, currentApp, osState) {
  const widgetItems = renderWidgetItems(config, osState);
  const customWidgetItems = renderCustomWidgets(config, osState);
  const appItems = apps
    .map((app, index) => appGridItem(app, currentApp, index, config))
    .join('');

  return `
    <div class="desktop-grid grid-stack" data-desktop-grid>
      ${widgetItems}
      ${customWidgetItems}
      ${appItems}
    </div>
  `;
}

function renderPhoneSetup(config, osState) {
  if (!shouldShowPhoneSetup(config, osState)) return '';
  const progress = phoneSetupProgress(config, osState);
  const item = (id, title, description, action, target) => `
    <li class="phone-setup-item ${progress.completed[id] ? 'is-done' : ''}">
      <span aria-hidden="true">${progress.completed[id] ? '✓' : ''}</span>
      <div><strong>${title}</strong><small>${description}</small></div>
      ${progress.completed[id]
        ? '<b>已完成</b>'
        : `<button type="button" data-phone-setup-action="${action}" data-phone-setup-target="${target}">去完成</button>`}
    </li>
  `;

  return `
    <section class="phone-setup-card" aria-label="开始使用小手机">
      <header>
        <span><small>开始使用</small><strong>把这台小手机准备好</strong></span>
        <button type="button" data-phone-setup-dismiss aria-label="暂时收起开始使用">×</button>
      </header>
      <p>完成这三件事后，就可以放心把它当作自己的小手机来使用。</p>
      <ol>
        ${item('character', '确认角色', '名字、称呼和角色设定', 'open', 'character')}
        ${item('ai', '连接 AI', '填写自己的服务商、Key 和模型', 'open', 'settings')}
        ${item('backup', '创建备份', '为聊天和陪伴数据留一份副本', 'backup', 'settings')}
      </ol>
      <footer>${progress.completedCount}/3 已完成</footer>
    </section>
  `;
}

function renderNotificationCenter(config, osState) {
  const notices = collectPhoneNotifications(config);
  if (!osState.notificationCenterOpen) return '';
  return `
    <section class="phone-notice-center" aria-label="今日消息">
      <header><strong>今日消息</strong><button type="button" data-phone-notice-toggle aria-label="收起通知">×</button></header>
      ${notices.length ? `<div>${notices.map(item => `
        <button type="button" data-phone-notice-open="${item.appId}" data-phone-notice-character="${escapeHtml(item.characterId || '')}">
          <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span><i>›</i>
        </button>
      `).join('')}</div>` : '<p>今天还没有新的陪伴消息。</p>'}
    </section>
  `;
}

export function renderHomeScreen(config, osState) {
  const apps = getEnabledApps(config, osState.runtimeCapabilities, osState.customApps);
  const dockApps = apps.filter(app => app.dock).slice(0, 4);
  const notificationCount = collectPhoneNotifications(config).length;

  return `
    <section class="phone-screen phone-home">
      ${renderStatusBar('', { showNotifications: true, notificationCount })}
      ${renderNotificationCenter(config, osState)}
      ${renderPhoneSetup(config, osState)}
      ${renderDesktopGrid(config, apps, osState.currentApp, osState)}
      <div class="phone-dock">
        ${dockApps.map(app => appIconHtml(app, osState.currentApp, config)).join('')}
      </div>
    </section>
  `;
}
