import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_MANAGER_ID, api, clearTelegramCalls, createProduct, newUserId, placeOrder, prisma, resetDb, telegramCalls, webhookSecret } from './helpers';

const callback = (fromId: number, data: string) => ({
  update_id: 1,
  callback_query: { id: 'cb', from: { id: fromId, first_name: 'X' }, data },
});

const createOrder = async () => {
  const product = await createProduct({ quantity: 5 });
  const order = await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
  expect(order.status).toBe(201);
  return { product, orderId: order.body.id as string };
};

describe('вебхук бота', () => {
  beforeEach(async () => {
    await resetDb();
    await clearTelegramCalls();
  });

  it('без секрета Telegram отвечает 401 и ничего не меняет', async () => {
    const { orderId } = await createOrder();
    const forged = await api('POST', '/api/telegram/webhook', { body: callback(TEST_MANAGER_ID, `st:${orderId}:CANCELED`) });
    expect(forged.status).toBe(401);

    const wrongSecret = await api('POST', '/api/telegram/webhook', {
      body: callback(TEST_MANAGER_ID, `st:${orderId}:CANCELED`),
      headers: { 'x-telegram-bot-api-secret-token': 'guess' },
    });
    expect(wrongSecret.status).toBe(401);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('NEW');
  });

  it('с секретом кнопка менеджера отменяет заказ и возвращает товар', async () => {
    const { product, orderId } = await createOrder();
    const response = await api('POST', '/api/telegram/webhook', {
      body: callback(TEST_MANAGER_ID, `st:${orderId}:CANCELED`),
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret },
    });
    expect(response.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('CANCELED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).quantity).toBe(5);
  });

  it('не сотрудник не может менять статус', async () => {
    const { orderId } = await createOrder();
    await api('POST', '/api/telegram/webhook', {
      body: callback(newUserId(), `st:${orderId}:COMPLETED`),
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret },
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('NEW');
    const answers = (await telegramCalls()).filter((call) => call.method === 'answerCallbackQuery');
    expect(answers.at(-1)?.body.text).toBe('Нет доступа');
  });

  it('служебные имена объектов вместо статуса отклоняются', async () => {
    const { orderId } = await createOrder();
    await api('POST', '/api/telegram/webhook', {
      body: callback(TEST_MANAGER_ID, `st:${orderId}:toString`),
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret },
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('NEW');
  });
});
