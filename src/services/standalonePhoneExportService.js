import { strToU8, zipSync } from '../../assets/vendor/fflate/fflate.js';
import { normalizeConfig } from '../config/schema.js';
import { getCustomAppStore } from '../storage/customAppStore.js';

const RUNTIME_FILES = [
  'index.html', 'manifest.webmanifest', 'sw.js',
  'assets/app-icon-192.png', 'assets/app-icon-512.png',
  'assets/vendor/fflate/fflate.js', 'assets/vendor/gridstack/gridstack-all.js', 'assets/vendor/gridstack/gridstack.min.css',
  'assets/theme-fantasy/ui-icons/bell.png', 'assets/theme-fantasy/ui-icons/camera.png', 'assets/theme-fantasy/ui-icons/cat.png',
  'assets/theme-fantasy/ui-icons/chat.png', 'assets/theme-fantasy/ui-icons/clock.png', 'assets/theme-fantasy/ui-icons/cloud.png',
  'assets/theme-fantasy/ui-icons/crown.png', 'assets/theme-fantasy/ui-icons/diary.png', 'assets/theme-fantasy/ui-icons/dragon.png',
  'assets/theme-fantasy/ui-icons/empty.png', 'assets/theme-fantasy/ui-icons/fire.png', 'assets/theme-fantasy/ui-icons/flower.png',
  'assets/theme-fantasy/ui-icons/forbid.png', 'assets/theme-fantasy/ui-icons/fox.png', 'assets/theme-fantasy/ui-icons/ghost.png',
  'assets/theme-fantasy/ui-icons/globe.png', 'assets/theme-fantasy/ui-icons/handshake.png', 'assets/theme-fantasy/ui-icons/heart.png',
  'assets/theme-fantasy/ui-icons/ice.png', 'assets/theme-fantasy/ui-icons/letter.png', 'assets/theme-fantasy/ui-icons/moon.png',
  'assets/theme-fantasy/ui-icons/music.png', 'assets/theme-fantasy/ui-icons/people.png', 'assets/theme-fantasy/ui-icons/pin.png',
  'assets/theme-fantasy/ui-icons/relationship.png', 'assets/theme-fantasy/ui-icons/sparkle.png', 'assets/theme-fantasy/ui-icons/sprout.png',
  'assets/theme-fantasy/ui-icons/sword.png', 'assets/theme-fantasy/ui-icons/tag.png', 'assets/theme-fantasy/ui-icons/thought.png',
  'src/main.js',
  'src/apps/AnniversaryApp.js', 'src/apps/appData.js', 'src/apps/CharacterApp.js', 'src/apps/ChatApp.js', 'src/apps/DiaryApp.js',
  'src/apps/GoodnightApp.js', 'src/apps/MemoryApp.js', 'src/apps/MusicApp.js', 'src/apps/PlaceholderApp.js', 'src/apps/SettingsApp.js',
  'src/builder/AiAssistantPanel.js', 'src/builder/AppearancePanel.js', 'src/builder/AppSelectionPanel.js', 'src/builder/CustomizationDrawer.js', 'src/builder/PreviewActions.js',
  'src/config/aiProviderCatalog.js', 'src/config/defaultConfig.js', 'src/config/schema.js', 'src/config/templates.js',
  'src/services/aiErrors.js', 'src/services/aiProfileCleanup.js', 'src/services/aiProfileScope.js', 'src/services/aiService.js',
  'src/services/anniversaryService.js', 'src/services/autoMemoryService.js', 'src/services/builderAssistantService.js', 'src/services/characterDataService.js',
  'src/services/characterPresenceService.js', 'src/services/chatSessionService.js', 'src/services/companionLinkService.js', 'src/services/customizationModel.js',
  'src/services/diarySummaryService.js', 'src/services/greetingService.js', 'src/services/imageUploadService.js', 'src/services/listUndo.js',
  'src/services/musicService.js', 'src/services/phoneNotificationService.js', 'src/services/phoneSetupService.js', 'src/services/pwaService.js',
  'src/services/speechRecognitionService.js', 'src/services/standalonePhoneExportService.js', 'src/services/startupHealthService.js', 'src/services/themePackageService.js', 'src/services/weatherService.js',
  'src/services/customAppPackageService.js', 'src/storage/customizationStore.js', 'src/storage/customAppStore.js', 'src/storage/localConfigStore.js',
  'src/styles/base.css', 'src/styles/builder.css', 'src/styles/phone-preview.css', 'src/styles/phone-system.css',
  'src/system/appAppearance.js', 'src/system/appRegistry.js', 'src/system/AppRouter.js', 'src/system/customizationRuntime.js',
  'src/system/customWidgetRuntime.js', 'src/system/CustomAppRuntime.js', 'src/system/GridStackWidgets.js', 'src/system/HomeScreen.js', 'src/system/HomeWidgetActions.js',
  'src/system/html.js', 'src/system/icons.js', 'src/system/LovePhoneOS.js', 'src/system/options.js', 'src/system/StatusBar.js', 'src/system/widgetCatalog.js'
];

function safeFileName(value, fallback = 'lovephone') {
  return String(value || fallback).replace(/[\\/:*?"<>|]/g, '-').trim() || fallback;
}

function exportId() {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `phone-${String(random).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`;
}

function scriptJson(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function exportedIndex(source, title) {
  const withTitle = source.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeFileName(title, '我的小手机')}</title>`);
  const configScript = '<script src="./lovephone.config.js"></script>\n    <script src="./lovephone.custom-apps.js"></script>';
  if (!withTitle.includes('src/main.js')) throw new Error('小手机运行时入口不完整，无法导出。');
  return withTitle.replace(/(<script\s+type="module"\s+src="src\/main\.js[^>]*><\/script>)/i, `${configScript}\n    $1`);
}

function exportedManifest(config) {
  const title = String(config.meta?.title || '我的小手机');
  return JSON.stringify({
    id: './', name: title, short_name: title.slice(0, 12),
    description: '由 LovePhone Studio 生成的本地小手机',
    lang: 'zh-CN', start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
    background_color: '#10201a', theme_color: '#10201a',
    icons: [
      { src: './assets/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: './assets/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }, null, 2);
}

function exportedReadme(config) {
  return `# ${config.meta?.title || '我的小手机'}\n\n这是一个独立的纯 HTML 小手机。\n\n## 使用\n\n- 电脑上可直接打开 index.html 查看基础界面。\n- 推荐上传整个文件夹到 Netlify、GitHub Pages、Vercel 或任意静态网站空间后使用。\n- 部署到自己的网址后，可以在手机浏览器中打开，并使用“添加到主屏幕”。\n\n## 数据与联网能力\n\n- 角色、聊天、日记、主题和图片会保存到当前浏览器。\n- 这份导出不包含 API Key、浏览器中的登录 Cookie 或本地导入的音频文件。\n- AI、在线音乐和天气仍需要你自行配置可访问的服务；纯 HTML 成品不内置服务器。\n`;
}

function bytesToBase64(bytes) {
  let text = '';
  for (let index = 0; index < bytes.length; index += 0x8000) text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(text);
}

function buildExportFiles(config, runtime, id, customApps = []) {
  const files = { ...runtime };
  files['index.html'] = strToU8(exportedIndex(new TextDecoder().decode(runtime['index.html']), config.meta?.title));
  files['manifest.webmanifest'] = strToU8(exportedManifest(config));
  files['lovephone.config.js'] = strToU8(`globalThis.__LOVE_PHONE_EXPORT__ = ${scriptJson({ formatVersion: 1, id, config })};\n`);
  files['lovephone.custom-apps.js'] = strToU8(`globalThis.__LOVE_PHONE_EXPORT_APPS__ = ${scriptJson({ formatVersion: 1, apps: customApps.map(app => ({ id: app.id, permissions: app.permissions || [], archive: bytesToBase64(app.archive instanceof Uint8Array ? app.archive : new Uint8Array(app.archive)) })) })};\n`);
  if (runtime['sw.js']) {
    const source = new TextDecoder().decode(runtime['sw.js']);
    files['sw.js'] = strToU8(source.replace('const APP_SHELL = [', "const APP_SHELL = [\n  './lovephone.config.js',\n  './lovephone.custom-apps.js',"));
  }
  files['README-本地小手机.md'] = strToU8(exportedReadme(config));
  return files;
}

async function fetchRuntime(fetchImpl) {
  const runtime = {};
  for (let index = 0; index < RUNTIME_FILES.length; index += 8) {
    const batch = RUNTIME_FILES.slice(index, index + 8);
    const results = await Promise.all(batch.map(async file => {
      const response = await fetchImpl(new URL(file, globalThis.location.href), { cache: 'no-store' });
      if (!response.ok) throw new Error(`无法读取导出文件：${file}`);
      return [file, new Uint8Array(await response.arrayBuffer())];
    }));
    Object.assign(runtime, Object.fromEntries(results));
  }
  return runtime;
}

export async function createStandalonePhoneArchive(config, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const normalized = normalizeConfig(config);
  const runtime = await fetchRuntime(fetchImpl);
  const id = exportId();
  const customApps = await getCustomAppStore().exportApps().catch(() => []);
  const files = buildExportFiles(normalized, runtime, id, customApps);
  return {
    bytes: zipSync(files, { level: 6 }),
    fileCount: Object.keys(files).length,
    filename: `${safeFileName(normalized.meta?.title, 'lovephone')}-本地小手机.zip`
  };
}

export function downloadStandalonePhoneArchive(archive) {
  const blob = new Blob([archive.bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = archive.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const standalonePhoneExportFilesForTest = buildExportFiles;
