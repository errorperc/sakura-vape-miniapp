import { beforeEach, describe, expect, it } from 'vitest';
import { api, createProduct, newUserId, owner, placeOrder, prisma, resetDb, stockOf } from './helpers';

const cancel = (orderId: string) => api('PATCH', `/api/admin/orders/${orderId}/status`, { as: owner, body: { status: 'Отменен' } });

describe('склад при одновременных действиях', () => {
  beforeEach(resetDb);

  it('последнюю штуку покупает только один из двух', async () => {
    const product = await createProduct({ quantity: 1 });
    const results = await Promise.all([
      placeOrder(newUserId(), [{ productId: product.id, quantity: 1 }]),
      placeOrder(newUserId(), [{ productId: product.id, quantity: 1 }]),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockOf(product.id)).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it('двойная отмена возвращает товар один раз', async () => {
    const product = await createProduct({ quantity: 5 });
    const order = await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
    expect(await stockOf(product.id)).toBe(3);

    const results = await Promise.all([cancel(order.body.id), cancel(order.body.id)]);
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect(await stockOf(product.id)).toBe(5);
  });

  it('отмена параллельно с новым заказом не теряет списание', async () => {
    const product = await createProduct({ quantity: 10 });
    const first = await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
    expect(await stockOf(product.id)).toBe(8);

    await Promise.all([cancel(first.body.id), placeOrder(newUserId(), [{ productId: product.id, quantity: 3 }])]);
    // 10 − 2 (первый) + 2 (отмена) − 3 (второй) = 7
    expect(await stockOf(product.id)).toBe(7);
  });

  it('правка названия не откатывает продажу, случившуюся пока админ редактировал', async () => {
    const product = await createProduct({ quantity: 10 });
    // Админ открыл форму при остатке 10, тем временем купили 2
    await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
    const saved = await api('PATCH', `/api/admin/products/${product.id}`, {
      as: owner,
      body: { name: 'Sopro 20000 New', stockCount: 10, baseStockCount: 10 },
    });
    expect(saved.status).toBe(200);
    expect(await stockOf(product.id)).toBe(8);
  });

  it('если админ сам менял остаток, а его успели купить — просим проверить', async () => {
    const product = await createProduct({ quantity: 10 });
    await placeOrder(newUserId(), [{ productId: product.id, quantity: 2 }]);
    const saved = await api('PATCH', `/api/admin/products/${product.id}`, {
      as: owner,
      body: { stockCount: 15, baseStockCount: 10 },
    });
    expect(saved.status).toBe(409);
    expect(await stockOf(product.id)).toBe(8);
  });

  it('два одновременных заказа одного покупателя: проходит один', async () => {
    const product = await createProduct({ quantity: 10 });
    const userId = newUserId();
    const results = await Promise.all([
      placeOrder(userId, [{ productId: product.id, quantity: 1 }]),
      placeOrder(userId, [{ productId: product.id, quantity: 1 }]),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await stockOf(product.id)).toBe(9);
  });
});
