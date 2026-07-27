import { escapeHtml } from '../system/html.js';
import { renderStatusBar } from '../system/StatusBar.js';
import {
  musicBaseUrl,
  musicFetchJson as fetchJson,
  musicPostJson as postJson
} from '../services/musicService.js?v=app-config-49';

const demoTracks = [
  { id: 'demo-1', encryptedId: 'demo-1', originalId: 'demo-1', name: '晚风来信', artist: 'LovePhone', album: '陪伴电台', cover: '', duration: 0, playable: false }
];

let playbackPollTimer = null;
let latestPlayback = null;
let activeLyricIndex = -1;

function apiBase(config) {
  return musicBaseUrl(config);
}

function mediaUrl(value) {
  return String(value || '').split('?')[0].replace(/^http:\/\//i, 'https://');
}

function normalizeTrack(song = {}) {
  const artists = song.fullArtists || song.artists || song.ar || [];
  const album = song.album || song.al || {};
  const encryptedId = String(song.encryptedId || song.id || '');
  return {
    id: encryptedId,
    encryptedId,
    originalId: String(song.originalId || ''),
    name: song.name || '未命名歌曲',
    artist: artists.map(item => typeof item === 'string' ? item : item.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || song.albumName || '未知专辑',
    cover: mediaUrl(song.coverImgUrl || album.picUrl || album.artist?.picUrl),
    duration: Number(song.duration) || 0,
    playable: song.visible !== false && song.playFlag !== false,
    liked: Boolean(song.liked),
    playCount: Number(song.playCount) || 0
  };
}

function normalizePlaylist(item = {}) {
  return {
    id: String(item.id || ''),
    encryptedId: String(item.id || ''),
    originalId: String(item.originalId || ''),
    name: item.name || '未命名歌单',
    cover: mediaUrl(item.coverImgUrl),
    description: item.describe || '',
    creator: item.creatorNickName || '',
    creatorAvatar: mediaUrl(item.creatorAvatarUrl),
    trackCount: Number(item.trackCount) || 0,
    playCount: Number(item.playCount) || 0,
    tags: Array.isArray(item.tags) ? item.tags : []
  };
}

function parseLyrics(raw = '') {
  return String(raw).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?]\s*(.*)$/);
    if (!match || !match[4].trim()) return [];
    const fraction = Number(`0.${match[3] || 0}`);
    return [{
      time: Number(match[1]) * 60 + Number(match[2]) + fraction,
      text: match[4].trim()
    }];
  });
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

function formatCount(value) {
  const count = Number(value) || 0;
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${Math.round(count / 10000)}万`;
  return String(count || '');
}

function coverHtml(item, className = '') {
  return item?.cover
    ? `<img class="${className}" src="${escapeHtml(item.cover)}" alt="" />`
    : `<span class="music-cover-placeholder ${className}"><i>♪</i></span>`;
}

function renderTrackRows(tracks, options = {}) {
  return tracks.map((track, index) => `
    <button class="music-track-row ${track.playable ? '' : 'is-unavailable'}" type="button" data-music-track-id="${escapeHtml(track.encryptedId)}">
      ${options.numbered ? `<span class="music-track-rank">${index + 1}</span>` : coverHtml(track, 'music-track-cover')}
      <span class="music-track-copy">
        <strong>${escapeHtml(track.name)}</strong>
        <small>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</small>
      </span>
      <span class="music-track-more">${track.playable ? '•••' : '暂无音源'}</span>
    </button>
  `).join('');
}

function renderPlaylistCards(playlists) {
  return playlists.map(playlist => `
    <button class="music-playlist-card" type="button" data-music-playlist-id="${escapeHtml(playlist.encryptedId)}">
      <span class="music-playlist-cover">
        ${coverHtml(playlist)}
        ${playlist.playCount ? `<small>▶ ${formatCount(playlist.playCount)}</small>` : ''}
      </span>
      <strong>${escapeHtml(playlist.name)}</strong>
      <small>${playlist.trackCount ? `${playlist.trackCount} 首` : escapeHtml(playlist.creator)}</small>
    </button>
  `).join('');
}

function renderMiniPlayer(track, playback = {}) {
  if (!track) return '';
  const duration = Number(playback.duration) || track.duration / 1000 || 0;
  const position = Number(playback.position) || 0;
  const percent = duration ? Math.min(100, (position / duration) * 100) : 0;
  const playing = playback.status === 'playing';
  return `
    <div class="music-mini-player">
      <button type="button" data-music-open-player>
        ${coverHtml(track, 'music-mini-cover')}
        <span><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist)}</small></span>
      </button>
      <span class="music-mini-time" data-music-mini-time>${formatTime(position)}</span>
      <button class="music-mini-toggle" type="button" data-music-toggle aria-label="${playing ? '暂停' : '播放'}">${playing ? 'Ⅱ' : '▶'}</button>
      <span class="music-mini-progress"><i data-music-mini-progress style="width:${percent}%"></i></span>
    </div>
  `;
}

function renderLoadingRows() {
  return `
    <div class="music-loading-list" aria-label="正在加载">
      <i></i><i></i><i></i>
    </div>
  `;
}

function renderDiscover(config, osState) {
  const home = osState.musicHome || {};
  const searchResults = osState.musicResults || [];
  const hasSearch = Boolean(osState.musicQuery && osState.musicSearchComplete);
  const daily = home.daily || [];
  const firstDaily = daily.find(track => track.playable) || daily[0];
  const radar = home.radar || [];
  const charts = home.charts || [];
  const ranking = home.ranking || [];
  const showRecommendations = config.apps.music.showRecommendations;
  return `
    <section class="phone-screen phone-music-app">
      ${renderStatusBar('music-statusbar')}
      <header class="music-app-header">
        <button type="button" data-go-home aria-label="返回桌面">‹</button>
        <strong>音乐</strong>
        <span class="music-profile-dot">L</span>
      </header>
      <form class="music-search" data-music-search>
        <span>⌕</span>
        <input name="keywords" value="${escapeHtml(osState.musicQuery || '')}" placeholder="搜索歌曲、歌手或专辑" autocomplete="off" />
      </form>
      <div class="music-scroll-area">
        ${hasSearch ? `
          <div class="music-section-heading">
            <strong>搜索结果</strong>
            <button type="button" data-music-clear-search>返回推荐</button>
          </div>
          <div class="music-track-list">${searchResults.length ? renderTrackRows(searchResults) : renderLoadingRows()}</div>
        ` : `
          ${showRecommendations && firstDaily ? `
            <button class="music-daily-hero" type="button" data-music-track-id="${escapeHtml(firstDaily.encryptedId)}">
              ${coverHtml(firstDaily)}
              <span><small>DAILY MIX</small><strong>今天的音乐日签</strong><em>${escapeHtml(firstDaily.name)} · ${escapeHtml(firstDaily.artist)}</em></span>
              <i>▶</i>
            </button>
          ` : renderLoadingRows()}
          <div class="music-shortcuts ${showRecommendations ? '' : 'is-library-only'}">
            ${showRecommendations ? '<button type="button" data-music-jump="daily"><i>▥</i><small>每日推荐</small></button>' : ''}
            <button type="button" data-music-open-library><i>♬</i><small>我的歌单</small></button>
            ${showRecommendations ? `
              <button type="button" data-music-jump="charts"><i>◉</i><small>榜单</small></button>
              <button type="button" data-music-jump="ranking"><i>⌁</i><small>听歌排行</small></button>
            ` : ''}
          </div>
          <div class="music-section-heading" id="music-my">
            <strong>我的歌单</strong>
            <button type="button" data-music-open-library>查看全部</button>
          </div>
          <div class="music-playlist-grid">${home.created?.length
            ? renderPlaylistCards(home.created.slice(0, 4))
            : renderLoadingRows()}</div>
          ${showRecommendations ? `<div class="music-section-heading" id="music-daily">
            <strong>每日推荐</strong>
            <span>${daily.length ? '为你更新' : '读取中'}</span>
          </div>
          <div class="music-track-list">${daily.length ? renderTrackRows(daily.slice(0, 5)) : renderLoadingRows()}</div>
          <div class="music-section-heading" id="music-playlists">
            <strong>私人雷达</strong>
            <span>根据你的口味更新</span>
          </div>
          <div class="music-playlist-grid">${radar.length ? renderPlaylistCards(radar.slice(0, 4)) : renderLoadingRows()}</div>
          <div class="music-section-heading" id="music-charts">
            <strong>官方榜单</strong>
            <span>正在流行</span>
          </div>
          <div class="music-playlist-grid">${charts.length ? renderPlaylistCards(charts.slice(0, 4)) : renderLoadingRows()}</div>
          <div class="music-section-heading" id="music-ranking">
            <strong>本周常听</strong>
            <span>你的真实排行</span>
          </div>
          <div class="music-track-list music-ranking-list">${ranking.length ? renderTrackRows(ranking.slice(0, 5), { numbered: true }) : renderLoadingRows()}</div>` : ''}
        `}
        ${osState.musicStatus ? `<p class="music-status-message">${escapeHtml(osState.musicStatus)}</p>` : ''}
      </div>
      ${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
    </section>
  `;
}

function renderPlaylist(osState) {
  const playlist = osState.musicPlaylist;
  const tracks = osState.musicPlaylistTracks || [];
  return `
    <section class="phone-screen phone-music-app phone-music-playlist">
      ${renderStatusBar('music-statusbar')}
      <header class="music-app-header">
        <button type="button" data-music-back-discover aria-label="返回音乐首页">‹</button>
        <strong>歌单</strong>
        <span></span>
      </header>
      <div class="music-scroll-area">
        ${playlist ? `
          <div class="music-playlist-head">
            ${coverHtml(playlist, 'music-playlist-head-cover')}
            <div>
              <strong>${escapeHtml(playlist.name)}</strong>
              <small>${escapeHtml(playlist.creator || '网易云音乐')}</small>
              <span>${playlist.trackCount} 首 · ${formatCount(playlist.playCount)} 次播放</span>
            </div>
          </div>
          ${playlist.description ? `<p class="music-playlist-description">${escapeHtml(playlist.description)}</p>` : ''}
          <button class="music-play-all" type="button" data-music-play-all>▶ 播放全部 <small>(${tracks.length})</small></button>
          <div class="music-track-list">${tracks.length ? renderTrackRows(tracks, { numbered: true }) : renderLoadingRows()}</div>
        ` : renderLoadingRows()}
        ${osState.musicStatus ? `<p class="music-status-message">${escapeHtml(osState.musicStatus)}</p>` : ''}
      </div>
      ${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
    </section>
  `;
}

function renderLibrary(osState) {
  const home = osState.musicHome || {};
  const tab = osState.musicLibraryTab === 'collected' ? 'collected' : 'created';
  const playlists = tab === 'created' ? (home.created || []) : (home.collected || []);
  return `
    <section class="phone-screen phone-music-app phone-music-library">
      ${renderStatusBar('music-statusbar')}
      <header class="music-app-header">
        <button type="button" data-music-back-discover aria-label="返回音乐首页">‹</button>
        <strong>我的歌单</strong>
        <span></span>
      </header>
      <div class="music-library-tabs">
        <button class="${tab === 'created' ? 'is-active' : ''}" type="button" data-music-library-tab="created">我创建的 ${home.created?.length || 0}</button>
        <button class="${tab === 'collected' ? 'is-active' : ''}" type="button" data-music-library-tab="collected">我收藏的 ${home.collected?.length || 0}</button>
      </div>
      <div class="music-scroll-area">
        <div class="music-playlist-grid">${playlists.length ? renderPlaylistCards(playlists) : '<p class="music-empty-library">这里还没有歌单</p>'}</div>
      </div>
      ${renderMiniPlayer(osState.musicTrack, osState.musicPlayback)}
    </section>
  `;
}

function renderLyrics(lines) {
  if (!lines.length) return '<p class="music-no-lyrics">暂时没有歌词</p>';
  return lines.map((line, index) => `
    <p data-lyric-index="${index}" data-lyric-time="${line.time}">${escapeHtml(line.text)}</p>
  `).join('');
}

function renderPlayer(config, osState) {
  const track = osState.musicTrack || demoTracks[0];
  const playback = osState.musicPlayback || {};
  const duration = Number(playback.duration) || track.duration / 1000 || 0;
  const position = Number(playback.position) || 0;
  const playing = playback.status === 'playing' || osState.musicPlaying;
  const lyrics = osState.musicLyrics || [];
  const lyricView = config.apps.music.showLyrics && osState.musicPlayerTab === 'lyrics';
  return `
    <section class="phone-screen phone-music-player">
      ${renderStatusBar('music-statusbar')}
      <header class="music-player-header">
        <button type="button" data-music-close-player aria-label="返回音乐列表">⌄</button>
        <span><small>正在播放</small><strong>${escapeHtml(track.album)}</strong></span>
        ${config.apps.music.showLyrics
          ? `<button type="button" data-music-player-tab="${lyricView ? 'cover' : 'lyrics'}">${lyricView ? '封面' : '歌词'}</button>`
          : '<span></span>'}
      </header>
      <div class="music-player-body">
        <div class="music-record-stage ${playing ? 'is-playing' : ''} ${lyricView ? 'is-hidden' : ''}">
          <span class="music-needle"></span>
          <div class="music-record">${track.cover ? `<img src="${escapeHtml(track.cover)}" alt="" />` : '<span><i>♪</i></span>'}</div>
        </div>
        <div class="music-lyrics-view ${lyricView ? 'is-visible' : ''}" data-music-lyrics>${renderLyrics(lyrics)}</div>
      </div>
      <div class="music-now-copy">
        <span><strong data-music-current-title>${escapeHtml(track.name)}</strong><small data-music-current-artist>${escapeHtml(track.artist)}</small></span>
        <i>${track.liked ? '♥' : '♡'}</i>
      </div>
      <input class="music-progress-range" data-music-seek type="range" min="0" max="${duration || 1}" value="${position}" step="1" aria-label="播放进度" />
      <div class="music-times"><span data-music-position>${formatTime(position)}</span><span data-music-duration>${formatTime(duration)}</span></div>
      <div class="music-player-controls">
        <button type="button" aria-label="播放模式">↝</button>
        <button type="button" data-music-control="prev" aria-label="上一首">‹</button>
        <button class="music-main-control" type="button" data-music-toggle aria-label="${playing ? '暂停' : '播放'}">${playing ? 'Ⅱ' : '▶'}</button>
        <button type="button" data-music-control="next" aria-label="下一首">›</button>
        <button type="button" aria-label="播放队列">☷</button>
      </div>
      <label class="music-volume-control">
        <span>−</span>
        <input type="range" min="0" max="100" value="${Number(playback.volume) || 70}" data-music-volume aria-label="音量" />
        <span>＋</span>
      </label>
      <p class="music-queue-state">${playback.queueLength ? `播放队列 ${playback.currentIndex + 1}/${playback.queueLength}` : '单曲播放'}</p>
      ${osState.musicStatus ? `<p class="music-player-status">${escapeHtml(osState.musicStatus)}</p>` : ''}
    </section>
  `;
}

function allKnownTracks(osState) {
  return [
    ...(osState.musicResults || []),
    ...(osState.musicHome?.daily || []),
    ...(osState.musicHome?.ranking || []),
    ...(osState.musicPlaylistTracks || []),
    ...(osState.musicTrack ? [osState.musicTrack] : [])
  ];
}

async function loadDiscover(base, handlers) {
  try {
    const data = await fetchJson(`${base}/discover`);
    handlers.updatePhoneState?.({
      musicHomeLoading: false,
      musicHomeLoaded: true,
      musicHome: {
        daily: (data.daily || []).map(normalizeTrack),
        radar: (data.radar || []).map(normalizePlaylist),
        charts: (data.charts || []).map(normalizePlaylist),
        created: (data.created || []).map(normalizePlaylist),
        collected: (data.collected || []).map(normalizePlaylist),
        ranking: (data.ranking || []).map(normalizeTrack)
      },
      musicStatus: ''
    });
  } catch (error) {
    handlers.updatePhoneState?.({ musicHomeLoading: false, musicStatus: error.message || '音乐首页加载失败' });
  }
}

async function openPlaylist(base, playlist, handlers) {
  handlers.updatePhoneState?.({
    musicView: 'playlist',
    musicPlaylist: playlist,
    musicPlaylistTracks: [],
    musicStatus: '正在加载歌单…'
  });
  try {
    const data = await fetchJson(`${base}/playlist?id=${encodeURIComponent(playlist.encryptedId)}`);
    handlers.updatePhoneState?.({
      musicPlaylist: normalizePlaylist(data.playlist || playlist),
      musicPlaylistTracks: (data.songs || []).map(normalizeTrack),
      musicStatus: ''
    });
  } catch (error) {
    handlers.updatePhoneState?.({ musicStatus: error.message || '歌单加载失败' });
  }
}

async function loadLyrics(base, track) {
  if (!track?.encryptedId || track.encryptedId.startsWith('demo-')) return [];
  const data = await fetchJson(`${base}/lyrics?id=${encodeURIComponent(track.encryptedId)}`);
  return parseLyrics(data.lyric);
}

async function startTrack(track, config, handlers, osState) {
  const base = apiBase(config);
  const returnView = osState.musicView === 'playlist' ? 'playlist' : 'discover';
  handlers.updatePhoneState?.({
    musicTrack: track,
    musicView: 'player',
    musicReturnView: returnView,
    musicPlayerTab: 'cover',
    musicPlaying: false,
    musicPlayback: {},
    musicLyrics: [],
    musicStatus: base ? '正在连接播放器…' : '请先启动本机音乐服务。'
  });
  if (!base || track.id.startsWith('demo-')) return;
  if (!track.playable) {
    handlers.updatePhoneState?.({ musicPlaying: false, musicStatus: '这首歌当前没有开放播放权限。' });
    return;
  }
  try {
    const [playback, lyrics] = await Promise.all([
      postJson(base, '/play', { encryptedId: track.encryptedId, originalId: track.originalId }),
      config.apps.music.showLyrics ? loadLyrics(base, track).catch(() => []) : Promise.resolve([])
    ]);
    latestPlayback = playback.state || {};
    handlers.updatePhoneState?.({
      musicPlaying: latestPlayback.status === 'playing',
      musicPlayback: latestPlayback,
      musicLyrics: lyrics,
      musicStatus: ''
    });
  } catch (error) {
    handlers.updatePhoneState?.({ musicPlaying: false, musicStatus: error.message || '播放失败' });
  }
}

async function startPlaylist(playlist, tracks, config, handlers) {
  const base = apiBase(config);
  const firstTrack = tracks.find(track => track.playable);
  if (!base || !firstTrack) return;
  handlers.updatePhoneState?.({
    musicTrack: firstTrack,
    musicView: 'player',
    musicReturnView: 'playlist',
    musicPlayerTab: 'cover',
    musicStatus: '正在载入歌单…'
  });
  try {
    const [playback, lyrics] = await Promise.all([
      postJson(base, '/play-playlist', {
        encryptedId: playlist.encryptedId,
        originalId: playlist.originalId
      }),
      config.apps.music.showLyrics ? loadLyrics(base, firstTrack).catch(() => []) : Promise.resolve([])
    ]);
    latestPlayback = playback.state || {};
    handlers.updatePhoneState?.({
      musicPlaying: latestPlayback.status === 'playing',
      musicPlayback: latestPlayback,
      musicLyrics: lyrics,
      musicStatus: ''
    });
  } catch (error) {
    handlers.updatePhoneState?.({ musicPlaying: false, musicStatus: error.message || '歌单播放失败' });
  }
}

function updatePlaybackDom(container, state) {
  if (!state) return;
  latestPlayback = state;
  const position = Number(state.position) || 0;
  const duration = Number(state.duration) || 0;
  const playing = state.status === 'playing';
  const range = container.querySelector('[data-music-seek]');
  if (range && document.activeElement !== range) {
    range.max = String(duration || 1);
    range.value = String(position);
  }
  const positionNode = container.querySelector('[data-music-position]');
  const durationNode = container.querySelector('[data-music-duration]');
  const miniTime = container.querySelector('[data-music-mini-time]');
  const miniProgress = container.querySelector('[data-music-mini-progress]');
  if (positionNode) positionNode.textContent = formatTime(position);
  if (durationNode) durationNode.textContent = formatTime(duration);
  if (miniTime) miniTime.textContent = formatTime(position);
  if (miniProgress) miniProgress.style.width = `${duration ? Math.min(100, (position / duration) * 100) : 0}%`;
  container.querySelector('.music-record-stage')?.classList.toggle('is-playing', playing);
  container.querySelectorAll('[data-music-toggle]').forEach(button => {
    button.textContent = playing ? 'Ⅱ' : '▶';
    button.setAttribute('aria-label', playing ? '暂停' : '播放');
  });

  const lyricNodes = [...container.querySelectorAll('[data-lyric-time]')];
  if (lyricNodes.length) {
    let nextIndex = 0;
    lyricNodes.forEach((node, index) => {
      if (Number(node.dataset.lyricTime) <= position) nextIndex = index;
    });
    if (nextIndex !== activeLyricIndex) {
      lyricNodes.forEach((node, index) => node.classList.toggle('is-active', index === nextIndex));
      lyricNodes[nextIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      activeLyricIndex = nextIndex;
    }
  }
}

function startStatePolling(container, base) {
  clearInterval(playbackPollTimer);
  playbackPollTimer = null;
  if (!base) return;
  const poll = async () => {
    if (!container.isConnected) {
      clearInterval(playbackPollTimer);
      playbackPollTimer = null;
      return;
    }
    try {
      const result = await fetchJson(`${base}/state`);
      updatePlaybackDom(container, result.state);
    } catch {
      // Keep the current UI stable during short bridge interruptions.
    }
  };
  poll();
  playbackPollTimer = setInterval(poll, 1000);
}

async function syncTrackFromState(state, osState, handlers, base) {
  const title = String(state?.title || '');
  const match = allKnownTracks(osState).find(track => title.startsWith(track.name));
  if (match && match.encryptedId !== osState.musicTrack?.encryptedId) {
    const lyrics = await loadLyrics(base, match).catch(() => []);
    handlers.updatePhoneState?.({
      musicTrack: match,
      musicLyrics: lyrics,
      musicPlayback: state,
      musicPlaying: state.status === 'playing'
    });
  } else {
    handlers.updatePhoneState?.({ musicPlayback: state, musicPlaying: state?.status === 'playing' });
  }
}

export const MusicApp = {
  render(_app, config, osState) {
    if (osState.musicView === 'player') return renderPlayer(config, osState);
    if (osState.musicView === 'playlist') return renderPlaylist(osState);
    if (osState.musicView === 'library') return renderLibrary(osState);
    return renderDiscover(config, osState);
  },

  bind(container, config, handlers, osState) {
    const base = apiBase(config);
    const tracks = allKnownTracks(osState);
    const playlists = [
      ...(osState.musicHome?.radar || []),
      ...(osState.musicHome?.charts || []),
      ...(osState.musicHome?.created || []),
      ...(osState.musicHome?.collected || []),
      ...(osState.musicPlaylist ? [osState.musicPlaylist] : [])
    ];

    if ((osState.musicView || 'discover') === 'discover' && base && !osState.musicHomeLoaded && !osState.musicHomeLoading) {
      handlers.updatePhoneState?.({ musicHomeLoading: true, musicStatus: '正在读取你的音乐推荐…' });
      loadDiscover(base, handlers);
    }

    if (osState.musicTrack) startStatePolling(container, base);
    else {
      clearInterval(playbackPollTimer);
      playbackPollTimer = null;
    }

    container.querySelector('[data-music-search]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const query = new FormData(event.currentTarget).get('keywords')?.trim();
      if (!query || !base) return;
      handlers.updatePhoneState?.({ musicQuery: query, musicSearchComplete: false, musicStatus: '正在搜索…' });
      try {
        const data = await fetchJson(`${base}/search?keywords=${encodeURIComponent(query)}&limit=12`);
        const results = (data.songs || []).map(normalizeTrack);
        handlers.updatePhoneState?.({
          musicResults: results,
          musicSearchComplete: true,
          musicStatus: results.length ? '' : '没有找到相关歌曲。'
        });
      } catch (error) {
        handlers.updatePhoneState?.({ musicSearchComplete: true, musicStatus: error.message || '搜索失败' });
      }
    });

    container.querySelector('[data-music-clear-search]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ musicQuery: '', musicResults: [], musicSearchComplete: false, musicStatus: '' });
    });
    container.querySelectorAll('[data-music-track-id]').forEach(button => {
      button.addEventListener('click', () => {
        const track = tracks.find(item => item.encryptedId === button.dataset.musicTrackId);
        if (track) startTrack(track, config, handlers, osState);
      });
    });
    container.querySelectorAll('[data-music-playlist-id]').forEach(button => {
      button.addEventListener('click', () => {
        const playlist = playlists.find(item => item.encryptedId === button.dataset.musicPlaylistId);
        if (playlist) openPlaylist(base, playlist, handlers);
      });
    });
    container.querySelector('[data-music-play-all]')?.addEventListener('click', () => {
      startPlaylist(osState.musicPlaylist, osState.musicPlaylistTracks || [], config, handlers);
    });
    container.querySelector('[data-music-back-discover]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ musicView: 'discover', musicStatus: '' });
    });
    container.querySelectorAll('[data-music-open-library]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.updatePhoneState?.({ musicView: 'library', musicLibraryTab: 'created', musicStatus: '' });
      });
    });
    container.querySelectorAll('[data-music-library-tab]').forEach(button => {
      button.addEventListener('click', () => {
        handlers.updatePhoneState?.({ musicLibraryTab: button.dataset.musicLibraryTab });
      });
    });
    container.querySelectorAll('[data-music-jump]').forEach(button => {
      button.addEventListener('click', () => {
        const target = `music-${button.dataset.musicJump}`;
        container.querySelector(`#${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    container.querySelector('[data-music-open-player]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ musicView: 'player' });
    });
    container.querySelector('[data-music-close-player]')?.addEventListener('click', () => {
      handlers.updatePhoneState?.({ musicView: osState.musicReturnView || 'discover' });
    });
    container.querySelector('[data-music-player-tab]')?.addEventListener('click', event => {
      activeLyricIndex = -1;
      handlers.updatePhoneState?.({ musicPlayerTab: event.currentTarget.dataset.musicPlayerTab });
    });
    container.querySelectorAll('[data-music-toggle]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!osState.musicTrack || !base) return;
        const isPlaying = (latestPlayback?.status || osState.musicPlayback?.status) === 'playing';
        try {
          const result = await postJson(base, '/control', { action: isPlaying ? 'pause' : 'resume' });
          latestPlayback = result.state;
          handlers.updatePhoneState?.({ musicPlayback: result.state, musicPlaying: result.state?.status === 'playing', musicStatus: '' });
        } catch (error) {
          handlers.updatePhoneState?.({ musicStatus: error.message || '播放控制失败' });
        }
      });
    });
    container.querySelectorAll('[data-music-control]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!base) return;
        try {
          const result = await postJson(base, '/control', { action: button.dataset.musicControl });
          await syncTrackFromState(result.state, osState, handlers, base);
        } catch (error) {
          handlers.updatePhoneState?.({ musicStatus: error.message || '切歌失败' });
        }
      });
    });
    container.querySelector('[data-music-seek]')?.addEventListener('change', async event => {
      if (!base) return;
      const result = await postJson(base, '/seek', { seconds: Number(event.currentTarget.value) });
      updatePlaybackDom(container, result.state);
    });
    container.querySelector('[data-music-volume]')?.addEventListener('change', async event => {
      if (!base) return;
      const result = await postJson(base, '/volume', { level: Number(event.currentTarget.value) });
      updatePlaybackDom(container, result.state);
    });
  }
};
