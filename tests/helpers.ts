import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { inject } from 'vitest';
import { TEST_BOT_TOKEN, TEST_OWNER_ID } from './setup/constants';

export { TEST_MANAGER_ID, TEST_OWNER_ID } from './setup/constants';

export const prisma = new PrismaClient({ datasourceUrl: inject('databaseUrl') });

// Каждому тесту — свой покупатель: кулдаун заказов и лимит открытых заказов считаются по пользователю
let nextUserId = 700_000_000 + Math.floor(Math.random() * 1_000_000);
export const newUserId = () => (nextUserId += 1);

// Такая же подпись, как у Telegram: HMAC от данных пользователя ключом, выведенным из токена бота
export const signInitData = (userId: number, ageSeconds = 0) => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000) - ageSeconds),
    query_id: 'test',
    user: JSON.stringify({ id: userId, first_name: `User${userId}` }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
};

export const webhookSecret = createHmac('sha256', TEST_BOT_TOKEN).update('sakura-webhook').digest('hex');

interface RequestOptions {
  as?: number;
  body?: unknown;
  ageSeconds?: number;
  headers?: Record<string, string>;
}

export const api = async (method: string, path: string, options: RequestOptions = {}) => {
  const response = await fetch(`${inject('baseUrl')}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.as ? { 'x-telegram-init-data': signInitData(options.as, options.ageSeconds) } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
};

export const owner = TEST_OWNER_ID;

export const resetDb = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE stock_logs, order_items, orders, products, categories, shop_settings, users RESTART IDENTITY CASCADE',
  );
  await prisma.category.create({ data: { id: 'disposable', label: 'Одноразки' } });
};

export const createProduct = (data: { title?: string; brand?: string; price?: number; quantity?: number; imageUrl?: string } = {}) =>
  prisma.product.create({
    data: {
      title: data.title ?? 'Sopro 20000',
      brand: data.brand ?? 'Waka',
      categoryId: 'disposable',
      description: '',
      flavor: 'Арбуз',
      price: data.price ?? 1000,
      imageUrl: data.imageUrl ?? '/products/generated/pafos-live-photo.webp',
      quantity: data.quantity ?? 10,
    },
  });

export const stockOf = async (productId: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity;

const courier = { method: 'courier', name: 'Тест', address: 'Минск, ул. Немига, 8' };

export const placeOrder = (userId: number, items: Array<{ productId: string; quantity: number }>, delivery: object = courier) =>
  api('POST', '/api/orders', { as: userId, body: { order: { items, delivery } } });

export const telegramCalls = async () =>
  (await (await fetch(`${inject('stubUrl')}/__calls`)).json()) as Array<{ method: string; body: any }>;

export const clearTelegramCalls = () => fetch(`${inject('stubUrl')}/__calls`, { method: 'DELETE' });
