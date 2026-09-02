import { shouldSuppressDesktopClick } from './GridStackWidgets.js?v=app-config-62';
import {
  loadLocalTracks,
  loadOnlineHome,
  musicBaseUrl,
  playMusicTrack,
  playNext,
  playPrevious,
  resolveOnlineStream,
  setMusicQueue,
  setMusicStateListener,
  toggleMusicPlayback
} from '../services/musicService.js?v=app-config-91';
import { readOptimizedImage } from '../services/imageUploadService.js?v=app-config-60';
import { resolveCompositionBinding } from './customWidgetRuntime.js?v=app-config-104';

let homePlaybackState = null;
let clockTimer = null;
let codeWidgetMessageHandler = null;

function musicBase(config) {
  return musicBaseUrl(config);
}

function mediaUrl(value) {
  return String(value || '').split('?')[0].replace(/^http:\/\//i, 'https://');
}

function knownTracks(osState) {
  return [
    ...(osState.musicLocalTracks || []),
    ...(osState.musicHome?.daily || []),
    ...(osState.musicHome?.ranking || []),
    ...(osState.musicPlaylistTracks || []),
    ...(osState.musicResults || []),
    ...(osState.musicTrack ? [osState.musicTrack] : [])
  ].filter((track, index, all) => (
    track?.playable !== false
    && all.findIndex(item => item.id === track.id) === index
  ));
}

function findTrackFromTitle(title, osState) {
  return knownTracks(osState).find(track => String(title || '').startsWith(track.name));
}

async function chooseFirstTrack(config, osState) {
  const known = knownTracks(osState).find(track => track.playable);
  if (known) return { track: known, daily: osState.musicHome?.daily || [], local: osState.musicLocalTracks || [] };
  const local = await loadLocalTracks().catch(() => []);
  const localTrack = local.find(track => track.playable);
  if (localTrack) return { track: localTrack, daily: [], local };
  const base = musicBase(config);
  if (!config.apps?.music?.onlineEnabled || !base) return { track: null, daily: [], local };
  const discover = await loadOnlineHome(base);
  const daily = discover.daily || [];
  return { track: daily.find(track => track.playable), daily };
}

function updateVinylDom(container, state, track) {
  if (!state) return;
  homePlaybackState = state;
  const playing = state.status === 'playing';
  const duration = Number(state.duration) || (Number(track?.duration) || 0) / 1000;
  const position = Number(state.position) || 0;
  const titleParts = String(state.title || '').split(' - ');
  const title = track?.name || titleParts[0] || '选择一首歌';
  const artist = track?.artist || titleParts.slice(1).join(' - ') || '网易云音乐';
  const titleNode = container.querySelector('[data-vinyl-title]');
  const artistNode = container.querySelector('[data-vinyl-artist]');
  const progressNode = container.querySelector('[data-vinyl-progress]');
  if (titleNode) titleNode.textContent = title;
  if (artistNode) artistNode.textContent = artist;
  if (progressNode) progressNode.style.width = `${duration ? Math.min(100, (position / duration) * 100) : 0}%`;
  container.querySelector('.vinyl-disc')?.classList.toggle('is-playing', playing);
  const toggle = container.querySelector('[data-vinyl-control="toggle"]');
  if (toggle) {
    toggle.textContent = playing ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', playing ? '暂停' : '播放');
  }
}

function updateCompositionDom(container, config, osState) {
  const widgets = config.theme?.customization?.widgets || [];
  container.querySelectorAll('[data-composition-widget]').forEach(widgetNode => {
    const widget = widgets.find(item => item.id === widgetNode.dataset.compositionWidget);
    if (!widget) return;
    widgetNode.querySelectorAll('[data-composition-element]').forEach(node => {
      const element = widget.elements?.find(item => item.id === node.dataset.compositionElement);
      if (!element) return;
      if (element.type === 'musicControl') {
        const label = node.querySelector('span');
        if (label && element.action?.type === 'musicPlayPause') {
          label.textContent = osState.musicPlayback?.status === 'playing' || osState.musicPlaying ? 'Ⅱ' : '▶';
        }
        return;
      }
      if (element.binding?.source === 'static') return;
      const value = resolveCompositionBinding(element, config, osState);
      if (element.type === 'image') {
        const image = node.querySelector('img');
        if (image && value) image.src = value;
      } else if (element.type === 'progress') {
        const fill = node.querySelector('.composition-progress-track i');
        if (fill) fill.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
      } else {
        const label = node.querySelector('span');
        if (label) label.textContent = String(value ?? '');
      }
    });
  });
}

async function controlVinyl(action, container, config, osState, handlers) {
  let track = osState.musicTrack;
  if (!track) {
    const selection = await chooseFirstTrack(config, osState);
    track = selection.track;
    if (!track) throw new Error('暂时没有可播放歌曲');
    const pool = [...(selection.local || []), ...(selection.daily || [])];
    setMusicQueue(pool, track);
    const result = await playMusicTrack(track, {
      sourceUrl: track.source === 'netease' ? await resolveOnlineStream(musicBase(config), track.encryptedId) : ''
    });
    homePlaybackState = result.state;
    handlers.updatePhoneState?.({
      musicTrack: track,
      musicPlayback: result.state,
      musicPlaying: result.state?.status === 'playing',
      musicView: 'discover',
      musicHome: {
        ...(osState.musicHome || {}),
        daily: selection.daily
      },
      musicLocalTracks: selection.local || osState.musicLocalTracks || [],
      musicStatus: ''
    });
    handlers.openApp?.('music');
    return;
  }

  if (action === 'toggle') {
    const result = await toggleMusicPlayback();
    updateVinylDom(container, result.state, track);
    handlers.updatePhoneState?.({
      musicPlayback: result.state,
      musicPlaying: result.state?.status === 'playing'
    });
    return;
  }

  const resolver = item => resolveOnlineStream(musicBase(config), item.encryptedId);
  const result = action === 'prev' ? await playPrevious(resolver) : await playNext(1, resolver);
  track = result.track || track;
  updateVinylDom(container, result.state, track);
  handlers.updatePhoneState?.({
    musicTrack: track,
    musicPlayback: result.state,
    musicPlaying: result.state?.status === 'playing'
  });
}

async function runCustomWidgetAction(action, target, control, container, config, osState, handlers) {
  if (action === 'none') return;
  if (action === 'openApp') {
    if (config.apps?.[target]?.enabled) handlers.openApp?.(target);
    return;
  }
  if (action === 'openChat') {
    handlers.openApp?.('chat');
    if (target) handlers.updatePhoneState?.({ chatCharacterId: target, chatView: 'conversation' });
    return;
  }
  if (action === 'openAnniversary') {
    if (config.apps?.anniversary?.enabled) handlers.openApp?.('anniversary');
    return;
  }
  if (action === 'createDiary') {
    if (config.apps?.diary?.enabled) handlers.openApp?.('diary');
    return;
  }
  if (action === 'switchCharacter') {
    const characters = [config.character, ...(config.characters || [])];
    const selected = characters.find(character => character.id === target)
      || characters.find(character => character.id !== config.apps?.character?.activeCharacterId);
    if (selected) handlers.selectCharacter?.(selected.id, { characterView: 'detail' });
    return;
  }
  const musicAction = {
    musicPlayPause: 'toggle',
    musicPrevious: 'prev',
    musicNext: 'next'
  }[action];
  if (!musicAction) return;
  if (control) control.disabled = true;
  try {
    await controlVinyl(musicAction, container, config, osState, handlers);
  } catch (error) {
    handlers.updatePhoneState?.({ musicStatus: error.message || '音乐操作失败。' });
  } finally {
    if (control) control.disabled = false;
  }
}

function bindCodeWidgetBridge(container, config, osState, handlers) {
  if (codeWidgetMessageHandler) window.removeEventListener('message', codeWidgetMessageHandler);
  const frames = [...container.querySelectorAll('[data-custom-widget-frame]')];
  codeWidgetMessageHandler = async event => {
    const frame = frames.find(item => item.contentWindow === event.source);
    const message = event.data;
    if (!frame || !message || message.source !== 'lovephone-widget' || message.type !== 'action') return;
    if (message.widgetId !== frame.dataset.customWidgetFrame) return;
    const widget = (config.theme?.customization?.widgets || [])
      .find(item => item.id === message.widgetId && item.mode === 'code');
    if (!widget || !(widget.code?.actionPermissions || []).includes(message.action)) return;
    await runCustomWidgetAction(
      message.action,
      String(message.target || '').slice(0, 80),
      null,
      container,
      config,
      osState,
      handlers
    );
  };
  window.addEventListener('message', codeWidgetMessageHandler);
}

function bindClock(container) {
  clearInterval(clockTimer);
  const update = () => {
    if (!container.isConnected) {
      clearInterval(clockTimer);
      clockTimer = null;
      return;
    }
    const now = new Date();
    const timeNode = container.querySelector('[data-widget-clock-time]');
    const dateNode = container.querySelector('[data-widget-clock-date]');
    if (timeNode) timeNode.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (dateNode) dateNode.textContent = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    const config = container.__lovePhoneConfig;
    const osState = container.__lovePhoneState;
    if (config && osState) updateCompositionDom(container, config, osState);
  };
  update();
  clockTimer = setInterval(update, 30000);
}

function bindVinylPlayer(container, config, osState, handlers) {
  homePlaybackState = osState.musicPlayback || null;
  const hasMusicWidget = (config.theme?.customization?.widgets || []).some(widget =>
    widget.kind === 'composition' && widget.elements?.some(element => element.binding?.source === 'music')
  );
  if (!config.theme?.widgets?.vinyl?.enabled && !hasMusicWidget) return;
  setMusicStateListener(result => {
    if (!container.isConnected || !result?.track) return;
    updateVinylDom(container, result.state, result.track);
    osState.musicTrack = result.track;
    osState.musicPlayback = result.state;
    osState.musicPlaying = result.state?.status === 'playing';
    updateCompositionDom(container, config, osState);
    handlers.updatePhoneState?.({
      musicTrack: result.track,
      musicPlayback: result.state,
      musicPlaying: result.state?.status === 'playing'
    });
  });
}

export function bindHomeWidgetActions(container, config, osState, handlers = {}) {
  container.__lovePhoneConfig = config;
  container.__lovePhoneState = osState;
  const interactive = container.querySelectorAll(
    '[data-vinyl-control], [data-widget-open-app], [data-widget-dismiss], [data-photo-widget-upload], [data-photo-widget-input], [data-custom-widget-action]'
  );
  interactive.forEach(node => {
    if (osState.widgetEditing && node.closest('[data-composition-element]')) return;
    node.addEventListener('pointerdown', event => event.stopPropagation());
  });

  container.querySelectorAll('[data-widget-open-app]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (shouldSuppressDesktopClick()) return;
      const appId = button.dataset.widgetOpenApp;
      if (config.apps?.[appId]?.enabled) {
        if (appId === 'music' && osState.musicTrack) {
          handlers.updatePhoneState?.({ musicView: 'player' });
        }
        handlers.openApp?.(appId);
      }
    });
  });

  container.querySelectorAll('[data-widget-dismiss]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (shouldSuppressDesktopClick()) return;
      const widgetId = button.dataset.widgetDismiss;
      if (!widgetId) return;
      handlers.updatePath?.(`theme.widgets.${widgetId}.enabled`, false);
    });
  });

  container.querySelectorAll('[data-vinyl-control]').forEach(button => {
    button.addEventListener('click', async event => {
      event.stopPropagation();
      if (shouldSuppressDesktopClick()) return;
      button.disabled = true;
      try {
        await controlVinyl(button.dataset.vinylControl, container, config, osState, handlers);
      } catch (error) {
        handlers.updatePhoneState?.({ musicStatus: error.message || '唱片机操作失败' });
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-custom-widget-action]').forEach(button => {
    button.addEventListener('click', async event => {
      event.stopPropagation();
      if (osState.widgetEditing) return;
      if (shouldSuppressDesktopClick()) return;
      const action = button.dataset.customWidgetAction;
      const target = button.dataset.customWidgetTarget;
      await runCustomWidgetAction(action, target, button, container, config, osState, handlers);
    });
  });

  const photoInput = container.querySelector('[data-photo-widget-input]');
  container.querySelector('[data-photo-widget-upload]')?.addEventListener('click', event => {
    event.stopPropagation();
    if (!shouldSuppressDesktopClick()) photoInput?.click();
  });
  photoInput?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.setCustomValidity('');
    try {
      const image = await readOptimizedImage(file, 1000);
      handlers.updatePath?.('theme.widgets.photo.image', image);
    } catch (error) {
      event.currentTarget.value = '';
      event.currentTarget.setCustomValidity(error.message || '图片处理失败。');
      event.currentTarget.reportValidity();
    }
  });

  bindClock(container);
  bindVinylPlayer(container, config, osState, handlers);
  bindCodeWidgetBridge(container, config, osState, handlers);
}
