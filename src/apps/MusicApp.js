import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import {
  deleteLocalAudio,
  importLocalAudio,
  loadOnlineMusicAccount,
  loadOnlineUserPlaylists,
  loadLocalTracks,
  loadOnlineHome,
  loadOnlineLyrics,
  loadOnlinePlaylist,
  musicBaseUrl,
  playMusicTrack,
  playNext,
  playPrevious,
  loadSavedMusicAccount,
  resolveOnlineStream,
  searchOnlineMusic,
  seekMusic,
  setMusicQueue,
  setMusicStateListener,
  setMusicVolume,
  stopMusicPlayback,
  toggleMusicPlayback
} from '../services/musicService.js?v=app-config-91';

const demoTracks = [{ id: 'preview-1', encryptedId: 'preview-1', name: '晚风来信', artist: 'LovePhone', album: '陪伴电台', cover: '', duration: 228000, playable: true }];

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

function mediaUrl(value) {
  return String(value || '').split('?')[0].replace(/^http:\/\//i, 'https://');
}

function parseLyrics(raw = '') {
  return String(raw).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?]\s*(.*)$/);
    if (!match || !match[4].trim()) return [];
    return [{ time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`), text: match[4].trim() }];
  });
}

function coverHtml(item, className = '') {
  return item?.cover
    ? `<img class="${className}" src="${escapeHtml(mediaUrl(item.cover))}" alt="" />`
    : `<span class="music-cover-placeholder ${className}"><i>♪</i></span>`;
}

function renderTrackRows(tracks = [], options = {}) {
  return tracks.map((track, index) => `
    <button class="music-track-row ${track.playable === false ? 'is-unavailable' : ''}" type="button" data-music-track-id="${escapeHtml(track.id)}">
      ${options.numbered ? `<span class="music-track-rank">${index + 1}</span>` : coverHtml(track, 'music-track-cover')}
      <span class="music-track-copy"><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</small></span>
      <span class="music-track-more">${track.source === 'local' ? '本地' : '•••'}</span>
    </button>
  `).join('');
}

function renderPlaylistCards(playlists = []) {
  return playlists.map(playlist => `
    <button class="music-playlist-card" type="button" data-music-playlist-id="${escapeHtml(playlist.id)}">
      <span class="music-playlist-cover">${coverHtml(playlist)}${playlist.playCount ? `<small>▶ ${Math.round(playlist.playCount / 10000) || playlist.playCount}万</small>` : ''}</span>
      <strong>${escapeHtml(playlist.name)}</strong><small>${playlist.trackCount ? `${playlist.trackCount} 首` : escapeHtml(playlist.creator || '在线歌单')}</small>
    </button>
  `).join('');
}

function renderMiniPlayer(track, playback = {}) {
  if (!track) return '';
  const duration = Number(playback.duration) || Number(track.duration) / 1000 || 0;
  const position = Number(playback.position) || 0;
  const playing = playback.status === 'playing';
  return `<div class="music-mini-player">
    <button type="button" data-music-open-player>${coverHtml(track, 'music-mini-cover')}<span><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist)}</small></span></button>
    <span class="music-mini-time">${formatTime(position)}</span>
    <button class="music-mini-toggle" type="button" data-music-toggle aria-label="${playing ? '暂停' : '播放'}">${playing ? 'Ⅱ' : '▶'}</button>
    <span class="music-mini-progress"><i style="width:${duration ? Math.min(100, position / duration * 100) : 0}%"></i></span>
  </div>`;
}

function renderDiscover(config, osState) {
  const home = osState.musicHome || {};
  const localTracks = osState.musicLocalTracks || [];
  const results = osState.musicResults || [];
  const searching = Boolean(osState.musicQuery && osState.musicSearchComplete);
  const online = Boolean(config.apps.music.onlineEnabled && musicBaseUrl(config));
  return `<section class="phone-screen phone-music-app">
    ${renderStatusBar('music-statusbar')}
    <header class="music-app-header"><button type="button" data-go-home aria-label="返回桌面">‹</button><strong>网易云音乐</strong><button type="button" data-music-upload aria-label="导入本地音乐">＋</button></header>
    <input data-music-file type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.wav,.webm" hidden multiple />
    ${online ? `<form class="music-search" data-music-search><span>⌕</span><input name="keywords" value="${escapeHtml(osState.musicQuery || '')}" placeholder="搜索网易云歌曲、歌手或专辑" autocomplete="off" /></form>` : '<p class="music-online-note">网易云音乐尚未连接，请前往“设置 → AI 与在线服务”填写兼容 API 地址。</p>'}
    <div class="music-scroll-area">
      ${searching ? `<div class="music-section-heading"><strong>搜索结果</strong><button type="button" data-music-clear-search>返回首页</button></div><div class="music-track-list">${results.length ? renderTrackRows(results) : '<p class="music-empty-library">没有找到相关歌曲</p>'}</div>` : `
        ${online && config.apps.music.showRecommendations ? `
          <div class="music-online-banner"><span><i></i><strong>网易云音乐已连接</strong></span><small>${osState.musicAccount ? `${escapeHtml(osState.musicAccount.nickname || '网易云账号')} 已登录` : '可在设置中扫码登录并读取个人歌单'}</small></div>
          <div class="music-shortcuts"><button type="button" data-music-jump="daily"><i>▥</i><small>推荐歌曲</small></button><button type="button" data-music-jump="charts"><i>◉</i><small>榜单</small></button><button type="button" data-music-open-library><i>♬</i><small>我的音乐</small></button></div>
          <div class="music-section-heading" id="music-daily"><strong>推荐歌曲</strong><span>${home.daily?.length ? '在线更新' : '加载中'}</span></div>
          <div class="music-track-list">${home.daily?.length ? renderTrackRows(home.daily.slice(0, 6)) : '<p class="music-empty-library">暂时没有可展示的推荐</p>'}</div>
          <div class="music-section-heading" id="music-charts"><strong>热门榜单</strong><span>在线音乐</span></div>
          <div class="music-playlist-grid">${home.charts?.length ? renderPlaylistCards(home.charts.slice(0, 6)) : '<p class="music-empty-library">暂时没有榜单</p>'}</div>` : ''}
        <div class="music-section-heading"><strong>本地音乐</strong><button type="button" data-music-upload>导入音乐</button></div>
        <div class="music-track-list">${localTracks.length ? renderTrackRows(localTracks.slice(0, 6)) : '<p class="music-empty-library">从手机导入音乐后，会安全保存在这台设备。</p>'}</div>
      `}
      ${osState.musicStatus ? `<p class="music-status-message">${escapeHtml(osState.musicStatus)}</p>` : ''}
    </div>
    ${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
  </section>`;
}

function renderPlaylist(osState) {
  const playlist = osState.musicPlaylist || {};
  const tracks = osState.musicPlaylistTracks || [];
  return `<section class="phone-screen phone-music-app phone-music-playlist">
    ${renderStatusBar('music-statusbar')}
    <header class="music-app-header"><button type="button" data-music-back-discover aria-label="返回音乐首页">‹</button><strong>歌单</strong><span></span></header>
    <div class="music-scroll-area"><div class="music-playlist-head">${coverHtml(playlist, 'music-playlist-head-cover')}<div><strong>${escapeHtml(playlist.name || '歌单')}</strong><small>${escapeHtml(playlist.creator || '在线音乐')}</small><span>${tracks.length} 首</span></div></div>
      <button class="music-play-all" type="button" data-music-play-all>▶ 播放全部 <small>(${tracks.length})</small></button>
      <div class="music-track-list">${tracks.length ? renderTrackRows(tracks, { numbered: true }) : '<p class="music-empty-library">歌单内容加载失败或为空</p>'}</div>
      ${osState.musicStatus ? `<p class="music-status-message">${escapeHtml(osState.musicStatus)}</p>` : ''}</div>${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
  </section>`;
}

function renderLibrary(osState) {
  const tracks = osState.musicLocalTracks || [];
  return `<section class="phone-screen phone-music-app phone-music-library">
    ${renderStatusBar('music-statusbar')}
    <header class="music-app-header"><button type="button" data-music-back-discover aria-label="返回音乐首页">‹</button><strong>本地音乐</strong><button type="button" data-music-upload aria-label="导入本地音乐">＋</button></header>
    <input data-music-file type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.wav,.webm" hidden multiple />
    <div class="music-scroll-area"><div class="music-track-list">${tracks.length ? tracks.map(track => `
      <article class="music-local-track">
        ${renderTrackRows([track])}
        <button type="button" data-music-delete-local="${escapeHtml(track.id)}" aria-label="删除 ${escapeHtml(track.name)}" title="删除本地音乐">×</button>
      </article>
    `).join('') : '<p class="music-empty-library">还没有本地音乐</p>'}</div>${osState.musicStatus ? `<p class="music-status-message">${escapeHtml(osState.musicStatus)}</p>` : ''}</div>${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
  </section>`;
}

function renderPersonal(osState) {
  const account = osState.musicAccount;
  const playlists = osState.musicPersonalPlaylists || [];
  return `<section class="phone-screen phone-music-app phone-music-library">
    ${renderStatusBar('music-statusbar')}
    <header class="music-app-header"><button type="button" data-music-back-discover aria-label="返回音乐首页">‹</button><strong>我的音乐</strong><span></span></header>
    <div class="music-scroll-area">
      ${account ? `<div class="music-personal-account"><i>${escapeHtml(String(account.nickname || '云').slice(0, 1))}</i><span><strong>${escapeHtml(account.nickname || '网易云账号')}</strong><small>我的歌单</small></span></div>` : ''}
      ${account ? `<div class="music-section-heading"><strong>创建和收藏的歌单</strong><span>${playlists.length ? `${playlists.length} 个歌单` : '加载中'}</span></div><div class="music-playlist-grid">${playlists.length ? renderPlaylistCards(playlists) : '<p class="music-empty-library">正在读取你的网易云歌单…</p>'}</div>` : '<p class="music-empty-library">请先在设置中扫码登录网易云，再查看你的个人歌单。</p>'}
      ${osState.musicStatus ? `<p class="music-status-message">${escapeHtml(osState.musicStatus)}</p>` : ''}
    </div>
    ${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
  </section>`;
}

function renderPlayer(config, osState) {
  const track = osState.musicTrack || demoTracks[0];
  const playback = osState.musicPlayback || {};
  const duration = Number(playback.duration) || Number(track.duration) / 1000 || 0;
  const position = Number(playback.position) || 0;
  const playing = playback.status === 'playing';
  const lyricView = config.apps.music.showLyrics && osState.musicPlayerTab === 'lyrics';
  const lyrics = osState.musicLyrics || [];
  return `<section class="phone-screen phone-music-player">
    ${renderStatusBar('music-statusbar')}
    <header class="music-player-header"><button type="button" data-music-close-player aria-label="返回音乐列表">⌄</button><span><small>正在播放</small><strong>${escapeHtml(track.album)}</strong></span>${config.apps.music.showLyrics ? `<button type="button" data-music-player-tab="${lyricView ? 'cover' : 'lyrics'}">${lyricView ? '封面' : '歌词'}</button>` : '<span></span>'}</header>
    <div class="music-player-body"><div class="music-record-stage ${playing ? 'is-playing' : ''} ${lyricView ? 'is-hidden' : ''}"><span class="music-needle"></span><div class="music-record">${coverHtml(track)}</div></div><div class="music-lyrics-view ${lyricView ? 'is-visible' : ''}">${lyrics.length ? lyrics.map(line => `<p class="${line.time <= position ? 'is-active' : ''}">${escapeHtml(line.text)}</p>`).join('') : '<p class="music-no-lyrics">暂时没有歌词</p>'}</div></div>
    <div class="music-now-copy"><span><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist)}</small></span><i>♡</i></div>
    <input class="music-progress-range" data-music-seek type="range" min="0" max="${duration || 1}" value="${position}" step="1" aria-label="播放进度" /><div class="music-times"><span>${formatTime(position)}</span><span>${formatTime(duration)}</span></div>
    <div class="music-player-controls"><button type="button" data-music-control="prev" aria-label="上一首">‹</button><button class="music-main-control" type="button" data-music-toggle aria-label="${playing ? '暂停' : '播放'}">${playing ? 'Ⅱ' : '▶'}</button><button type="button" data-music-control="next" aria-label="下一首">›</button></div>
    <label class="music-volume-control"><span>−</span><input type="range" min="0" max="100" value="${Number(playback.volume) || 70}" data-music-volume aria-label="音量" /><span>＋</span></label>
    ${osState.musicStatus ? `<p class="music-player-status">${escapeHtml(osState.musicStatus)}</p>` : ''}
  </section>`;
}

function allTracks(osState) {
  return [...(osState.musicLocalTracks || []), ...(osState.musicResults || []), ...(osState.musicHome?.daily || []), ...(osState.musicPlaylistTracks || []), ...(osState.musicTrack ? [osState.musicTrack] : [])]
    .filter((track, index, list) => track && list.findIndex(item => item.id === track.id) === index);
}

function onlineResolver(config) {
  const base = musicBaseUrl(config);
  return track => resolveOnlineStream(base, track.encryptedId);
}

async function playSelected(track, config, handlers, osState, pool = []) {
  if (!track || track.playable === false) return;
  const queue = pool.length ? pool : allTracks(osState);
  setMusicQueue(queue, track);
  handlers.updatePhoneState?.({ musicTrack: track, musicView: 'player', musicReturnView: osState.musicView === 'playlist' ? 'playlist' : 'discover', musicPlayerTab: 'cover', musicStatus: '正在加载音乐…' });
  try {
    const [result, lyric] = await Promise.all([
      playMusicTrack(track, { sourceUrl: track.source === 'netease' ? await resolveOnlineStream(musicBaseUrl(config), track.encryptedId) : '' }),
      config.apps.music.showLyrics && track.source === 'netease' ? loadOnlineLyrics(musicBaseUrl(config), track.encryptedId).catch(() => '') : Promise.resolve('')
    ]);
    handlers.updatePhoneState?.({ musicTrack: result.track || track, musicPlayback: result.state, musicPlaying: result.state.status === 'playing', musicLyrics: parseLyrics(lyric), musicStatus: '' });
  } catch (error) {
    handlers.updatePhoneState?.({ musicStatus: error.message || '播放失败。', musicPlaying: false });
  }
}

export const MusicApp = {
  render(_app, config, osState) {
    const preview = osState.musicAppearancePreviewMode;
    const state = preview ? { ...osState, musicTrack: demoTracks[0], musicPlayback: { status: 'paused', position: 68, duration: 228, volume: 70 }, musicHome: { daily: demoTracks, charts: [] }, musicLocalTracks: demoTracks } : osState;
    const viewConfig = preview ? { ...config, apps: { ...config.apps, music: { ...config.apps.music, onlineEnabled: true, showRecommendations: true, showLyrics: true } } } : config;
    if (state.musicView === 'player') return renderPlayer(viewConfig, state);
    if (state.musicView === 'playlist') return renderPlaylist(state);
    if (state.musicView === 'personal') return renderPersonal(state);
    if (state.musicView === 'library') return renderLibrary(state);
    return renderDiscover(viewConfig, state);
  },

  bind(container, config, handlers, osState) {
    if (osState.musicAppearancePreviewMode) return;
    const base = musicBaseUrl(config);
    const sync = payload => {
      if (!container.isConnected || !payload?.track) return;
      handlers.updatePhoneState?.({ musicTrack: payload.track, musicPlayback: payload.state, musicPlaying: payload.state?.status === 'playing' });
    };
    setMusicStateListener(sync);

    if (!osState.musicLocalLoaded) {
      loadLocalTracks().then(tracks => handlers.updatePhoneState?.({ musicLocalTracks: tracks, musicLocalLoaded: true })).catch(error => handlers.updatePhoneState?.({ musicLocalLoaded: true, musicStatus: error.message }));
    }
    if (!osState.musicAccountLoaded) {
      loadSavedMusicAccount()
        .then(musicAccount => musicAccount || (base ? loadOnlineMusicAccount(base).catch(() => null) : null))
        .then(musicAccount => handlers.updatePhoneState?.({ musicAccount, musicLoggedIn: Boolean(musicAccount), musicAccountLoaded: true }))
        .catch(() => handlers.updatePhoneState?.({ musicAccountLoaded: true }));
    }
    if (config.apps.music.onlineEnabled && base && !osState.musicHomeLoaded && !osState.musicHomeLoading) {
      handlers.updatePhoneState?.({ musicHomeLoading: true, musicStatus: '正在加载在线音乐…' });
      loadOnlineHome(base).then(home => handlers.updatePhoneState?.({ musicHome: home, musicHomeLoaded: true, musicHomeLoading: false, musicStatus: '' })).catch(error => handlers.updatePhoneState?.({ musicHomeLoading: false, musicStatus: error.message || '在线音乐加载失败。' }));
    }

    const openFilePicker = () => container.querySelector('[data-music-file]')?.click();
    container.querySelectorAll('[data-music-upload]').forEach(button => button.addEventListener('click', openFilePicker));
    container.querySelector('[data-music-file]')?.addEventListener('change', async event => {
      const files = [...(event.currentTarget.files || [])];
      if (!files.length) return;
      handlers.updatePhoneState?.({ musicStatus: `正在导入 ${files.length} 首本地音乐…` });
      try {
        for (const file of files) await importLocalAudio(file);
        const tracks = await loadLocalTracks();
        handlers.updatePhoneState?.({ musicLocalTracks: tracks, musicLocalLoaded: true, musicStatus: '本地音乐已导入。' });
      } catch (error) { handlers.updatePhoneState?.({ musicStatus: error.message || '本地音乐导入失败。' }); }
      event.currentTarget.value = '';
    });
    container.querySelector('[data-music-search]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const keywords = new FormData(event.currentTarget).get('keywords')?.trim();
      if (!keywords) return;
      if (!base) { handlers.updatePhoneState?.({ musicStatus: '请先在设置中填写在线音乐 API 地址。' }); return; }
      handlers.updatePhoneState?.({ musicQuery: keywords, musicSearchComplete: false, musicStatus: '正在搜索…' });
      try { const results = await searchOnlineMusic(base, keywords, 20); handlers.updatePhoneState?.({ musicResults: results, musicSearchComplete: true, musicStatus: results.length ? '' : '没有找到相关歌曲。' }); }
      catch (error) { handlers.updatePhoneState?.({ musicSearchComplete: true, musicStatus: error.message || '搜索失败。' }); }
    });
    container.querySelector('[data-music-clear-search]')?.addEventListener('click', () => handlers.updatePhoneState?.({ musicQuery: '', musicResults: [], musicSearchComplete: false, musicStatus: '' }));
    const tracks = allTracks(osState);
    container.querySelectorAll('[data-music-track-id]').forEach(button => button.addEventListener('click', () => {
      const track = tracks.find(item => item.id === button.dataset.musicTrackId);
      if (track) void playSelected(track, config, handlers, osState, osState.musicView === 'playlist' ? osState.musicPlaylistTracks : tracks);
    }));
    container.querySelectorAll('[data-music-delete-local]').forEach(button => button.addEventListener('click', async () => {
      const track = (osState.musicLocalTracks || []).find(item => item.id === button.dataset.musicDeleteLocal);
      if (!track || !globalThis.confirm?.(`删除本地音乐“${track.name}”吗？\n\n这会从当前设备移除音频文件，无法撤销。`)) return;
      button.disabled = true;
      try {
        if (osState.musicTrack?.id === track.id) stopMusicPlayback();
        await deleteLocalAudio(track.id);
        const musicLocalTracks = await loadLocalTracks();
        handlers.updatePhoneState?.({
          musicLocalTracks,
          musicTrack: osState.musicTrack?.id === track.id ? null : osState.musicTrack,
          musicPlayback: osState.musicTrack?.id === track.id ? null : osState.musicPlayback,
          musicPlaying: osState.musicTrack?.id === track.id ? false : osState.musicPlaying,
          musicStatus: `已删除“${track.name}”。`
        });
      } catch (error) {
        button.disabled = false;
        handlers.updatePhoneState?.({ musicStatus: error.message || '删除本地音乐失败。' });
      }
    }));
    container.querySelectorAll('[data-music-playlist-id]').forEach(button => button.addEventListener('click', async () => {
      const playlist = [...(osState.musicHome?.charts || []), ...(osState.musicPersonalPlaylists || [])].find(item => item.id === button.dataset.musicPlaylistId);
      if (!playlist || !base) return;
      handlers.updatePhoneState?.({ musicView: 'playlist', musicPlaylist: playlist, musicPlaylistTracks: [], musicStatus: '正在加载歌单…' });
      try { const playlistTracks = await loadOnlinePlaylist(base, playlist.id); handlers.updatePhoneState?.({ musicPlaylistTracks: playlistTracks, musicStatus: '' }); }
      catch (error) { handlers.updatePhoneState?.({ musicStatus: error.message || '歌单加载失败。' }); }
    }));
    container.querySelector('[data-music-play-all]')?.addEventListener('click', () => { const first = (osState.musicPlaylistTracks || [])[0]; if (first) void playSelected(first, config, handlers, osState, osState.musicPlaylistTracks); });
    container.querySelectorAll('[data-music-back-discover]').forEach(button => button.addEventListener('click', () => handlers.updatePhoneState?.({ musicView: 'discover', musicStatus: '' })));
    container.querySelectorAll('[data-music-open-library]').forEach(button => button.addEventListener('click', async () => {
      let account = osState.musicAccount;
      if (!account?.userId) {
        handlers.updatePhoneState?.({ musicStatus: '正在检查网易云登录状态…' });
        try {
          account = await loadSavedMusicAccount() || await loadOnlineMusicAccount(base);
          if (account?.userId) {
            handlers.updatePhoneState?.({ musicAccount: account, musicLoggedIn: true, musicAccountLoaded: true });
          }
        } catch {
          account = null;
        }
        if (!account?.userId) {
          handlers.updatePhoneState?.({ musicStatus: '你还没有登录网易云。请前往“设置 App → 音乐服务 → 扫码登录网易云”完成登录后再试。' });
          return;
        }
      }
      handlers.updatePhoneState?.({ musicView: 'personal', musicPersonalPlaylists: [], musicStatus: '正在读取你的网易云歌单…' });
      try {
        const musicPersonalPlaylists = await loadOnlineUserPlaylists(base, account.userId);
        handlers.updatePhoneState?.({ musicView: 'personal', musicPersonalPlaylists, musicStatus: '' });
      } catch (error) {
        handlers.updatePhoneState?.({ musicView: 'personal', musicStatus: error.message || '个人歌单读取失败。' });
      }
    }));
    container.querySelectorAll('[data-music-jump]').forEach(button => button.addEventListener('click', () => container.querySelector(`#music-${button.dataset.musicJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    container.querySelector('[data-music-open-player]')?.addEventListener('click', () => handlers.updatePhoneState?.({ musicView: 'player' }));
    container.querySelector('[data-music-close-player]')?.addEventListener('click', () => handlers.updatePhoneState?.({ musicView: osState.musicReturnView || 'discover' }));
    container.querySelector('[data-music-player-tab]')?.addEventListener('click', event => handlers.updatePhoneState?.({ musicPlayerTab: event.currentTarget.dataset.musicPlayerTab }));
    container.querySelectorAll('[data-music-toggle]').forEach(button => button.addEventListener('click', async () => { try { const result = await toggleMusicPlayback(); handlers.updatePhoneState?.({ musicPlayback: result.state, musicPlaying: result.state.status === 'playing', musicStatus: '' }); } catch (error) { handlers.updatePhoneState?.({ musicStatus: error.message }); } }));
    container.querySelectorAll('[data-music-control]').forEach(button => button.addEventListener('click', async () => { try { const result = button.dataset.musicControl === 'prev' ? await playPrevious(onlineResolver(config)) : await playNext(1, onlineResolver(config)); handlers.updatePhoneState?.({ musicTrack: result.track, musicPlayback: result.state, musicPlaying: result.state.status === 'playing', musicStatus: '' }); } catch (error) { handlers.updatePhoneState?.({ musicStatus: error.message || '切歌失败。' }); } }));
    container.querySelector('[data-music-seek]')?.addEventListener('input', event => {
      seekMusic(event.currentTarget.value);
    });
    container.querySelector('[data-music-seek]')?.addEventListener('change', event => {
      const result = seekMusic(event.currentTarget.value);
      handlers.updatePhoneState?.({ musicPlayback: result.state });
    });
    container.querySelector('[data-music-volume]')?.addEventListener('change', event => { const result = setMusicVolume(event.currentTarget.value); handlers.updatePhoneState?.({ musicPlayback: result.state }); });
  }
};
