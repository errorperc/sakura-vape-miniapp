// Перенос данных магазина между базами (например, с компьютера на сервер).
//   node scripts/data-transfer.mjs export [файл]  — выгрузить все таблицы в JSON (по умолчанию data/export.json)
//   node scripts/data-transfer.mjs import [файл]  — загрузить JSON в ПУСТУЮ базу (после миграций)
// Фото из админки лежат отдельно, в data/uploads — их копируют вместе с файлом выгрузки.
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

if (fs.existsSync('.env') && !process.env.DATABASE_URL) process.loadEnvFile('.env');

const [mode, file = 'data/export.json'] = process.argv.slice(2);
const prisma = new PrismaClient();

// Порядок важен: сначала то, на что ссылаются остальные таблицы
const tables = ['user', 'category', 'shopSetting', 'product', 'order', 'orderItem', 'stockLog'];
const dateFields = ['createdAt', 'updatedAt'];

const exportData = async () => {
  const data = {};
  for (const table of tables) data[table] = await prisma[table].findMany();
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), data }, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json);
  const counts = tables.map((table) => `${table}: ${data[table].length}`).join(', ');
  console.log(`Выгружено в ${file} — ${counts}`);
};

const importData = async () => {
  const { data } = JSON.parse(fs.readFileSync(file, 'utf8'));
  if ((await prisma.product.count()) > 0 || (await prisma.order.count()) > 0) {
    throw new Error('В базе уже есть товары или заказы. Загрузка возможна только в пустую базу.');
  }

  await prisma.$transaction(async (tx) => {
    // Сид мог создать владельца и категории — их перезапишут данные из выгрузки
    await tx.user.deleteMany();
    await tx.category.deleteMany();
    await tx.shopSetting.deleteMany();

    for (const table of tables) {
      const rows = (data[table] ?? []).map((row) => {
        const copy = { ...row };
        for (const field of dateFields) if (copy[field]) copy[field] = new Date(copy[field]);
        if (table === 'user') copy.telegramId = BigInt(copy.telegramId);
        return copy;
      });
      if (rows.length) await tx[table].createMany({ data: rows });
      console.log(`${table}: ${rows.length}`);
    }
  });
  console.log('Данные загружены.');
};

try {
  if (mode === 'export') await exportData();
  else if (mode === 'import') await importData();
  else console.log('Использование: node scripts/data-transfer.mjs export|import [файл]');
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
