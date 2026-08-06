import { getAiProviderStatuses } from './aiService.js?v=app-config-57';
import { testMusicApi } from './musicService.js?v=app-config-91';

function result(status, message) {
  return { status, message };
}

export async function checkStartupHealth(config, storageStatus = {}, dependencies = {}) {
  const online = dependencies.online ?? navigator.onLine;
  const checkAi = dependencies.checkAi || (() => getAiProviderStatuses(config));
  const musicConfigured = Boolean(config.apps?.music?.onlineEnabled && config.apps?.music?.apiBaseUrl);
  const checkMusic = dependencies.checkMusic || (() => testMusicApi(config.apps?.music?.apiBaseUrl));
  const musicEnabled = Boolean(config.apps?.music?.enabled);

  const [aiCheck, musicCheck] = await Promise.allSettled([
    checkAi(),
    musicConfigured ? checkMusic() : Promise.resolve(null)
  ]);

  const storage = storageStatus.state === 'error'
    ? result('error', storageStatus.message || '本地存储不可用')
    : storageStatus.state === 'warning'
      ? result('warning', storageStatus.message || '本地空间不足')
      : result('ok', '本地数据可以正常保存');
  const network = online
    ? result('ok', '网络连接可用')
    : result('error', '当前处于断网状态');
  const ai = aiCheck.status === 'fulfilled'
    ? result('ok', 'AI 服务已连接')
    : result('error', 'AI 服务无法连接，请检查网络或本机桥接');
  const music = !musicEnabled
    ? result('skipped', '音乐 App 未启用')
    : !musicConfigured
      ? result('ok', '本地音乐可用；在线音乐尚未配置')
    : musicCheck.status === 'fulfilled'
      ? result('ok', '在线音乐服务已连接')
      : result('warning', '在线音乐服务无法连接，本地音乐仍可用');

  return {
    checkedAt: new Date().toISOString(),
    storage,
    network,
    ai,
    music
  };
}
