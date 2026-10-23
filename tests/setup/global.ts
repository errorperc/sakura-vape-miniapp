// Тестовое окружение: отдельная встроенная PostgreSQL, наш API-сервер и заглушка Bot API Telegram,
// которая записывает все запросы бота вместо отправки в настоящий Telegram.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { TEST_BOT_TOKEN, TEST_MANAGER_ID, TEST_OWNER_ID } from './constants';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const dbPort = 5434;
const apiPort = 4100;
const stubPort = 4199;
const databaseUrl = `postgresql://postgres:postgres@localhost:${dbPort}/sakura_test?schema=public`;
const bin = (name: string) => path.join(root, 'node_modules', '.bin', isWin ? `${name}.cmd` : name);

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    stubUrl: string;
    databaseUrl: string;
  }
}

const killTree = (child: ChildProcess | null) => {
  if (!child || child.exitCode !== null) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
};

const startTelegramStub = () => {
  const calls: Array<{ method: string; body: unknown }> = [];
  const server = http.createServer((request, response) => {
    if (request.url === '/__calls') {
      if (request.method === 'DELETE') calls.length = 0;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(calls));
      return;
    }
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      const method = (request.url ?? '').split('/').pop() ?? '';
      calls.push({ method, body: raw ? JSON.parse(raw) : null });
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, result: method === 'getUpdates' ? [] : { message_id: 1 } }));
    });
  });
  return new Promise<http.Server>((resolve) => server.listen(stubPort, '127.0.0.1', () => resolve(server)));
};

export default async function setup(project: TestProject) {
  const pgDir = path.join(root, 'data', 'pg-test');
  const pg = new EmbeddedPostgres({ databaseDir: pgDir, port: dbPort, user: 'postgres', password: 'postgres', persistent: true, onLog: () => {} });
  if (!fs.existsSync(path.join(pgDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  await pg.dropDatabase('sakura_test').catch(() => undefined);
  await pg.createDatabase('sakura_test');

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: String(apiPort),
    TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    TELEGRAM_API_URL: `http://127.0.0.1:${stubPort}`,
    TELEGRAM_POLLING: '',
    OWNER_TELEGRAM_ID: String(TEST_OWNER_ID),
    ADMIN_TELEGRAM_ID: String(TEST_OWNER_ID),
    MANAGER_TELEGRAM_ID: String(TEST_MANAGER_ID),
    PUBLIC_APP_URL: `http://127.0.0.1:${apiPort}/`,
    UPLOADS_DIR: path.join(root, 'data', 'test-uploads'),
    THUMBS_DIR: path.join(root, 'data', 'test-thumbs'),
    SERVE_STATIC: '',
  };

  const migrate = spawnSync(`"${bin('prisma')}" migrate deploy`, { cwd: root, env, shell: true, encoding: 'utf8' });
  if (migrate.status !== 0) throw new Error(`prisma migrate deploy: ${migrate.stderr || migrate.stdout}`);

  const stub = await startTelegramStub();
  const server = spawn(`"${bin('tsx')}" server/src/index.ts`, { cwd: root, env, shell: true });
  let log = '';
  server.stdout?.on('data', (chunk) => (log += chunk));
  server.stderr?.on('data', (chunk) => (log += chunk));

  const baseUrl = `http://127.0.0.1:${apiPort}`;
  for (let attempt = 0; ; attempt += 1) {
    const healthy = await fetch(`${baseUrl}/api/health`).then((r) => r.ok).catch(() => false);
    if (healthy) break;
    if (attempt > 120) {
      killTree(server);
      throw new Error(`API не запустился:\n${log}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  project.provide('baseUrl', baseUrl);
  project.provide('stubUrl', `http://127.0.0.1:${stubPort}`);
  project.provide('databaseUrl', databaseUrl);

  return async () => {
    killTree(server);
    stub.close();
    await pg.stop();
    for (const dir of ['test-uploads', 'test-thumbs']) fs.rmSync(path.join(root, 'data', dir), { recursive: true, force: true });
  };
}
