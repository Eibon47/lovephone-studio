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

export function isPwaInstallAvailable() {
  return Boolean(deferredInstallPrompt);
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
    return { outcome: 'unavailable' };
  }

  const prompt = deferredInstallPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  deferredInstallPrompt = null;
  return choice;
}
