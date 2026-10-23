import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Перед тестами поднимается своя PostgreSQL, API-сервер и заглушка Telegram
    globalSetup: ['tests/setup/global.ts'],
    setupFiles: ['tests/setup/each-file.ts'],
    // Тесты ходят в одну базу — запускаем файлы по очереди
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
