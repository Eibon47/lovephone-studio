import { getEnabledApps } from './appRegistry.js?v=app-config-93';
import { escapeHtml } from './html.js';
import { getAppIcon } from './appAppearance.js?v=app-config-71';
import { safeUploadedImage } from './icons.js?v=app-config-61';
import { renderStatusBar } from './StatusBar.js';
import { WIDGET_IDS } from './widgetCatalog.js?v=app-config-1';
import { activeCharacter } from '../apps/appData.js?v=app-config-40';
import {
  primaryAnniversary
} from '../services/anniversaryService.js?v=app-config-44';
import { getCustomWidgetEntries } from './customWidgetRuntime.js?v=app-config-106';
import { phoneSetupProgress, shouldShowPhoneSetup } from '../services/phoneSetupService.js?v=app-config-1';
import {
  collectPhoneNotifications,
  unreadNotificationsForApp,
  unreadPhoneNotificationCount
} from '../services/phoneNotificationService.js';
import { characterPresence } from '../services/characterPresenceService.js?v=app-config-1';

const defaultLayouts = {
  clock: { x: 0, y: 0, w: 4, h: 2 },
  weather: { x: 0, y: 2, w: 2, h: 2 },
  vinyl: { x: 0, y: 2, w: 2, h: 2 },
  photo: { x: 2, y: 2, w: 2, h: 2 },
  calendar: { x: 2, y: 2, w: 2, h: 2 },
  anniversary: { x: 0, y: 4, w: 2, h: 2 },
  characterStatus: { x: 0, y: 4, w: 4, h: 2 },
  mood: { x: 0, y: 6, w: 2, h: 2 },
  quickActions: { x: 2, y: 6, w: 2, h: 2 }
};

const DESKTOP_PAGE_ROWS = 50;

function layoutAttrs(layout) {
  return `gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}"`;
}

function widgetLayoutAttrs(id, widget = {}) {
  return layoutAttrs({ ...defaultLayouts[id], ...(widget.layout || {}) });
}

function defaultAppLayout(index, config) {
  const compositionGrid = Number(config.theme?.customization?.version) >= 3;
  const pageIndex = Math.floor(index / 8);
  const pageSlot = index % 8;
  return compositionGrid ? {
    x: (pageSlot % 4) * 3,
    y: pageIndex * DESKTOP_PAGE_ROWS + 24 + Math.floor(pageSlot / 4) * 6,
    w: 3,
    h: 6
  } : {
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
  const unreadCount = unreadNotificationsForApp(config, app.id);
  return `
    <button class="phone-app${activeClass}" type="button" data-open-app="${app.id}" aria-label="${escapeHtml(app.name)}">
      <span class="phone-app-icon${uploadedClass}"><img src="${icon}" alt="" /></span>
      ${unreadCount ? `<b class="phone-app-badge" aria-label="${unreadCount} 条未读消息">${Math.min(99, unreadCount)}</b>` : ''}
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

function appGridItem(app, currentApp, layout, config) {
  return `
    <div class="grid-stack-item desktop-app-item" gs-no-resize="true" data-app-layout-id="${app.id}" data-open-app="${app.id}" ${layoutAttrs(layout)}>
      <div class="grid-stack-item-content">
        ${appIconHtml(app, currentApp, config)}
      </div>
    </div>
  `;
}

function resolveDesktopAppLayouts(apps, config) {
  const slots = Array.from({ length: 8 }, (_, pageIndex) => [24, 30]
    .flatMap(y => [0, 3, 6, 9].map(x => ({ x, y: pageIndex * DESKTOP_PAGE_ROWS + y, w: 3, h: 6 }))))
    .flat();
  const used = [];
  const overlaps = layout => used.some(item => (
    layout.x < item.x + item.w && layout.x + layout.w > item.x
    && layout.y < item.y + item.h && layout.y + layout.h > item.y
  ));
  return apps.map((app, index) => {
    const saved = config.theme?.appLayouts?.[app.id] || defaultAppLayout(index, config);
    let layout = {
      x: Math.min(9, Math.max(0, Math.round(Number(saved.x) || 0))),
      y: Math.min(282, Math.max(0, Math.round(Number(saved.y) || 24))),
      w: 3,
      h: 6
    };
    if (overlaps(layout)) layout = slots.find(slot => !overlaps(slot)) || layout;
    used.push(layout);
    return { app, layout };
  });
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
  mood: (widget, config) => renderMoodWidget(widget, config),
  quickActions: (widget, config) => renderQuickActionsWidget(widget, config)
};

function getBuiltinWidgetEntries(config, osState) {
  const widgets = config.theme?.widgets || {};
  const migratedIds = new Set((config.theme?.customization?.widgets || []).map(widget => widget.id));
  return WIDGET_IDS
    .map(id => {
      if (migratedIds.has(`builtin-${id}`)) return null;
      const enabled = widgets[id]?.enabled;
      const appEnabled = enabled
        || (id === 'anniversary' && config.apps?.anniversary?.enabled && config.apps.anniversary.desktopWidget);
      if (!appEnabled || !widgetRenderers[id]) return null;
      const widget = widgets[id] || {};
      return {
        id,
        layout: { ...defaultLayouts[id], ...(widget.layout || {}) },
        render: layout => widgetRenderers[id]({ ...widget, layout }, config, osState)
      };
    })
    .filter(Boolean);
}

function overlaps(rect, occupied) {
  return occupied.some(item => (
    rect.x < item.x + item.w && rect.x + rect.w > item.x
    && rect.y < item.y + item.h && rect.y + rect.h > item.y
  ));
}

function findPagePosition(layout, occupied) {
  const w = Math.min(12, Math.max(2, Math.round(Number(layout.w) || 2)));
  const h = Math.min(24, Math.max(2, Math.round(Number(layout.h) || 2)));
  const preferredX = Math.min(12 - w, Math.max(0, Math.round(Number(layout.x) || 0)));
  const preferredY = Math.min(DESKTOP_PAGE_ROWS - h, Math.max(0, Math.round(Number(layout.y) || 0) % DESKTOP_PAGE_ROWS));
  const candidates = [{ x: preferredX, y: preferredY }];
  for (let y = 0; y <= DESKTOP_PAGE_ROWS - h; y += 1) {
    for (let x = 0; x <= 12 - w; x += 1) {
      if (x !== preferredX || y !== preferredY) candidates.push({ x, y });
    }
  }
  const position = candidates.find(candidate => !overlaps({ ...candidate, w, h }, occupied));
  return position ? { ...position, w, h } : null;
}

function paginateWidgetEntries(entries) {
  const pages = [];
  [...entries]
    .sort((a, b) => (Number(a.layout?.y) || 0) - (Number(b.layout?.y) || 0) || (Number(a.layout?.x) || 0) - (Number(b.layout?.x) || 0))
    .forEach(entry => {
      let pageIndex = Math.min(7, Math.max(0, Math.floor((Number(entry.layout?.y) || 0) / DESKTOP_PAGE_ROWS)));
      let placed = null;
      while (!placed && pageIndex < 8) {
        const page = pages[pageIndex] || (pages[pageIndex] = []);
        const layout = findPagePosition(entry.layout || {}, page.map(item => item.layout));
        if (layout) placed = { ...entry, layout, pageIndex };
        else pageIndex += 1;
      }
      if (!placed) return;
      pages[placed.pageIndex].push(placed);
    });
  return pages.length ? pages : [[]];
}

function renderDesktopGrid(config, apps, currentApp, osState) {
  const desktopApps = apps.filter(app => !app.dock);
  const appEntries = resolveDesktopAppLayouts(desktopApps, config).map(({ app, layout }) => ({
    id: `app-${app.id}`,
    layout,
    render: localLayout => appGridItem(app, currentApp, localLayout, config)
  }));
  const pages = paginateWidgetEntries([
    ...getBuiltinWidgetEntries(config, osState),
    ...getCustomWidgetEntries(config, osState),
    ...appEntries
  ]);
  if (osState.widgetEditing && pages.length === 1 && pages[0]?.length) pages.push([]);

  return `
    <div class="desktop-widget-pager" data-desktop-widget-pager>
      <div class="desktop-widget-pages" data-desktop-widget-pages>
        ${pages.map((page, pageIndex) => `
          <section class="desktop-widget-page" data-desktop-widget-page="${pageIndex}">
            <div class="desktop-grid grid-stack" data-desktop-grid data-widget-page-index="${pageIndex}">
              ${page.map(entry => entry.render(entry.layout)).join('')}
            </div>
          </section>
        `).join('')}
      </div>
      ${pages.length > 1 ? `<nav class="desktop-page-dots" aria-label="桌面分页">${pages.map((_, index) => `<button class="${index === 0 ? 'is-active' : ''}" type="button" data-desktop-page-dot="${index}" aria-label="第 ${index + 1} 页"></button>`).join('')}</nav>` : ''}
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
  if (!osState.notificationCenterOpen || !notices.length) return '';
  const notice = notices.find(item => item.id === osState.notificationPopupId)
    || notices.find(item => !item.readAt)
    || notices[0];
  return `
    <section class="phone-notice-center" aria-label="新消息" role="status" aria-live="polite">
      <button class="${notice.readAt ? 'is-read' : 'is-unread'}" type="button" data-phone-notice-id="${escapeHtml(notice.id)}" data-phone-notice-open="${escapeHtml(notice.appId || 'home')}" data-phone-notice-character="${escapeHtml(notice.characterId || '')}">
        <span><strong>${escapeHtml(notice.title)}</strong><small>${escapeHtml(notice.body)}</small></span><i>›</i>
      </button>
      <button class="phone-notice-dismiss" type="button" data-phone-notice-toggle aria-label="收起通知">×</button>
    </section>
  `;
}

export function renderHomeScreen(config, osState) {
  const apps = getEnabledApps(config, osState.runtimeCapabilities, osState.customApps);
  const dockApps = apps.filter(app => app.dock).slice(0, 4);
  const notificationCount = unreadPhoneNotificationCount(config);

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
