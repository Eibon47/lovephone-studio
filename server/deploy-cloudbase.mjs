import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'cloudbaserc.local.json');
const configArgument = 'cloudbaserc.local.json';

let config;
try {
  config = JSON.parse(await readFile(configPath, 'utf8'));
} catch {
  throw new Error('请先把 cloudbaserc.example.json 复制为 cloudbaserc.local.json，并填写自己的 CloudBase 环境 ID。');
}

const envId = String(config.envId || '').trim();
if (!/^[a-zA-Z0-9-]{3,80}$/.test(envId) || envId === 'your-cloudbase-environment-id') {
  throw new Error('cloudbaserc.local.json 中的 envId 尚未配置。');
}

function run(command, args) {
  const windows = process.platform === 'win32';
  const executable = windows ? process.env.ComSpec || 'cmd.exe' : command;
  const quoteWindowsArgument = value => {
    const text = String(value);
    return /^[a-zA-Z0-9_./:=+-]+$/.test(text)
      ? text
      : `"${text.replace(/"/g, '""')}"`;
  };
  const commandArgs = windows
    ? ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArgument).join(' ')]
    : args;
  const result = spawnSync(executable, commandArgs, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run('npm', ['test']);
run('npm', ['run', 'web:build']);
run('cloudbase', ['fn', 'deploy', 'ai-gateway', '--force', '--install-dependency', 'false', '--config-file', configArgument]);
run('cloudbase', ['fn', 'deploy', 'wangyiyun66-gateway', '--force', '--install-dependency', 'true', '--config-file', configArgument]);
run('cloudbase', ['hosting', 'deploy', 'dist', '-e', envId, '--enable-git-ignore']);
