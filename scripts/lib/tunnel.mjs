import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Telegram открывает мини-аппы только по HTTPS. Для локального запуска
// поднимаем бесплатный временный туннель Cloudflare (без регистрации):
// он даёт адрес вида https://xxxx.trycloudflare.com, который ведёт на этот компьютер.

const toolsDir = path.join(ROOT, 'tools');
const isWin = process.platform === 'win32';
const localBin = path.join(toolsDir, isWin ? 'cloudflared.exe' : 'cloudflared');

function downloadUrl() {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? '386' : 'amd64';
  const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download';
  if (isWin) return `${base}/cloudflared-windows-${arch}.exe`;
  if (process.platform === 'linux') return `${base}/cloudflared-linux-${arch}`;
  return null;
}

async function ensureBinary() {
  if (fs.existsSync(localBin)) return localBin;
  const inPath = spawnSync(isWin ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8' });
  if (inPath.status === 0) return 'cloudflared';

  const url = downloadUrl();
  if (!url) throw new Error('Установите cloudflared: brew install cloudflared');
  console.log('[tunnel] Скачиваю cloudflared (один раз, ~40 МБ)...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать cloudflared: HTTP ${res.status}`);
  fs.mkdirSync(toolsDir, { recursive: true });
  fs.writeFileSync(localBin, Buffer.from(await res.arrayBuffer()));
  if (!isWin) fs.chmodSync(localBin, 0o755);
  return localBin;
}

/**
 * Сначала пробуем Cloudflare, если сеть его не пускает — localhost.run через SSH.
 * onUrlChange вызывается, когда localhost.run выдал новый адрес после переподключения.
 */
export async function startTunnel(port, onUrlChange) {
  // В сетях, где Cloudflare недоступен, можно сразу выбрать localhost.run: TUNNEL=localhost.run
  if (process.env.TUNNEL === 'localhost.run') return startLocalhostRun(port, onUrlChange);
  try {
    return await startCloudflare(port);
  } catch (error) {
    console.error(`[tunnel] Cloudflare: ${error.message}`);
    console.log('[tunnel] Пробую запасной туннель localhost.run...');
    return await startLocalhostRun(port, onUrlChange);
  }
}

async function startCloudflare(port) {
  const bin = await ensureBinary();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let done = false;
    let url = null;
    // Адрес cloudflared печатает сразу, но работать он начинает только после
    // строки "Registered tunnel connection" — до этого Cloudflare отдаёт ошибку 530.
    const onData = (chunk) => {
      const text = String(chunk);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !url) url = match[0];
      if (url && !done && /Registered tunnel connection/.test(text)) {
        done = true;
        resolve(url);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => !done && reject(e));
    child.on('exit', (code) => {
      if (!done) reject(new Error(`cloudflared завершился с кодом ${code}`));
      else console.error('[tunnel] Туннель закрылся. Перезапустите сервер.');
    });
    setTimeout(() => {
      if (done) return;
      child.kill();
      reject(
        new Error(
          url
            ? 'cloudflared не смог подключиться к Cloudflare за 60 с. Вероятно, сеть блокирует порт 7844 — включите VPN.'
            : 'cloudflared не выдал адрес за 60 с',
        ),
      );
    }, 60_000);
    const stop = () => child.kill();
    process.on('exit', stop);
  });
}

// Запасной вариант: бесплатный localhost.run, работает через обычный SSH (порт 22).
// Бесплатный адрес *.lhr.life может смениться при переподключении — тогда вызываем onUrlChange.
export function startLocalhostRun(port, onUrlChange) {
  return new Promise((resolve, reject) => {
    let current = null;
    let stopped = false;
    let child = null;

    const connect = () => {
      child = spawn(
        'ssh',
        [
          '-o', 'StrictHostKeyChecking=accept-new',
          '-o', 'ServerAliveInterval=30',
          '-o', 'ExitOnForwardFailure=yes',
          '-R', `80:127.0.0.1:${port}`,
          'nokey@localhost.run',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const onData = (chunk) => {
        const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.lhr\.life/);
        if (!match || match[0] === current) return;
        const first = !current;
        current = match[0];
        if (first) resolve(current);
        else {
          console.log(`[tunnel] Новый адрес localhost.run: ${current}`);
          onUrlChange?.(current);
        }
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('error', (e) => !current && reject(new Error(`не удалось запустить ssh: ${e.message}`)));
      child.on('exit', (code) => {
        if (stopped) return;
        if (!current) return reject(new Error(`ssh завершился с кодом ${code}`));
        console.error('[tunnel] Связь с localhost.run пропала, переподключаюсь через 5 с...');
        setTimeout(connect, 5000);
      });
    };

    connect();
    setTimeout(() => {
      if (current) return;
      stopped = true;
      child.kill();
      reject(new Error('localhost.run не выдал адрес за 30 с'));
    }, 30_000);
    const stop = () => {
      stopped = true;
      child.kill();
    };
    process.on('exit', stop);
  });
}
