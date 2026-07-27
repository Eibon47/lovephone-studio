import { getAiProviderStatuses } from './aiService.js?v=app-config-57';
import { musicFetchJson } from './musicService.js?v=app-config-49';

function result(status, message) {
  return { status, message };
}

export async function checkStartupHealth(config, storageStatus = {}, dependencies = {}) {
  const online = dependencies.online ?? navigator.onLine;
  const checkAi = dependencies.checkAi || (() => getAiProviderStatuses(config));
  const checkMusic = dependencies.checkMusic || (() => musicFetchJson('/health'));
  const musicEnabled = Boolean(config.apps?.music?.enabled);

  const [aiCheck, musicCheck] = await Promise.allSettled([
    checkAi(),
    musicEnabled ? checkMusic() : Promise.resolve(null)
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
    ? result('ok', 'AI 本机服务已连接')
    : result('error', 'AI 本机服务未启动');
  const music = !musicEnabled
    ? result('skipped', '音乐 App 未启用')
    : musicCheck.status === 'fulfilled'
      ? result(
          musicCheck.value?.authenticated ? 'ok' : 'warning',
          musicCheck.value?.authenticated ? '音乐服务和网易云登录正常' : '音乐服务在线，尚未登录网易云'
        )
      : result('error', '音乐本机服务未启动');

  return {
    checkedAt: new Date().toISOString(),
    storage,
    network,
    ai,
    music
  };
}
