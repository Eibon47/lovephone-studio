import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, dialog, session } from 'electron';

const projectRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const singleInstance = app.requestSingleInstanceLock();
let mainWindow = null;
let runtimeProcess = null;
const runtimeToken = randomBytes(24).toString('hex');
const runtimeProof = createHash('sha256').update(runtimeToken).digest('hex');
const experimentalMusic = !app.isPackaged || process.env.LOVEPHONE_EXPERIMENTAL_MUSIC === '1';

if (!singleInstance) app.quit();

function appRoot() {
  return app.isPackaged ? app.getAppPath() : projectRoot;
}

function runtimeWorkingDirectory() {
  return app.isPackaged ? process.resourcesPath : projectRoot;
}

function mpvDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'mpv')
    : (process.env.MPV_DIRECTORY || 'C:\\Program Files\\MPV Player');
}

function startRuntime() {
  const root = appRoot();
  runtimeProcess = spawn(process.execPath, [path.join(root, 'server', 'desktop-runtime.mjs')], {
    cwd: runtimeWorkingDirectory(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      LOVEPHONE_APP_ROOT: root,
      LOVEPHONE_WEB_PORT: '5177',
      LOVEPHONE_MUSIC_PORT: '5188',
      LOVEPHONE_AI_PORT: '5189',
      LOVEPHONE_DESKTOP_INSTANCE_TOKEN: runtimeToken,
      LOVEPHONE_TRUSTED_ORIGINS: 'http://127.0.0.1:5177',
      LOVEPHONE_EXPERIMENTAL_MUSIC: experimentalMusic ? '1' : '0',
      ...(experimentalMusic ? {
        NCM_CLI_JS: path.join(root, 'node_modules', '@music163', 'ncm-cli', 'dist', 'index.js'),
        MPV_DIRECTORY: mpvDirectory()
      } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  runtimeProcess.stdout.on('data', chunk => console.log(String(chunk).trim()));
  runtimeProcess.stderr.on('data', chunk => console.error(String(chunk).trim()));
  runtimeProcess.once('error', error => {
    console.error('LovePhone runtime failed:', error);
  });
  runtimeProcess.once('exit', code => {
    if (app.isQuitting) return;
    dialog.showErrorBox(
      'LovePhone OS 无法启动',
      code === 0
        ? '本机服务意外停止，请重新打开应用。'
        : '本机服务启动失败。请确认 5177、5188、5189 端口没有被其他程序占用。'
    );
    app.quit();
  });
}

async function waitForWebServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:5177/__lovephone_runtime');
      if (response.ok) {
        const status = await response.json();
        if (status.instance === runtimeProof) return;
      }
    } catch {
      // The runtime may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('LovePhone 本机服务启动超时，或端口已被其他程序占用。');
}

function configurePermissions() {
  const allowedOrigin = 'http://127.0.0.1:5177';
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const origin = new URL(webContents.getURL()).origin;
    callback(origin === allowedOrigin && ['media', 'notifications'].includes(permission));
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 470,
    height: 940,
    minWidth: 410,
    minHeight: 760,
    backgroundColor: '#10201a',
    autoHideMenuBar: true,
    show: false,
    title: 'LovePhone OS',
    icon: path.join(appRoot(), 'assets', 'app-icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1:5177/')) event.preventDefault();
  });
  await mainWindow.loadURL('http://127.0.0.1:5177/?mode=phone');
  mainWindow.once('ready-to-show', () => mainWindow?.show());
}

app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  runtimeProcess?.kill();
});

app.whenReady()
  .then(async () => {
    configurePermissions();
    startRuntime();
    await waitForWebServer();
    await createWindow();
  })
  .catch(error => {
    dialog.showErrorBox('LovePhone OS 无法启动', error?.message || '本机服务启动失败。');
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
