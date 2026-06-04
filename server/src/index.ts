import express from 'express';
import { PrismaClient, OrderStatus, ProductCategory, UserRole } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);
const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const managerTelegramId = process.env.MANAGER_TELEGRAM_ID ?? process.env.ADMIN_TELEGRAM_ID ?? '';
const publicAppOrigin = new URL(
  process.env.PUBLIC_APP_URL ?? 'https://errorperc.github.io/sakura-vape-miniapp/',
).origin;
const notificationCooldowns = new Map<number, number>();

app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));
app.use((request, response, next) => {
  const origin = request.header('origin');

  if (origin === publicAppOrigin) {
    response.header('Access-Control-Allow-Origin', publicAppOrigin);
    response.header('Access-Control-Allow-Headers', 'Content-Type');
    response.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.header('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    response.sendStatus(origin && origin !== publicAppOrigin ? 403 : 204);
    return;
  }

  next();
});

interface TelegramInitUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const textValue = (value: unknown, maxLength = 200) => {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
};

const numberValue = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const escapeHtml = (value: string) => {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
};

const validateTelegramInitData = (initData: unknown): TelegramInitUser | null => {
  if (!botToken || typeof initData !== 'string' || initData.length === 0 || initData.length > 12_000) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isInteger(authDate)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 300 || now - authDate > 86_400) {
    return null;
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const hashBuffer = Buffer.from(receivedHash, 'hex');

  if (hashBuffer.length !== calculatedHash.length || !timingSafeEqual(hashBuffer, calculatedHash)) {
    return null;
  }

  try {
    const user = JSON.parse(params.get('user') ?? '') as unknown;

    if (
      !isRecord(user) ||
      typeof user.id !== 'number' ||
      !Number.isSafeInteger(user.id) ||
      typeof user.first_name !== 'string' ||
      user.first_name.length === 0
    ) {
      return null;
    }

    return {
      id: user.id as number,
      first_name: user.first_name.slice(0, 128),
      last_name: typeof user.last_name === 'string' ? user.last_name.slice(0, 128) : undefined,
      username: typeof user.username === 'string' ? user.username.slice(0, 64) : undefined,
    };
  } catch {
    return null;
  }
};

app.get('/api/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok' });
  } catch {
    response.status(503).json({ status: 'unavailable' });
  }
});

const getAdminTelegramId = (request: express.Request) => {
  const value = request.header('x-admin-telegram-id');
  return value ? BigInt(value) : null;
};

const requireAdmin = async (request: express.Request, response: express.Response) => {
  const telegramId = getAdminTelegramId(request);

  if (!telegramId) {
    response.status(401).json({ error: 'Admin Telegram ID is required.' });
    return null;
  }

  const admin = await prisma.user.findUnique({ where: { telegramId } });

  if (!admin || admin.role !== UserRole.admin) {
    response.status(403).json({ error: 'Admin access denied.' });
    return null;
  }

  return admin;
};

app.get('/api/products', async (_request, response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  response.json(products);
});

app.get('/api/admin/products', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  response.json(products);
});

app.post('/api/admin/products', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const product = await prisma.product.create({
    data: {
      title: request.body.title,
      brand: request.body.brand,
      category: request.body.category as ProductCategory,
      description: request.body.description,
      flavor: request.body.flavor,
      price: Number(request.body.price),
      imageUrl: request.body.imageUrl,
      quantity: Number(request.body.quantity),
      isActive: Boolean(request.body.isActive ?? true),
    },
  });

  await prisma.stockLog.create({
    data: {
      productId: product.id,
      adminId: admin.id,
      oldQuantity: 0,
      newQuantity: product.quantity,
      reason: 'admin_create',
    },
  });

  response.status(201).json(product);
});

app.patch('/api/admin/products/:id', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const current = await prisma.product.findUnique({ where: { id: request.params.id } });
  if (!current) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }

  const nextQuantity =
    request.body.quantity === undefined ? current.quantity : Number(request.body.quantity);

  const product = await prisma.product.update({
    where: { id: current.id },
    data: {
      title: request.body.title ?? current.title,
      brand: request.body.brand ?? current.brand,
      category: (request.body.category as ProductCategory | undefined) ?? current.category,
      description: request.body.description ?? current.description,
      flavor: request.body.flavor ?? current.flavor,
      price: request.body.price === undefined ? current.price : Number(request.body.price),
      imageUrl: request.body.imageUrl ?? current.imageUrl,
      quantity: nextQuantity,
      isActive: request.body.isActive === undefined ? current.isActive : Boolean(request.body.isActive),
    },
  });

  if (nextQuantity !== current.quantity) {
    await prisma.stockLog.create({
      data: {
        productId: current.id,
        adminId: admin.id,
        oldQuantity: current.quantity,
        newQuantity: nextQuantity,
        reason: request.body.stockReason ?? 'admin_update',
      },
    });
  }

  response.json(product);
});

app.delete('/api/admin/products/:id', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  await prisma.product.update({
    where: { id: request.params.id },
    data: { isActive: false },
  });

  response.status(204).send();
});

app.post('/api/order-notifications', async (request, response) => {
  if (!botToken || !/^-?\d+$/.test(managerTelegramId)) {
    response.status(503).json({ error: 'Order notifications are not configured.' });
    return;
  }

  const origin = request.header('origin');
  if (origin && origin !== publicAppOrigin) {
    response.status(403).json({ error: 'This app origin is not allowed.' });
    return;
  }

  const telegramUser = validateTelegramInitData(request.body?.initData);
  if (!telegramUser) {
    response.status(401).json({ error: 'Open the shop inside Telegram and try again.' });
    return;
  }

  const now = Date.now();
  const previousNotification = notificationCooldowns.get(telegramUser.id) ?? 0;
  if (now - previousNotification < 10_000) {
    response.status(429).json({ error: 'Please wait before sending another order.' });
    return;
  }

  const order = request.body?.order;
  if (!isRecord(order) || !Array.isArray(order.items) || order.items.length === 0 || order.items.length > 15) {
    response.status(400).json({ error: 'Order data is invalid.' });
    return;
  }

  const items = order.items.map((item) => {
    if (!isRecord(item)) return null;

    const productName = textValue(item.productName, 80);
    const brand = textValue(item.brand, 50);
    const quantity = Math.floor(numberValue(item.quantity));
    const price = Math.round(numberValue(item.price));

    if (!productName || quantity < 1 || quantity > 99 || price < 0) {
      return null;
    }

    return { productName, brand, quantity, price };
  });

  if (items.some((item) => item === null)) {
    response.status(400).json({ error: 'Order items are invalid.' });
    return;
  }

  const delivery = isRecord(order.delivery) ? order.delivery : {};
  const orderId = textValue(order.id, 64) || 'без номера';
  const customerName = textValue(delivery.name, 160) || [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ');
  const address = textValue(delivery.address, 320) || 'не указан';
  const comment = textValue(delivery.comment, 500) || 'нет';
  const total = Math.max(0, Math.round(numberValue(order.total)));
  const telegramName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ');
  const username = telegramUser.username ? `@${escapeHtml(telegramUser.username)}` : 'username не указан';
  const itemLines = items.map((item, index) => {
    if (!item) return '';
    const brand = item.brand ? ` · ${escapeHtml(item.brand)}` : '';
    const lineTotal = (item.price * item.quantity).toLocaleString('ru-RU');
    return `${index + 1}. <b>${escapeHtml(item.productName)}</b>${brand}\n   ${item.quantity} × ${item.price.toLocaleString('ru-RU')} ₽ = ${lineTotal} ₽`;
  });
  const message = [
    `🌸 <b>Новый заказ ${escapeHtml(orderId)}</b>`,
    '',
    `<b>Покупатель:</b> <a href="tg://user?id=${telegramUser.id}">${escapeHtml(telegramName)}</a>`,
    `<b>Telegram:</b> ${username} · <code>${telegramUser.id}</code>`,
    `<b>Имя для заказа:</b> ${escapeHtml(customerName)}`,
    '',
    ...itemLines,
    '',
    `<b>Итого:</b> ${total.toLocaleString('ru-RU')} ₽`,
    `<b>Адрес:</b> ${escapeHtml(address)}`,
    `<b>Комментарий:</b> ${escapeHtml(comment)}`,
  ].join('\n');

  notificationCooldowns.set(telegramUser.id, now);

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: managerTelegramId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const telegramResult = (await telegramResponse.json().catch(() => null)) as { ok?: boolean } | null;

    if (!telegramResponse.ok || !telegramResult?.ok) {
      notificationCooldowns.delete(telegramUser.id);
      response.status(502).json({ error: 'Telegram did not accept the order notification.' });
      return;
    }

    response.status(202).json({ ok: true });
  } catch {
    notificationCooldowns.delete(telegramUser.id);
    response.status(502).json({ error: 'Could not reach Telegram.' });
  }
});

app.post('/api/orders', async (request, response) => {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { telegramId: BigInt(request.body.user.telegramId) },
      update: {
        firstName: request.body.user.firstName,
        username: request.body.user.username,
        photoUrl: request.body.user.photoUrl,
      },
      create: {
        telegramId: BigInt(request.body.user.telegramId),
        firstName: request.body.user.firstName,
        username: request.body.user.username,
        photoUrl: request.body.user.photoUrl,
      },
    });

    const items = [];
    let totalPrice = 0;

    for (const item of request.body.items as Array<{ productId: string; quantity: number }>) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });

      if (!product || !product.isActive || product.quantity < item.quantity) {
        throw new Error(`Недостаточно товара: ${item.productId}`);
      }

      const updated = await tx.product.updateMany({
        where: { id: product.id, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });

      if (updated.count !== 1) {
        throw new Error(`Остаток изменился: ${product.title}`);
      }

      totalPrice += product.price * item.quantity;
      items.push({
        productId: product.id,
        productTitle: product.title,
        quantity: item.quantity,
        priceAtPurchase: product.price,
      });
    }

    return tx.order.create({
      data: {
        userId: user.id,
        totalPrice,
        status: OrderStatus.NEW,
        deliveryName: request.body.delivery.name,
        deliveryPhone: request.body.delivery.phone ?? '',
        deliveryAddress: request.body.delivery.address,
        deliveryComment: request.body.delivery.comment,
        items: { create: items },
      },
      include: { items: true },
    });
  });

  response.status(201).json(result);
});

app.get('/api/admin/orders', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true, user: true },
  });
  response.json(orders);
});

app.patch('/api/admin/orders/:id/status', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const order = await prisma.order.update({
    where: { id: request.params.id },
    data: { status: request.body.status as OrderStatus },
  });
  response.json(order);
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  response.status(409).json({ error: message });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API server is running on http://localhost:${port}`);
});

const shutdown = () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
