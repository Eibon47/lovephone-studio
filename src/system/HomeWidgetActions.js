import { shouldSuppressDesktopClick } from './GridStackWidgets.js?v=app-config-62';
import {
  musicBaseUrl,
  musicFetchJson as fetchJson,
  musicPostJson as postJson
} from '../services/musicService.js?v=app-config-49';
import { readOptimizedImage } from '../services/imageUploadService.js?v=app-config-60';

let homePlaybackState = null;
let homePollTimer = null;
let clockTimer = null;
let codeWidgetMessageHandler = null;

function musicBase(config) {
  return musicBaseUrl(config);
}

function mediaUrl(value) {
  return String(value || '').split('?')[0].replace(/^http:\/\//i, 'https://');
}

function normalizeTrack(song = {}) {
  const artists = song.fullArtists || song.artists || [];
  const album = song.album || {};
  return {
    id: String(song.id || ''),
    encryptedId: String(song.id || ''),
    originalId: String(song.originalId || ''),
    name: song.name || '未命名歌曲',
    artist: artists.map(item => typeof item === 'string' ? item : item.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || song.albumName || '未知专辑',
    cover: mediaUrl(song.coverImgUrl || album.picUrl),
    duration: Number(song.duration) || 0,
    playable: song.visible !== false && song.playFlag !== false
  };
}

function knownTracks(osState) {
  return [
    ...(osState.musicHome?.daily || []),
    ...(osState.musicHome?.ranking || []),
    ...(osState.musicPlaylistTracks || []),
    ...(osState.musicResults || []),
    ...(osState.musicTrack ? [osState.musicTrack] : [])
  ].filter((track, index, all) => (
    track?.playable !== false
    && all.findIndex(item => item.encryptedId === track.encryptedId) === index
  ));
}

function findTrackFromTitle(title, osState) {
  return knownTracks(osState).find(track => String(title || '').startsWith(track.name));
}

async function playTrack(base, track) {
  return postJson(base, '/play', {
    encryptedId: track.encryptedId,
    originalId: track.originalId
  });
}

async function chooseFirstTrack(base, osState) {
  const known = knownTracks(osState).find(track => track.playable);
  if (known) return { track: known, daily: osState.musicHome?.daily || [] };
  const discover = await fetchJson(`${base}/discover`);
  const daily = (discover.daily || []).map(normalizeTrack);
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

async function controlVinyl(action, container, config, osState, handlers) {
  const base = musicBase(config);
  let track = osState.musicTrack;
  if (!track) {
    const selection = await chooseFirstTrack(base, osState);
    track = selection.track;
    if (!track) throw new Error('暂时没有可播放歌曲');
    const result = await playTrack(base, track);
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
      musicStatus: ''
    });
    handlers.openApp?.('music');
    return;
  }

  if (action === 'toggle') {
    const playing = (homePlaybackState?.status || osState.musicPlayback?.status) === 'playing';
    const result = await postJson(base, '/control', { action: playing ? 'pause' : 'resume' });
    updateVinylDom(container, result.state, track);
    handlers.updatePhoneState?.({
      musicPlayback: result.state,
      musicPlaying: result.state?.status === 'playing'
    });
    return;
  }

  const beforeTitle = homePlaybackState?.title || osState.musicPlayback?.title;
  let result = await postJson(base, '/control', { action });
  let nextTrack = findTrackFromTitle(result.state?.title, osState);
  const pool = knownTracks(osState);
  if ((!nextTrack || result.state?.title === beforeTitle) && pool.length > 1) {
    const currentIndex = Math.max(0, pool.findIndex(item => item.encryptedId === track.encryptedId));
    const direction = action === 'prev' ? -1 : 1;
    nextTrack = pool[(currentIndex + direction + pool.length) % pool.length];
    result = await playTrack(base, nextTrack);
  }
  track = nextTrack || track;
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
  };
  update();
  clockTimer = setInterval(update, 30000);
}

function bindVinylPolling(container, config, osState) {
  clearInterval(homePollTimer);
  homePlaybackState = osState.musicPlayback || null;
  if (!config.theme?.widgets?.vinyl?.enabled) return;
  const base = musicBase(config);
  const poll = async () => {
    if (!container.isConnected) {
      clearInterval(homePollTimer);
      homePollTimer = null;
      return;
    }
    try {
      const result = await fetchJson(`${base}/state`);
      updateVinylDom(container, result.state, findTrackFromTitle(result.state?.title, osState) || osState.musicTrack);
    } catch {
      // Keep the last visible state if the local music bridge is restarting.
    }
  };
  poll();
  homePollTimer = setInterval(poll, 1000);
}

export function bindHomeWidgetActions(container, config, osState, handlers = {}) {
  const interactive = container.querySelectorAll(
    '[data-vinyl-control], [data-widget-open-app], [data-widget-dismiss], [data-photo-widget-upload], [data-photo-widget-input], [data-custom-widget-action]'
  );
  interactive.forEach(node => {
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
  bindVinylPolling(container, config, osState);
  bindCodeWidgetBridge(container, config, osState, handlers);
}
