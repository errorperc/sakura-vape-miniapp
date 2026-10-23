// Локальный запуск магазина одной командой (npm run local), без Docker:
// встроенная PostgreSQL → миграции → сборка мини-аппа → туннель HTTPS → API + бот.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { startTunnel } from './lib/tunnel.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT ?? 4000);
const dbPort = Number(new URL(process.env.DATABASE_URL ?? 'postgresql://x@localhost:5433/db').port || 5433);
const dbName = new URL(process.env.DATABASE_URL ?? 'postgresql://x@localhost/sakura_vape').pathname.slice(1);
const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const isWin = process.platform === 'win32';
const bin = (name) => path.join(root, 'node_modules', '.bin', isWin ? `${name}.cmd` : name);

const run = (command, args, env = {}) => {
  // Одна строка команды: на Windows .cmd запускается только через shell
  const result = spawnSync([`"${command}"`, ...args].join(' '), { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`Команда завершилась с ошибкой: ${command} ${args.join(' ')}`);
};

const telegram = async (method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(`${method}: ${result.description}`);
  return result.result;
};

// ---------- база ----------
const pgDir = path.join(root, 'data', 'pg');
const pg = new EmbeddedPostgres({ databaseDir: pgDir, user: 'postgres', password: 'postgres', port: dbPort, persistent: true, onLog: () => {} });

console.log('\n  Sakura Vape — локальный запуск\n');
if (!fs.existsSync(path.join(pgDir, 'PG_VERSION'))) {
  console.log('[db] Создаю базу (один раз)...');
  await pg.initialise();
}
await pg.start();
await pg.createDatabase(dbName).catch(() => undefined);
console.log(`[db] PostgreSQL на порту ${dbPort}`);

let server = null;
// На Windows сервер запущен через cmd: закрываем всё дерево процессов, иначе порт останется занят
const killTree = (child) => {
  if (!child || child.exitCode !== null) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
};
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  killTree(server);
  await pg.stop().catch(() => undefined);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  run(bin('prisma'), ['migrate', 'deploy']);
  run(bin('tsx'), ['--env-file-if-exists=.env', 'prisma/seed.ts']);
  // Фронт и API на одном адресе — VITE_API_BASE_URL пустой
  run(bin('vite'), ['build'], { VITE_API_BASE_URL: '' });
} catch (error) {
  console.error(`\n  ⚠ ${error.message}`);
  await stop();
}

// ---------- бот: не мешаем рабочему серверу ----------
// Если вебхук бота смотрит на постоянный сервер, локальный запуск не трогает бота:
// иначе long polling снял бы вебхук и магазин на сервере перестал бы получать сообщения.
let botIsLocal = Boolean(botToken);
if (botToken) {
  const webhook = await telegram('getWebhookInfo', {}).catch(() => null);
  const url = webhook?.url ?? '';
  if (url && !/\.(lhr\.life|trycloudflare\.com)\//.test(url)) {
    botIsLocal = false;
    console.log(`\n  ⚠ Бот уже работает на сервере (${new URL(url).host}), локально он не подключается.`);
    console.log('    Для тестов на компьютере заведите отдельного бота в @BotFather и впишите его токен в .env.\n');
  }
}

// ---------- сервер ----------
const startServer = (publicUrl) => {
  server?.removeAllListeners('exit');
  killTree(server);
  server = spawn(`"${bin('tsx')}" server/src/index.ts`, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PUBLIC_APP_URL: publicUrl, SERVE_STATIC: '1', TELEGRAM_POLLING: botIsLocal ? '1' : '' },
  });
  server.on('exit', (code) => {
    if (!stopping) {
      console.error(`[api] Сервер остановился (код ${code}), перезапуск через 3 с...`);
      setTimeout(() => startServer(publicUrl), 3000);
    }
  });
};

const configureBot = async (url) => {
  if (!botIsLocal) return;
  await telegram('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url } } });
  await telegram('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть магазин' },
      { command: 'id', description: 'Узнать свой Telegram ID' },
    ],
  });
};

let publicUrl = (process.env.PUBLIC_APP_URL ?? '').trim();
if (!publicUrl) {
  try {
    publicUrl = await startTunnel(port, async (newUrl) => {
      // Бесплатный адрес сменился — перезапускаем сервер с новым адресом и обновляем кнопку бота
      publicUrl = newUrl;
      startServer(newUrl);
      await configureBot(newUrl).catch((error) => console.error('[bot]', error.message));
    });
  } catch (error) {
    console.error(`\n  ⚠ Туннель не запустился: ${error.message}\n  Мини-апп доступен только локально.\n`);
    publicUrl = `http://localhost:${port}/`;
  }
}

startServer(publicUrl);
if (!botToken) {
  console.log('  ⚠ TELEGRAM_BOT_TOKEN пуст — бот не запущен.');
} else {
  const me = await telegram('getMe', {}).catch((error) => {
    console.error(`  ⚠ Бот: ${error.message}`);
    return null;
  });
  if (me && publicUrl.startsWith('https://')) {
    await configureBot(publicUrl).catch((error) => console.error('[bot]', error.message));
  }
  if (me) console.log(`  Бот:       https://t.me/${me.username}`);
}
console.log(`  Локально:  http://localhost:${port}`);
console.log(`  Мини-апп:  ${publicUrl}`);
console.log('\n  Откройте бота и нажмите «Магазин». Остановить: Ctrl+C\n');
