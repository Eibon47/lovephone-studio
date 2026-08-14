let deferredInstallPrompt = null;

export function isPhoneMode(search = globalThis.location?.search || '', standalone = false) {
  return standalone || new URLSearchParams(search).get('mode') === 'phone';
}

export function getStandaloneUrl(locationLike = globalThis.location) {
  const url = new URL(locationLike.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', 'phone');
  return url.toString();
}

export function getStudioUrl(locationLike = globalThis.location, step = 'save') {
  const url = new URL(locationLike.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('step', step);
  return url.toString();
}

export function isPwaInstallAvailable() {
  return Boolean(deferredInstallPrompt);
}

export function getPwaInstallHelp(userAgent = globalThis.navigator?.userAgent || '') {
  const agent = String(userAgent).toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) {
    return '当前浏览器不能直接弹出安装窗口。请在 Safari 点“分享”，再选“添加到主屏幕”。';
  }
  return '当前窗口不能直接安装。请用 Chrome 或 Edge 打开小手机网址，再从浏览器菜单选择“安装应用”或“安装此网站为应用”。';
}

export function setupPwa({ onInstallAvailabilityChange } = {}) {
  if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('PWA service worker registration failed:', error);
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    onInstallAvailabilityChange?.(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    onInstallAvailabilityChange?.(false);
  });
}

export async function installPwa() {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable', message: getPwaInstallHelp() };
  }

  const prompt = deferredInstallPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  deferredInstallPrompt = null;
  return choice;
}
