import { beforeAll, describe, expect, it } from 'vitest';
import { api, createProduct, newUserId, owner, resetDb, signInitData } from './helpers';

describe('авторизация через подпись Telegram', () => {
  beforeAll(resetDb);

  it('без подписи и с поддельной подписью — 401', async () => {
    expect((await api('GET', '/api/orders/my')).status).toBe(401);
    const tampered = signInitData(newUserId()).replace(/hash=[a-f0-9]{4}/, 'hash=0000');
    const response = await api('GET', '/api/orders/my', { headers: { 'x-telegram-init-data': tampered } });
    expect(response.status).toBe(401);
  });

  it('покупатель не видит админские разделы', async () => {
    const customer = newUserId();
    expect((await api('GET', '/api/admin/stats', { as: customer })).status).toBe(403);
    expect((await api('GET', '/api/admin/orders', { as: customer })).status).toBe(403);
    expect((await api('GET', '/api/admin/team', { as: customer })).status).toBe(403);
  });

  it('админская подпись старше 6 часов не принимается, покупательская — до суток', async () => {
    expect((await api('GET', '/api/admin/stats', { as: owner, ageSeconds: 7 * 3600 })).status).toBe(401);
    expect((await api('GET', '/api/orders/my', { as: newUserId(), ageSeconds: 7 * 3600 })).status).toBe(200);
    expect((await api('GET', '/api/orders/my', { as: newUserId(), ageSeconds: 25 * 3600 })).status).toBe(401);
  });

  it('слишком большой запрос отсекается', async () => {
    const big = await api('POST', '/api/orders', { as: newUserId(), body: { order: { padding: 'x'.repeat(100_000) } } });
    expect(big.status).toBe(413);
  });
});

describe('фото и миниатюры', () => {
  beforeAll(resetDb);

  it('выход за пределы папки, кривой адрес и чужая ширина — отказ без ошибки сервера', async () => {
    expect((await api('GET', '/thumbs/480/..%2F..%2Fpackage.json')).status).toBe(404);
    // Кривой %-код отсекает ещё роутер Express (400) — главное, не 500
    const malformed = (await api('GET', '/thumbs/480/%E0%A4%A')).status;
    expect(malformed).toBeGreaterThanOrEqual(400);
    expect(malformed).toBeLessThan(500);
    expect((await api('GET', '/thumbs/333/products/generated/pafos-live-photo.webp')).status).toBe(404);
  });

  it('настоящая миниатюра — WebP с кэшем', async () => {
    const response = await fetch(`${(await import('vitest')).inject('baseUrl')}/thumbs/320/products/generated/pafos-live-photo.webp`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/webp');
    expect(response.headers.get('cache-control')).toContain('max-age');
  });

  it('загрузка: картинка перекодируется в WebP, не-картинка и чужие ссылки отклоняются', async () => {
    const product = await createProduct();
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const saved = await api('PATCH', `/api/admin/products/${product.id}`, { as: owner, body: { image: png } });
    expect(saved.status).toBe(200);
    expect(saved.body.image).toMatch(/^\/uploads\/[0-9a-f-]+\.webp$/);

    const fake = await api('PATCH', `/api/admin/products/${product.id}`, {
      as: owner,
      body: { image: `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}` },
    });
    expect(fake.status).toBe(400);

    const external = await api('PATCH', `/api/admin/products/${product.id}`, { as: owner, body: { image: 'https://evil.example/x.png' } });
    expect(external.status).toBe(400);
  });
});
