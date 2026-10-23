import { beforeEach, describe, expect, it } from 'vitest';
import { api, clearTelegramCalls, createProduct, newUserId, owner, placeOrder, prisma, resetDb, stockOf, telegramCalls } from './helpers';

describe('заказы и учёт', () => {
  beforeEach(async () => {
    await resetDb();
    await clearTelegramCalls();
  });

  it('сумму считает сервер, цены от клиента игнорируются', async () => {
    const product = await createProduct({ price: 1500, quantity: 5 });
    const order = await api('POST', '/api/orders', {
      as: newUserId(),
      body: { order: { total: 1, items: [{ productId: product.id, quantity: 2, price: 1 }], delivery: { name: 'Тест', address: 'Немига 8' } } },
    });
    expect(order.status).toBe(201);
    expect(order.body.total).toBe(3000);
    expect(await stockOf(product.id)).toBe(3);
  });

  it('одинаковые позиции складываются, а заказ пишется в журнал склада', async () => {
    const product = await createProduct({ quantity: 10 });
    const order = await placeOrder(newUserId(), [
      { productId: product.id, quantity: 1 },
      { productId: product.id, quantity: 2 },
    ]);
    expect(order.status).toBe(201);
    expect(order.body.items).toHaveLength(1);
    expect(order.body.items[0].quantity).toBe(3);
    const log = await prisma.stockLog.findFirst({ where: { productId: product.id, reason: 'order' } });
    expect(log).toMatchObject({ oldQuantity: 10, newQuantity: 7 });
  });

  it('менеджер получает заказ, имя покупателя экранируется', async () => {
    const product = await createProduct({ title: '<b>Bad</b>' });
    await placeOrder(newUserId(), [{ productId: product.id, quantity: 1 }], { name: '<script>', address: 'Немига 8' });
    // Уведомление уходит уже после ответа на заказ — ждём его немного
    let sent: { body: any } | undefined;
    for (let attempt = 0; attempt < 20 && !sent; attempt += 1) {
      sent = (await telegramCalls()).find((call) => call.method === 'sendMessage');
      if (!sent) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(sent?.body.text).toContain('&lt;script&gt;');
    expect(sent?.body.text).toContain('&lt;b&gt;Bad&lt;/b&gt;');
    expect(sent?.body.reply_markup.inline_keyboard.flat().length).toBeGreaterThan(0);
  });

  it('повторный заказ в течение 10 секунд отклоняется', async () => {
    const product = await createProduct();
    const userId = newUserId();
    expect((await placeOrder(userId, [{ productId: product.id, quantity: 1 }])).status).toBe(201);
    expect((await placeOrder(userId, [{ productId: product.id, quantity: 1 }])).status).toBe(429);
  });

  it('самовывоз без адреса проходит, курьер с мусорным адресом — нет', async () => {
    const product = await createProduct();
    const pickup = await placeOrder(newUserId(), [{ productId: product.id, quantity: 1 }], { method: 'pickup', name: 'Тест' });
    expect(pickup.status).toBe(201);
    expect(pickup.body.delivery.address).toBe('Самовывоз');

    const junk = await placeOrder(newUserId(), [{ productId: product.id, quantity: 1 }], { method: 'courier', name: 'Тест', address: 'фывапролдж 12' });
    expect(junk.status).toBe(400);
  });

  it('отмена возвращает товар, отменённые заказы не идут в выручку', async () => {
    const product = await createProduct({ price: 1000, quantity: 5 });
    const order = await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
    let stats = await api('GET', '/api/admin/stats?period=month', { as: owner });
    expect(stats.body.revenue).toBe(2000);

    await api('PATCH', `/api/admin/orders/${order.body.id}/status`, { as: owner, body: { status: 'Отменен' } });
    expect(await stockOf(product.id)).toBe(5);
    stats = await api('GET', '/api/admin/stats?period=month', { as: owner });
    expect(stats.body.revenue).toBe(0);
  });

  it('возврат отменённого заказа без остатка — ошибка, ничего не меняется', async () => {
    const product = await createProduct({ quantity: 2 });
    const order = await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
    await api('PATCH', `/api/admin/orders/${order.body.id}/status`, { as: owner, body: { status: 'Отменен' } });
    await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);

    const restore = await api('PATCH', `/api/admin/orders/${order.body.id}/status`, { as: owner, body: { status: 'Новый' } });
    expect(restore.status).toBe(409);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('CANCELED');
    expect(await stockOf(product.id)).toBe(0);
  });

  it('неизвестный статус и несуществующий заказ дают понятные ошибки', async () => {
    const product = await createProduct();
    const order = await placeOrder(newUserId(), [{ productId: product.id, quantity: 1 }]);
    expect((await api('PATCH', `/api/admin/orders/${order.body.id}/status`, { as: owner, body: {} })).status).toBe(400);
    const missing = await api('PATCH', '/api/admin/orders/00000000-0000-0000-0000-000000000000/status', { as: owner, body: { status: 'Завершен' } });
    expect(missing.status).toBe(404);
  });

  it('офлайн-продажу нельзя провести сразу отменённой, подарок за 0 ₽ — можно', async () => {
    const product = await createProduct({ price: 1200, quantity: 5 });
    const canceled = await api('POST', '/api/admin/orders', { as: owner, body: { productId: product.id, quantity: 1, status: 'Отменен' } });
    expect(canceled.status).toBe(400);
    expect(await stockOf(product.id)).toBe(5);

    const gift = await api('POST', '/api/admin/orders', { as: owner, body: { productId: product.id, quantity: 1, price: 0, status: 'Завершен' } });
    expect(gift.status).toBe(201);
    expect(gift.body.total).toBe(0);
    expect(await stockOf(product.id)).toBe(4);
  });
});
