import express from 'express';
import { PrismaClient, OrderStatus, UserRole } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);
const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const ownerTelegramId = process.env.OWNER_TELEGRAM_ID ?? process.env.ADMIN_TELEGRAM_ID ?? '';
const fallbackManagerTelegramId = process.env.MANAGER_TELEGRAM_ID ?? ownerTelegramId;
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
    response.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
    response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

const upsertAuthenticatedUser = async (telegramUser: TelegramInitUser) => {
  const telegramId = BigInt(telegramUser.id);
  const isOwner = String(telegramUser.id) === ownerTelegramId;

  return prisma.user.upsert({
    where: { telegramId },
    update: {
      firstName: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      username: telegramUser.username,
      ...(isOwner ? { role: UserRole.owner } : {}),
    },
    create: {
      telegramId,
      firstName: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      username: telegramUser.username,
      role: isOwner ? UserRole.owner : UserRole.user,
    },
  });
};

const requireAuthenticatedUser = async (request: express.Request, response: express.Response) => {
  const telegramUser = validateTelegramInitData(request.header('x-telegram-init-data') ?? request.body?.initData);

  if (!telegramUser) {
    response.status(401).json({ error: 'Open the shop inside Telegram and try again.' });
    return null;
  }

  return upsertAuthenticatedUser(telegramUser);
};

const requireAdmin = async (request: express.Request, response: express.Response) => {
  const admin = await requireAuthenticatedUser(request, response);
  if (!admin) return null;

  if (admin.role !== UserRole.admin && admin.role !== UserRole.owner) {
    response.status(403).json({ error: 'Admin access denied.' });
    return null;
  }

  return admin;
};

const requireOwner = async (request: express.Request, response: express.Response) => {
  const owner = await requireAuthenticatedUser(request, response);
  if (!owner) return null;

  if (owner.role !== UserRole.owner || owner.telegramId.toString() !== ownerTelegramId) {
    response.status(403).json({ error: 'Only the main administrator can manage the team.' });
    return null;
  }

  return owner;
};

const serializeTeamMember = (member: {
  telegramId: bigint;
  firstName: string;
  username: string | null;
  role: UserRole;
  createdAt: Date;
}) => ({
  telegramId: member.telegramId.toString(),
  firstName: member.firstName,
  username: member.username,
  role: member.role,
  createdAt: member.createdAt.toISOString(),
});

const deliverySettingsKey = 'delivery';
const defaultDeliverySettings = {
  priceLabel: 'от 0 ₽',
  courierTitle: 'Курьер',
  courierDescription: 'Минск и ближайшие районы, обычно в день заказа.',
  pickupTitle: 'Самовывоз',
  pickupDescription: 'Пункт выдачи после подтверждения администратором.',
  timeTitle: 'Время',
  timeDescription: 'В среднем 60–120 минут по городу.',
  primaryCondition: 'Доставка от 3000 ₽ бесплатная. До 3000 ₽ стоимость рассчитывается администратором по району.',
  secondaryCondition: 'Самовывоз доступен после подтверждения наличия товара. При получении потребуется подтвердить 18+.',
};

const normalizeDeliverySettings = (body: unknown) => {
  const payload = isRecord(body) ? body : {};

  return {
    priceLabel: textValue(payload.priceLabel, 60) || defaultDeliverySettings.priceLabel,
    courierTitle: textValue(payload.courierTitle, 80) || defaultDeliverySettings.courierTitle,
    courierDescription: textValue(payload.courierDescription, 400) || defaultDeliverySettings.courierDescription,
    pickupTitle: textValue(payload.pickupTitle, 80) || defaultDeliverySettings.pickupTitle,
    pickupDescription: textValue(payload.pickupDescription, 400) || defaultDeliverySettings.pickupDescription,
    timeTitle: textValue(payload.timeTitle, 80) || defaultDeliverySettings.timeTitle,
    timeDescription: textValue(payload.timeDescription, 400) || defaultDeliverySettings.timeDescription,
    primaryCondition: textValue(payload.primaryCondition, 700) || defaultDeliverySettings.primaryCondition,
    secondaryCondition: textValue(payload.secondaryCondition, 700) || defaultDeliverySettings.secondaryCondition,
  };
};

const statusToClient: Record<OrderStatus, string> = {
  NEW: 'Новый',
  PROCESSING: 'В обработке',
  OUT_FOR_DELIVERY: 'Передан в доставку',
  COMPLETED: 'Завершен',
  CANCELED: 'Отменен',
};

const statusFromClient = (status: unknown): OrderStatus => {
  if (status === 'В обработке' || status === 'PROCESSING') return OrderStatus.PROCESSING;
  if (status === 'Передан в доставку' || status === 'OUT_FOR_DELIVERY') return OrderStatus.OUT_FOR_DELIVERY;
  if (status === 'Завершен' || status === 'COMPLETED') return OrderStatus.COMPLETED;
  if (status === 'Отменен' || status === 'CANCELED') return OrderStatus.CANCELED;

  return OrderStatus.NEW;
};

const getStockStatus = (quantity: number) => {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= 5) return 'low_stock';
  return 'in_stock';
};

const makeCategoryId = (label: string) => {
  return (
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `category-${Date.now()}`
  );
};

const serializeCategory = (category: { id: string; label: string }) => ({
  id: category.id,
  label: category.label,
});

const serializeProduct = (product: {
  id: string;
  title: string;
  brand: string;
  categoryId: string;
  description: string;
  flavor: string;
  price: number;
  imageUrl: string;
  accent: string;
  nicotine: string;
  quantity: number;
  isActive: boolean;
}) => ({
  id: product.id,
  name: product.title,
  brand: product.brand,
  category: product.categoryId,
  taste: product.flavor,
  description: product.description,
  price: product.price,
  stock: getStockStatus(product.quantity),
  stockCount: product.quantity,
  isActive: product.isActive,
  image: product.imageUrl,
  accent: product.accent,
  nicotine: product.nicotine,
});

const serializeOrder = (order: {
  id: string;
  totalPrice: number;
  status: OrderStatus;
  deliveryName: string;
  deliveryAddress: string;
  deliveryComment: string | null;
  createdAt: Date;
  user?: { telegramId: bigint } | null;
  items: Array<{
    productId: string;
    productTitle: string;
    quantity: number;
    priceAtPurchase: number;
    product?: { brand: string } | null;
  }>;
}) => ({
  id: order.id,
  userId: Number(order.user?.telegramId ?? 0),
  createdAt: order.createdAt.toISOString(),
  status: statusToClient[order.status],
  total: order.totalPrice,
  delivery: {
    name: order.deliveryName,
    address: order.deliveryAddress,
    comment: order.deliveryComment ?? '',
  },
  items: order.items.map((item) => ({
    productId: item.productId,
    productName: item.productTitle,
    brand: item.product?.brand ?? '',
    price: item.priceAtPurchase,
    quantity: item.quantity,
  })),
});

const productInput = (body: unknown) => {
  const payload = isRecord(body) ? body : {};
  const title = textValue(payload.name ?? payload.title, 120);
  const brand = textValue(payload.brand, 80);
  const categoryId = textValue(payload.category ?? payload.categoryId, 80);
  const description = textValue(payload.description, 600);
  const flavor = textValue(payload.taste ?? payload.flavor, 180);
  const imageUrl = textValue(payload.image ?? payload.imageUrl, 2_000_000) || '/products/hqd-cuvie-plus.png';
  const price = Math.max(0, Math.round(numberValue(payload.price)));
  const quantity = Math.max(0, Math.floor(numberValue(payload.stockCount ?? payload.quantity)));
  const accent = textValue(payload.accent, 20) || '#f52b88';
  const nicotine = textValue(payload.nicotine, 40) || '20 мг';
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);

  if (!title || !brand || !categoryId) {
    return null;
  }

  return {
    title,
    brand,
    categoryId,
    description,
    flavor,
    price,
    imageUrl,
    quantity,
    accent,
    nicotine,
    isActive,
  };
};

app.get('/api/admin/session', async (request, response) => {
  const user = await requireAuthenticatedUser(request, response);
  if (!user) return;

  response.json({
    telegramId: user.telegramId.toString(),
    role: user.role,
    isAdmin: user.role === UserRole.admin || user.role === UserRole.owner,
    isOwner: user.role === UserRole.owner && user.telegramId.toString() === ownerTelegramId,
  });
});

app.get('/api/admin/team', async (request, response) => {
  const owner = await requireOwner(request, response);
  if (!owner) return;

  const members = await prisma.user.findMany({
    where: { role: { in: [UserRole.owner, UserRole.admin, UserRole.manager] } },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
  });

  response.json(members.map(serializeTeamMember));
});

app.post('/api/admin/team', async (request, response) => {
  const owner = await requireOwner(request, response);
  if (!owner) return;

  const telegramIdValue = textValue(request.body?.telegramId, 30);
  const role = request.body?.role;

  if (!/^\d{5,20}$/.test(telegramIdValue) || (role !== UserRole.admin && role !== UserRole.manager)) {
    response.status(400).json({ error: 'Telegram ID and team role are required.' });
    return;
  }

  if (telegramIdValue === ownerTelegramId) {
    response.status(400).json({ error: 'The main administrator role cannot be changed.' });
    return;
  }

  const firstName = textValue(request.body?.firstName, 128) || 'Аккаунт команды';
  const username = textValue(request.body?.username, 64).replace(/^@/, '') || null;
  const member = await prisma.user.upsert({
    where: { telegramId: BigInt(telegramIdValue) },
    update: { firstName, username, role },
    create: { telegramId: BigInt(telegramIdValue), firstName, username, role },
  });

  response.json(serializeTeamMember(member));
});

app.delete('/api/admin/team/:telegramId', async (request, response) => {
  const owner = await requireOwner(request, response);
  if (!owner) return;

  const telegramIdValue = request.params.telegramId;
  if (!/^\d{5,20}$/.test(telegramIdValue) || telegramIdValue === ownerTelegramId) {
    response.status(400).json({ error: 'The main administrator cannot be removed.' });
    return;
  }

  const member = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramIdValue) } });
  if (!member) {
    response.status(404).json({ error: 'Team member not found.' });
    return;
  }

  await prisma.user.update({
    where: { id: member.id },
    data: { role: UserRole.user },
  });

  response.status(204).send();
});

app.get('/api/settings/delivery', async (_request, response) => {
  const setting = await prisma.shopSetting.findUnique({ where: { key: deliverySettingsKey } });
  response.json(normalizeDeliverySettings(setting?.value));
});

app.put('/api/admin/settings/delivery', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const settings = normalizeDeliverySettings(request.body?.settings ?? request.body);
  const setting = await prisma.shopSetting.upsert({
    where: { key: deliverySettingsKey },
    update: { value: settings },
    create: { key: deliverySettingsKey, value: settings },
  });

  response.json(normalizeDeliverySettings(setting.value));
});

app.get('/api/catalog', async (_request, response) => {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({
      where: { isActive: true, isArchived: false },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  response.json({
    categories: categories.map(serializeCategory),
    products: products.map(serializeProduct),
  });
});

app.get('/api/products', async (_request, response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true, isArchived: false },
    orderBy: { createdAt: 'desc' },
  });
  response.json(products.map(serializeProduct));
});

app.get('/api/admin/catalog', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({ where: { isArchived: false }, orderBy: { createdAt: 'desc' } }),
  ]);

  response.json({
    categories: categories.map(serializeCategory),
    products: products.map(serializeProduct),
  });
});

app.get('/api/admin/products', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const products = await prisma.product.findMany({ where: { isArchived: false }, orderBy: { createdAt: 'desc' } });
  response.json(products.map(serializeProduct));
});

app.post('/api/admin/categories', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const label = textValue(request.body?.label, 80);
  if (!label) {
    response.status(400).json({ error: 'Category label is required.' });
    return;
  }

  const baseId = makeCategoryId(label);
  const id = (await prisma.category.findUnique({ where: { id: baseId } }))
    ? `${baseId}-${Date.now()}`
    : baseId;
  const category = await prisma.category.create({ data: { id, label } });

  response.status(201).json(serializeCategory(category));
});

app.patch('/api/admin/categories/:id', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const label = textValue(request.body?.label, 80);
  if (!label) {
    response.status(400).json({ error: 'Category label is required.' });
    return;
  }

  const category = await prisma.category.update({
    where: { id: request.params.id },
    data: { label },
  });

  response.json(serializeCategory(category));
});

app.delete('/api/admin/categories/:id', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const productsCount = await prisma.product.count({ where: { categoryId: request.params.id } });
  if (productsCount > 0) {
    response.status(409).json({ error: 'Move products to another category before deleting it.' });
    return;
  }

  await prisma.category.delete({ where: { id: request.params.id } });
  response.status(204).send();
});

app.post('/api/admin/products', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const input = productInput(request.body);
  if (!input) {
    response.status(400).json({ error: 'Product name, brand and category are required.' });
    return;
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    response.status(400).json({ error: 'Category does not exist.' });
    return;
  }

  const product = await prisma.product.create({ data: input });

  await prisma.stockLog.create({
    data: {
      productId: product.id,
      adminId: admin.id,
      oldQuantity: 0,
      newQuantity: product.quantity,
      reason: 'admin_create',
    },
  });

  response.status(201).json(serializeProduct(product));
});

app.patch('/api/admin/products/:id', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const current = await prisma.product.findUnique({ where: { id: request.params.id } });
  if (!current) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }

  const input = productInput({ ...current, ...request.body });
  if (!input) {
    response.status(400).json({ error: 'Product name, brand and category are required.' });
    return;
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    response.status(400).json({ error: 'Category does not exist.' });
    return;
  }

  const product = await prisma.product.update({
    where: { id: current.id },
    data: input,
  });

  if (input.quantity !== current.quantity) {
    await prisma.stockLog.create({
      data: {
        productId: current.id,
        adminId: admin.id,
        oldQuantity: current.quantity,
        newQuantity: input.quantity,
        reason: request.body.stockReason ?? 'admin_update',
      },
    });
  }

  response.json(serializeProduct(product));
});

app.delete('/api/admin/products/:id', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const orderItemsCount = await prisma.orderItem.count({ where: { productId: request.params.id } });

  if (orderItemsCount === 0) {
    await prisma.product.delete({ where: { id: request.params.id } });
  } else {
    await prisma.product.update({
      where: { id: request.params.id },
      data: { isActive: false, isArchived: true },
    });
  }

  response.status(204).send();
});

app.post('/api/order-notifications', async (request, response) => {
  if (!botToken) {
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
    const managers = await prisma.user.findMany({
      where: { role: UserRole.manager },
      select: { telegramId: true },
    });
    const recipientIds = managers.length > 0
      ? managers.map((manager) => manager.telegramId.toString())
      : [fallbackManagerTelegramId].filter((telegramId) => /^-?\d+$/.test(telegramId));
    const deliveryResults = await Promise.all(
      recipientIds.map(async (chatId) => {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const telegramResult = (await telegramResponse.json().catch(() => null)) as { ok?: boolean } | null;
        return telegramResponse.ok && telegramResult?.ok === true;
      }),
    );

    if (deliveryResults.length === 0 || deliveryResults.every((delivered) => !delivered)) {
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
  const user = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const order = isRecord(request.body?.order) ? request.body.order : {};
  const requestedItems = Array.isArray(order.items) ? order.items : [];
  const delivery = isRecord(order.delivery) ? order.delivery : {};

  if (requestedItems.length === 0 || requestedItems.length > 15) {
    response.status(400).json({ error: 'Order items are required.' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const items = [];
    let totalPrice = 0;

    for (const item of requestedItems) {
      if (!isRecord(item)) throw new Error('Order item is invalid.');
      const productId = textValue(item.productId, 80);
      const quantity = Math.max(1, Math.min(99, Math.floor(numberValue(item.quantity))));
      const product = await tx.product.findUnique({ where: { id: productId } });

      if (!product || !product.isActive || product.quantity < quantity) {
        throw new Error(`Недостаточно товара: ${productId}`);
      }

      const updated = await tx.product.updateMany({
        where: { id: product.id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });

      if (updated.count !== 1) {
        throw new Error(`Остаток изменился: ${product.title}`);
      }

      totalPrice += product.price * quantity;
      items.push({
        productId: product.id,
        productTitle: product.title,
        quantity,
        priceAtPurchase: product.price,
      });
    }

    return tx.order.create({
      data: {
        userId: user.id,
        totalPrice,
        status: OrderStatus.NEW,
        deliveryName: textValue(delivery.name, 160) || user.firstName,
        deliveryPhone: '',
        deliveryAddress: textValue(delivery.address, 320) || 'Не указан',
        deliveryComment: textValue(delivery.comment, 500),
        items: { create: items },
      },
      include: { items: { include: { product: { select: { brand: true } } } }, user: true },
    });
  });

  response.status(201).json(serializeOrder(result));
});

app.get('/api/orders/my', async (request, response) => {
  const user = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: { select: { brand: true } } } }, user: true },
  });

  response.json(orders.map(serializeOrder));
});

app.get('/api/admin/orders', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: { select: { brand: true } } } }, user: true },
  });

  response.json(orders.map(serializeOrder));
});

app.post('/api/admin/orders', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const productId = textValue(request.body?.productId, 80);
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }

  const quantity = Math.max(1, Math.min(99, Math.floor(numberValue(request.body?.quantity) || 1)));
  const price = Math.max(0, Math.round(numberValue(request.body?.price) || product.price));
  const totalPrice = price * quantity;

  const order = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { quantity: Math.max(0, product.quantity - quantity) },
    });

    return tx.order.create({
      data: {
        userId: admin.id,
        totalPrice,
        status: statusFromClient(request.body?.status),
        deliveryName: textValue(request.body?.customerName, 160) || 'Офлайн покупатель',
        deliveryPhone: '',
        deliveryAddress: textValue(request.body?.address, 320) || 'Офлайн продажа',
        deliveryComment: textValue(request.body?.comment, 500),
        items: {
          create: [{
            productId: product.id,
            productTitle: product.title,
            quantity,
            priceAtPurchase: price,
          }],
        },
      },
      include: { items: { include: { product: { select: { brand: true } } } }, user: true },
    });
  });

  response.status(201).json(serializeOrder(order));
});

app.patch('/api/admin/orders/:id/status', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const order = await prisma.order.update({
    where: { id: request.params.id },
    data: { status: statusFromClient(request.body.status) },
    include: { items: { include: { product: { select: { brand: true } } } }, user: true },
  });

  response.json(serializeOrder(order));
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
