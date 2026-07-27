import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));

function defaultSecretFile() {
  const appData = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
  return path.join(appData, 'lovephone-studio', 'ai-profiles.dpapi');
}

function runPowerShell(scriptName, input) {
  return new Promise((resolve, reject) => {
    const process = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(serverDirectory, scriptName)
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let output = '';
    let errorOutput = '';
    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');
    process.stdout.on('data', chunk => { output += chunk; });
    process.stderr.on('data', chunk => { errorOutput += chunk; });
    process.once('error', reject);
    process.once('exit', code => {
      if (code === 0) resolve(output);
      else reject(new Error(errorOutput.trim() || `DPAPI 命令失败（${code}）`));
    });
    process.stdin.end(input);
  });
}

function normalizeEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(entry => Array.isArray(entry) && entry.length === 2)
    .map(([profileId, profile]) => [
      String(profileId),
      {
        providerId: String(profile?.providerId || ''),
        apiKey: String(profile?.apiKey || ''),
        model: String(profile?.model || ''),
        baseUrl: String(profile?.baseUrl || '')
      }
    ]);
}

export function createSecureProfileStore(options = {}) {
  const secretFile = path.resolve(options.secretFile || process.env.LOVEPHONE_AI_SECRET_FILE || defaultSecretFile());
  const protect = options.protect || (text => runPowerShell('dpapi-protect.ps1', text));
  const unprotect = options.unprotect || (text => runPowerShell('dpapi-unprotect.ps1', text));
  const supported = options.supported ?? process.platform === 'win32';

  return {
    kind: supported ? 'windows-dpapi' : 'memory-only',
    secretFile,
    async load() {
      if (!supported) return [];
      let encrypted;
      try {
        encrypted = await readFile(secretFile, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
      const decrypted = await unprotect(encrypted);
      return normalizeEntries(JSON.parse(decrypted));
    },
    async save(entries) {
      if (!supported) return;
      const serialized = JSON.stringify(normalizeEntries(entries));
      const encrypted = await protect(serialized);
      await mkdir(path.dirname(secretFile), { recursive: true });
      const temporary = `${secretFile}.${process.pid}.tmp`;
      await writeFile(temporary, encrypted, { encoding: 'utf8', mode: 0o600 });
      try {
        await rename(temporary, secretFile);
      } catch (error) {
        if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
        await unlink(secretFile).catch(() => {});
        await rename(temporary, secretFile);
      }
    }
  };
}
