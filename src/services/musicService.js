const DB_NAME = 'lovePhoneStudioMusic';
const DB_VERSION = 1;
const TRACK_STORE = 'tracks';
const AUDIO_STORE = 'audio';
const SESSION_STORE = 'session';
const SESSION_KEY = 'netease-cookie';

let databasePromise = null;
let audio = null;
let objectUrl = '';
let queue = [];
let currentIndex = -1;
let currentTrack = null;
let statusListener = null;
let lastEmittedSecond = -1;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地音乐数据库操作失败。'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('本地音乐保存失败。'));
    transaction.onabort = () => reject(transaction.error || new Error('本地音乐保存已取消。'));
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持本地音乐库。'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRACK_STORE)) database.createObjectStore(TRACK_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(AUDIO_STORE)) database.createObjectStore(AUDIO_STORE);
      if (!database.objectStoreNames.contains(SESSION_STORE)) database.createObjectStore(SESSION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('无法打开本地音乐库。'));
    };
  });
  return databasePromise;
}

function safeText(value, fallback = '') {
  const text = String(value || '').replace(/[\u0000-\u001f]/g, '').trim();
  return text || fallback;
}

function trackId() {
  return `local-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function mimeAllowed(file) {
  return /^audio\/(mpeg|mp4|aac|ogg|wav|webm|flac)$/i.test(file?.type || '')
    || /\.(mp3|m4a|aac|ogg|wav|webm|flac)$/i.test(file?.name || '');
}

export function musicBaseUrl(config) {
  return String(config?.apps?.music?.apiBaseUrl || '').trim().replace(/\/+$/, '');
}

export function normalizeMusicApiUrl(value) {
  const input = String(value || '').trim().replace(/\/+$/, '');
  if (!input) return '';
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export async function musicFetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'omit' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `音乐接口返回 ${response.status}`);
  return data;
}

export function musicPostJson(base, path, body) {
  return musicFetchJson(`${musicBaseUrl({ apps: { music: { apiBaseUrl: base } } })}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function clearMusicSession() {
  // Kept as a no-op so older callers do not break after removing the desktop bridge.
}

export async function loadLocalTracks() {
  const database = await openDatabase();
  const transaction = database.transaction(TRACK_STORE, 'readonly');
  const tracks = await requestResult(transaction.objectStore(TRACK_STORE).getAll());
  await transactionDone(transaction);
  return (tracks || []).sort((left, right) => String(right.addedAt).localeCompare(String(left.addedAt)));
}

export async function importLocalAudio(file) {
  if (!file || !mimeAllowed(file)) throw new Error('请选择 MP3、M4A、AAC、OGG、WAV、WebM 或 FLAC 音频文件。');
  if (file.size > 100 * 1024 * 1024) throw new Error('单首本地音乐不能超过 100MB。');
  const id = trackId();
  const title = safeText(file.name.replace(/\.[^.]+$/, ''), '未命名音乐');
  const track = {
    id,
    encryptedId: id,
    originalId: id,
    source: 'local',
    name: title,
    artist: '本地音乐',
    album: '我的音乐库',
    cover: '',
    duration: 0,
    playable: true,
    addedAt: new Date().toISOString(),
    size: Number(file.size) || 0,
    mime: String(file.type || '')
  };
  const database = await openDatabase();
  const transaction = database.transaction([TRACK_STORE, AUDIO_STORE], 'readwrite');
  transaction.objectStore(TRACK_STORE).put(track);
  transaction.objectStore(AUDIO_STORE).put(file, id);
  await transactionDone(transaction);
  return track;
}

export async function deleteLocalAudio(id) {
  const database = await openDatabase();
  const transaction = database.transaction([TRACK_STORE, AUDIO_STORE], 'readwrite');
  transaction.objectStore(TRACK_STORE).delete(id);
  transaction.objectStore(AUDIO_STORE).delete(id);
  await transactionDone(transaction);
}

async function readLocalAudio(id) {
  const database = await openDatabase();
  const transaction = database.transaction(AUDIO_STORE, 'readonly');
  const blob = await requestResult(transaction.objectStore(AUDIO_STORE).get(id));
  await transactionDone(transaction);
  return blob instanceof Blob ? blob : null;
}

async function readSessionCookie() {
  const database = await openDatabase();
  const transaction = database.transaction(SESSION_STORE, 'readonly');
  const value = await requestResult(transaction.objectStore(SESSION_STORE).get(SESSION_KEY));
  await transactionDone(transaction);
  return safeText(value);
}

export async function saveMusicCookie(cookie) {
  const database = await openDatabase();
  const transaction = database.transaction(SESSION_STORE, 'readwrite');
  transaction.objectStore(SESSION_STORE).put(safeText(cookie), SESSION_KEY);
  await transactionDone(transaction);
}

export async function clearMusicCookie() {
  const database = await openDatabase();
  const transaction = database.transaction(SESSION_STORE, 'readwrite');
  transaction.objectStore(SESSION_STORE).delete(SESSION_KEY);
  await transactionDone(transaction);
}

async function neteaseJson(baseUrl, path, params = {}) {
  const base = normalizeMusicApiUrl(baseUrl);
  if (!base) throw new Error('请先填写可信的 HTTPS 兼容音乐 API 地址。');
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const cookie = await readSessionCookie();
  if (cookie) url.searchParams.set('cookie', cookie);
  url.searchParams.set('timestamp', String(Date.now()));
  return musicFetchJson(url.toString());
}

function mediaUrl(value) {
  return String(value || '').replace(/^http:\/\//i, 'https://');
}

function mapNeteaseTrack(song = {}) {
  const artists = song.ar || song.artists || [];
  const album = song.al || song.album || {};
  const id = String(song.id || '');
  return {
    id: `netease-${id}`,
    encryptedId: id,
    originalId: id,
    source: 'netease',
    name: safeText(song.name, '未命名歌曲'),
    artist: artists.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).join(' / ') || '未知歌手',
    album: safeText(album.name || song.albumName, '未知专辑'),
    cover: mediaUrl(album.picUrl || song.coverImgUrl),
    duration: Number(song.dt || song.duration) || 0,
    playable: true
  };
}

function mapPlaylist(playlist = {}) {
  return {
    id: String(playlist.id || ''),
    encryptedId: String(playlist.id || ''),
    name: safeText(playlist.name, '未命名歌单'),
    cover: mediaUrl(playlist.coverImgUrl),
    description: safeText(playlist.description),
    creator: safeText(playlist.creator?.nickname || playlist.creatorNickname),
    trackCount: Number(playlist.trackCount) || 0,
    playCount: Number(playlist.playCount) || 0,
    tags: Array.isArray(playlist.tags) ? playlist.tags : []
  };
}

export async function testMusicApi(baseUrl) {
  const data = await neteaseJson(baseUrl, '/cloudsearch', { keywords: 'LovePhone', limit: 1 });
  return { ok: true, message: Array.isArray(data?.result?.songs) ? '兼容音乐 API 已连接' : '服务已响应，但未返回预期搜索结果' };
}

export async function searchOnlineMusic(baseUrl, keywords, limit = 20) {
  const data = await neteaseJson(baseUrl, '/cloudsearch', { keywords, limit });
  return (data?.result?.songs || []).map(mapNeteaseTrack);
}

export async function loadOnlineHome(baseUrl) {
  const [personalized, toplists] = await Promise.all([
    neteaseJson(baseUrl, '/personalized', { limit: 6 }).catch(() => ({})),
    neteaseJson(baseUrl, '/toplist/detail').catch(() => ({}))
  ]);
  const daily = (personalized?.result || []).map(mapNeteaseTrack);
  const charts = (toplists?.list || []).slice(0, 8).map(mapPlaylist);
  return { daily, charts, radar: [], created: [], collected: [], ranking: [] };
}

export async function loadOnlinePlaylist(baseUrl, playlistId) {
  const data = await neteaseJson(baseUrl, '/playlist/track/all', { id: playlistId, limit: 100 });
  return (data?.songs || []).map(mapNeteaseTrack);
}

export async function loadOnlineLyrics(baseUrl, trackId) {
  const data = await neteaseJson(baseUrl, '/lyric', { id: trackId });
  return String(data?.lrc?.lyric || '');
}

export async function resolveOnlineStream(baseUrl, trackId) {
  const data = await neteaseJson(baseUrl, '/song/url', { id: trackId });
  const item = data?.data?.[0];
  const url = mediaUrl(item?.url);
  if (url) return url;
  if (item?.fee === 1) throw new Error('这首歌需要网易云会员或当前账号没有播放权限。');
  throw new Error('这首歌当前没有可播放的音源。');
}

export async function startQrLogin(baseUrl) {
  const keyData = await neteaseJson(baseUrl, '/login/qr/key');
  const key = keyData?.data?.unikey;
  if (!key) throw new Error('无法获取登录二维码。');
  const imageData = await neteaseJson(baseUrl, '/login/qr/create', { key, qrimg: true });
  const image = String(imageData?.data?.qrimg || '');
  if (!image) throw new Error('无法生成登录二维码。');
  return { key, image };
}

export async function checkQrLogin(baseUrl, key) {
  const data = await neteaseJson(baseUrl, '/login/qr/check', { key });
  if (Number(data?.code) === 803 && data?.cookie) await saveMusicCookie(data.cookie);
  return {
    code: Number(data?.code) || 0,
    message: safeText(data?.message),
    nickname: safeText(data?.profile?.nickname),
    loggedIn: Number(data?.code) === 803
  };
}

export function setMusicStateListener(listener) {
  statusListener = typeof listener === 'function' ? listener : null;
  if (statusListener) statusListener(snapshot());
}

function snapshot() {
  return {
    track: currentTrack,
    state: {
      status: audio && !audio.paused ? 'playing' : 'paused',
      position: Number(audio?.currentTime) || 0,
      duration: Number(audio?.duration) || (Number(currentTrack?.duration) || 0) / 1000,
      volume: Math.round((Number(audio?.volume) || 0.7) * 100),
      queueLength: queue.length,
      currentIndex: Math.max(0, currentIndex)
    }
  };
}

function emitState(force = false) {
  const second = Math.floor(Number(audio?.currentTime) || 0);
  if (!force && second === lastEmittedSecond) return;
  lastEmittedSecond = second;
  statusListener?.(snapshot());
}

function player() {
  if (audio) return audio;
  audio = new Audio();
  audio.volume = 0.7;
  audio.addEventListener('timeupdate', () => emitState());
  audio.addEventListener('loadedmetadata', () => emitState(true));
  audio.addEventListener('play', () => emitState(true));
  audio.addEventListener('pause', () => emitState(true));
  audio.addEventListener('ended', () => { void playNext(); });
  audio.addEventListener('error', () => emitState(true));
  return audio;
}

function clearObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
}

export async function playMusicTrack(track, options = {}) {
  const instance = player();
  clearObjectUrl();
  instance.pause();
  let sourceUrl = options.sourceUrl || '';
  if (track?.source === 'local') {
    const blob = await readLocalAudio(track.id);
    if (!blob) throw new Error('找不到这首本地音乐文件。');
    objectUrl = URL.createObjectURL(blob);
    sourceUrl = objectUrl;
  }
  if (!sourceUrl) throw new Error('没有可播放的音乐地址。');
  currentTrack = track;
  const found = queue.findIndex(item => item.id === track.id);
  if (found >= 0) currentIndex = found;
  instance.src = sourceUrl;
  instance.currentTime = 0;
  try {
    await instance.play();
  } catch {
    emitState(true);
    throw new Error('浏览器阻止自动播放，请再次点击播放按钮。');
  }
  emitState(true);
  return snapshot();
}

export function setMusicQueue(tracks, selectedTrack = null) {
  queue = Array.isArray(tracks) ? tracks.filter(track => track?.playable !== false) : [];
  currentIndex = selectedTrack ? queue.findIndex(track => track.id === selectedTrack.id) : currentIndex;
  if (currentIndex < 0 && queue.length) currentIndex = 0;
  emitState(true);
}

export function stopMusicPlayback() {
  if (!audio) return snapshot();
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  clearObjectUrl();
  currentTrack = null;
  currentIndex = 0;
  emitState(true);
  return snapshot();
}

export async function toggleMusicPlayback() {
  const instance = player();
  if (!currentTrack) throw new Error('请先选择一首歌。');
  if (instance.paused) await instance.play();
  else instance.pause();
  emitState(true);
  return snapshot();
}

export function seekMusic(seconds) {
  const instance = player();
  instance.currentTime = Math.max(0, Math.min(Number(seconds) || 0, Number(instance.duration) || Infinity));
  emitState(true);
  return snapshot();
}

export function setMusicVolume(level) {
  const instance = player();
  instance.volume = Math.max(0, Math.min(1, (Number(level) || 0) / 100));
  emitState(true);
  return snapshot();
}

export async function playNext(direction = 1, resolveOnline) {
  if (!queue.length) throw new Error('播放队列为空。');
  currentIndex = (Math.max(0, currentIndex) + direction + queue.length) % queue.length;
  const track = queue[currentIndex];
  const sourceUrl = track.source === 'netease' ? await resolveOnline?.(track) : '';
  return playMusicTrack(track, { sourceUrl });
}

export async function playPrevious(resolveOnline) {
  return playNext(-1, resolveOnline);
}
