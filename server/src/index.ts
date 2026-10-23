import express from 'express';
import { PrismaClient, OrderStatus, UserRole } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getAddressError } from '../../shared/address';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);
const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const ownerTelegramId = process.env.OWNER_TELEGRAM_ID ?? process.env.ADMIN_TELEGRAM_ID ?? '';
const fallbackManagerTelegramId = process.env.MANAGER_TELEGRAM_ID ?? ownerTelegramId;
const publicAppUrl = process.env.PUBLIC_APP_URL ?? 'https://api.185-246-217-69.sslip.io/';
const publicAppOrigin = new URL(publicAppUrl).origin;
const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? 'data/uploads');
// Локальный запуск без Caddy: Express сам отдаёт собранный мини-апп из dist/
const staticDir = process.env.SERVE_STATIC === '1' ? path.resolve('dist') : '';
const orderCooldowns = new Map<number, number>();
const addressSuggestionCache = new Map<string, { expiresAt: number; suggestions: AddressSuggestion[] }>();

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

fs.mkdirSync(uploadsDir, { recursive: true });
// Имена файлов уникальные (uuid), поэтому их можно кэшировать навсегда
app.use('/uploads', express.static(uploadsDir, { immutable: true, maxAge: '365d', fallthrough: false }));

// Миниатюры WebP нужной ширины: /thumbs/480/products/x.webp или /thumbs/480/uploads/y.webp.
// Нарезаются один раз и кэшируются на диске — в карточку не грузится фото 1254×1254.
const thumbWidths = new Set([160, 480, 900]);
const publicDir = path.resolve(process.env.PUBLIC_DIR ?? 'public');
const thumbsDir = path.resolve(process.env.THUMBS_DIR ?? 'data/thumbs');

app.get(/^\/thumbs\/(\d+)\/(.+)$/, async (request, response) => {
  const params = request.params as unknown as Record<string, string>;
  const width = Number(params[0]);
  const relative = path.normalize(decodeURIComponent(params[1])).replace(/^([/\\])+/, '');
  const fromUploads = relative.startsWith(`uploads${path.sep}`);
  const sourceRoot = fromUploads ? uploadsDir : publicDir;
  const source = path.join(sourceRoot, fromUploads ? relative.slice('uploads'.length + 1) : relative);

  if (!thumbWidths.has(width) || !source.startsWith(sourceRoot + path.sep) || !/\.(webp|png|jpe?g)$/i.test(source)) {
    response.status(404).end();
    return;
  }

  const target = path.join(thumbsDir, String(width), `${relative}.webp`);
  try {
    if (!fs.existsSync(target)) {
      if (!fs.existsSync(source)) {
        response.status(404).end();
        return;
      }
      const { default: sharp } = await import('sharp');
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(target);
    }
    response.setHeader('Cache-Control', 'public, max-age=2592000');
    response.type('image/webp').sendFile(target);
  } catch (error) {
    console.error('[thumbs]', error);
    response.status(500).end();
  }
});

interface TelegramInitUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface AddressSuggestion {
  label: string;
  value: string;
  source: string;
}

interface NominatimResult {
  display_name?: string;
  type?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    city_district?: string;
  };
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

const normalizeAddressText = (value: string) => value.replace(/\s+/g, ' ').trim();

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

const callTelegramApi = async (method: string, body: Record<string, unknown>) => {
  if (!botToken) return false;

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const telegramResult = (await telegramResponse.json().catch(() => null)) as { ok?: boolean } | null;

  return telegramResponse.ok && telegramResult?.ok === true;
};

const sendShopLaunchMessage = async (chatId: number | string) => {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: 'Sakura Vape уже открыт. Начать покупки можно тут — нажмите кнопку ниже.',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Начать покупки',
            web_app: { url: publicAppUrl },
          },
        ],
      ],
    },
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

app.post('/api/telegram/webhook', async (request, response) => {
  await handleTelegramUpdate(request.body).catch((error) => console.error('[bot]', error));
  response.json({ ok: true });
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
    response.status(401).json({ error: 'Откройте магазин внутри Telegram и попробуйте ещё раз.' });
    return null;
  }

  return upsertAuthenticatedUser(telegramUser);
};

const requireAdmin = async (request: express.Request, response: express.Response) => {
  const admin = await requireAuthenticatedUser(request, response);
  if (!admin) return null;

  if (admin.role !== UserRole.admin && admin.role !== UserRole.owner) {
    response.status(403).json({ error: 'Нет доступа к админке.' });
    return null;
  }

  return admin;
};

const requireOwner = async (request: express.Request, response: express.Response) => {
  const owner = await requireAuthenticatedUser(request, response);
  if (!owner) return null;

  if (owner.role !== UserRole.owner || owner.telegramId.toString() !== ownerTelegramId) {
    response.status(403).json({ error: 'Командой управляет только владелец магазина.' });
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

const toAddressSuggestion = (result: NominatimResult): AddressSuggestion | null => {
  const address = result.address ?? {};
  const street = address.road ?? address.pedestrian ?? address.footway ?? '';
  const house = address.house_number ?? '';
  const city = address.city ?? address.town ?? address.village ?? 'Минск';
  const area = address.suburb ?? address.city_district ?? '';
  const parts = [city, street, house].filter(Boolean);
  const value = parts.length >= 2 ? parts.join(', ') : textValue(result.display_name, 180);

  if (!value || value.length < 6) return null;

  return {
    label: [street && house ? `${street}, ${house}` : street || value, area || city].filter(Boolean).join(' · '),
    value,
    source: result.type ?? 'address',
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
  const imageUrl = textValue(payload.image ?? payload.imageUrl, 4_000_000) || '/products/hqd-cuvie-plus.png';
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

// ---------- Фото товаров ----------

const imageExtensions: Record<string, string> = { webp: 'webp', png: 'png', jpeg: 'jpg', jpg: 'jpg' };

// Админка присылает фото как data URL (уже сжатое в WebP). Храним его файлом,
// а в базе — короткую ссылку: так каталог грузится быстро и фото кэшируются.
const storeUploadedImage = async (imageUrl: string) => {
  const match = imageUrl.match(/^data:image\/(webp|png|jpe?g);base64,([a-z0-9+/=]+)$/i);
  if (!match) return imageUrl;

  const fileName = `${randomUUID()}.${imageExtensions[match[1].toLowerCase()]}`;
  await fs.promises.writeFile(path.join(uploadsDir, fileName), Buffer.from(match[2], 'base64'));
  return `/uploads/${fileName}`;
};

// ---------- Заказы и уведомления ----------

const orderInclude = { items: { include: { product: { select: { brand: true } } } }, user: true } as const;

const findFullOrder = (id: string) => prisma.order.findUnique({ where: { id }, include: orderInclude });

type FullOrder = NonNullable<Awaited<ReturnType<typeof findFullOrder>>>;

const formatRub = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;
const shortOrderId = (id: string) => id.slice(0, 8).toUpperCase();
const offlineAddress = 'Офлайн продажа';
// Адрес заказа при самовывозе — так способ получения виден менеджеру и в истории
const pickupAddress = 'Самовывоз';

const staffRoles: UserRole[] = [UserRole.manager, UserRole.admin, UserRole.owner];

const managerRecipientIds = async () => {
  const managers = await prisma.user.findMany({ where: { role: UserRole.manager }, select: { telegramId: true } });
  if (managers.length > 0) return managers.map((manager) => manager.telegramId.toString());
  return [fallbackManagerTelegramId].filter((telegramId) => /^-?\d+$/.test(telegramId));
};

const statusButtons: Array<[OrderStatus, string]> = [
  [OrderStatus.PROCESSING, '✅ Принять'],
  [OrderStatus.OUT_FOR_DELIVERY, '🚚 В доставке'],
  [OrderStatus.COMPLETED, '🏁 Выполнен'],
  [OrderStatus.CANCELED, '✖️ Отменить'],
];

const orderStatusKeyboard = (order: { id: string; status: OrderStatus }) => {
  if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELED) {
    return { inline_keyboard: [] };
  }

  const buttons = statusButtons
    .filter(([status]) => status !== order.status)
    .map(([status, text]) => ({ text, callback_data: `st:${order.id}:${status}` }));
  return { inline_keyboard: [buttons.slice(0, 2), buttons.slice(2)] };
};

const managerOrderText = (order: FullOrder) => {
  const user = order.user;
  const username = user.username ? `@${escapeHtml(user.username)}` : 'username не указан';
  const itemLines = order.items.map((item, index) => {
    const brand = item.product?.brand ? ` · ${escapeHtml(item.product.brand)}` : '';
    return `${index + 1}. <b>${escapeHtml(item.productTitle)}</b>${brand}\n   ${item.quantity} × ${formatRub(item.priceAtPurchase)} = ${formatRub(item.quantity * item.priceAtPurchase)}`;
  });

  return [
    `🌸 <b>Заказ №${shortOrderId(order.id)}</b> · ${statusToClient[order.status]}`,
    '',
    `<b>Покупатель:</b> <a href="tg://user?id=${user.telegramId}">${escapeHtml(user.firstName)}</a>`,
    `<b>Telegram:</b> ${username} · <code>${user.telegramId}</code>`,
    `<b>Имя для заказа:</b> ${escapeHtml(order.deliveryName)}`,
    '',
    ...itemLines,
    '',
    `<b>Итого:</b> ${formatRub(order.totalPrice)}`,
    `<b>Адрес:</b> ${escapeHtml(order.deliveryAddress)}`,
    `<b>Комментарий:</b> ${escapeHtml(order.deliveryComment || 'нет')}`,
  ].join('\n');
};

const notifyManagersAboutOrder = async (order: FullOrder) => {
  const recipients = await managerRecipientIds();
  if (recipients.length === 0) {
    console.error('[bot] Некому отправить заказ: укажите MANAGER_TELEGRAM_ID или назначьте менеджера.');
    return;
  }

  await Promise.all(
    recipients.map(async (chatId) => {
      const sent = await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: managerOrderText(order),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: orderStatusKeyboard(order),
      }).catch(() => false);
      if (!sent) console.error(`[bot] Не удалось отправить заказ ${chatId}. Менеджер должен написать боту /start.`);
    }),
  );
};

const customerStatusText: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'принят и собирается',
  OUT_FOR_DELIVERY: 'передан курьеру',
  COMPLETED: 'выполнен. Спасибо за покупку! 🌸',
  CANCELED: 'отменён. Если это ошибка — напишите нам.',
};

const notifyCustomerAboutStatus = async (order: FullOrder) => {
  const text = customerStatusText[order.status];
  // Офлайн-продажу без привязанного клиента уведомлять некому
  if (!text || (order.deliveryAddress === offlineAddress && order.user.role !== UserRole.user)) return;

  await callTelegramApi('sendMessage', {
    chat_id: order.user.telegramId.toString(),
    text: `Заказ №${shortOrderId(order.id)} ${text}`,
  }).catch(() => false);
};

// Смена статуса с учётом склада: отмена возвращает товар, восстановление — снова списывает
const changeOrderStatus = async (orderId: string, nextStatus: OrderStatus, actorId: string) => {
  const changed = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new Error('Заказ не найден.');
    if (order.status === nextStatus) return false;

    const cancelling = nextStatus === OrderStatus.CANCELED;
    const restoring = order.status === OrderStatus.CANCELED;

    if (cancelling || restoring) {
      for (const item of order.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        if (restoring && product.quantity < item.quantity) {
          throw new Error(`Недостаточно товара «${product.title}», чтобы вернуть заказ в работу.`);
        }

        const newQuantity = product.quantity + (cancelling ? item.quantity : -item.quantity);
        await tx.product.update({ where: { id: product.id }, data: { quantity: newQuantity } });
        await tx.stockLog.create({
          data: {
            productId: product.id,
            adminId: actorId,
            oldQuantity: product.quantity,
            newQuantity,
            reason: cancelling ? 'order_cancel' : 'order_restore',
          },
        });
      }
    }

    await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    return true;
  });

  const order = await findFullOrder(orderId);
  if (!order) throw new Error('Заказ не найден.');
  if (changed) notifyCustomerAboutStatus(order).catch(() => undefined);
  return order;
};

// ---------- Бот ----------

const sendTelegramIdMessage = (chatId: number | string, userId: unknown) =>
  callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: `Ваш Telegram ID: <code>${Number(userId) || '—'}</code>\nID этого чата: <code>${chatId}</code>`,
    parse_mode: 'HTML',
  });

const handleStatusCallback = async (query: Record<string, unknown>) => {
  const from = isRecord(query.from) ? query.from : {};
  const data = textValue(query.data, 80);
  const [, orderId, status] = data.split(':');
  const answer = (text: string) => callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text });

  if (!orderId || !(status in OrderStatus) || typeof from.id !== 'number') {
    await answer('Неизвестная команда');
    return;
  }

  const telegramId = String(from.id);
  const actor = await prisma.user.upsert({
    where: { telegramId: BigInt(telegramId) },
    update: {},
    create: { telegramId: BigInt(telegramId), firstName: textValue(from.first_name, 128) || 'Менеджер' },
  });
  const isStaff = staffRoles.includes(actor.role) || telegramId === fallbackManagerTelegramId || telegramId === ownerTelegramId;
  if (!isStaff) {
    await answer('Нет доступа');
    return;
  }

  try {
    const order = await changeOrderStatus(orderId, status as OrderStatus, actor.id);
    const message = isRecord(query.message) ? query.message : null;
    const chat = message && isRecord(message.chat) ? message.chat : null;
    if (chat && message) {
      await callTelegramApi('editMessageText', {
        chat_id: chat.id,
        message_id: message.message_id,
        text: managerOrderText(order),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: orderStatusKeyboard(order),
      });
    }
    await answer(`Статус: ${statusToClient[order.status]}`);
  } catch (error) {
    await answer(error instanceof Error ? error.message.slice(0, 190) : 'Ошибка');
  }
};

const handleTelegramUpdate = async (body: unknown) => {
  const update = isRecord(body) ? body : {};

  if (isRecord(update.callback_query)) {
    await handleStatusCallback(update.callback_query);
    return;
  }

  const message = isRecord(update.message) ? update.message : null;
  const chat = message && isRecord(message.chat) ? message.chat : null;
  const chatId = typeof chat?.id === 'number' || typeof chat?.id === 'string' ? chat.id : null;
  const from = message && isRecord(message.from) ? message.from : {};
  const text = textValue(message?.text, 120);
  if (!chatId) return;

  if (text.startsWith('/id')) {
    await sendTelegramIdMessage(chatId, from.id);
  } else if (chat?.type === 'private' && (!text || text.startsWith('/start') || text.startsWith('/shop'))) {
    await sendShopLaunchMessage(chatId);
  }
};

// Для локального запуска без постоянного адреса: бот сам забирает обновления (long polling)
const startTelegramPolling = async () => {
  await callTelegramApi('deleteWebhook', { drop_pending_updates: false });
  let offset = 0;
  console.log('[bot] Получаю обновления через long polling');

  for (;;) {
    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offset, timeout: 30, allowed_updates: ['message', 'callback_query'] }),
        signal: AbortSignal.timeout(40_000),
      });
      const result = (await telegramResponse.json()) as { ok: boolean; result?: Array<{ update_id: number }>; description?: string };
      if (!result.ok) throw new Error(result.description ?? `HTTP ${telegramResponse.status}`);

      for (const update of result.result ?? []) {
        offset = update.update_id + 1;
        await handleTelegramUpdate(update).catch((error) => console.error('[bot]', error));
      }
    } catch (error) {
      console.error('[bot] Нет связи с Telegram, повтор через 5 с:', error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
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
    response.status(400).json({ error: 'Укажите Telegram ID и роль.' });
    return;
  }

  if (telegramIdValue === ownerTelegramId) {
    response.status(400).json({ error: 'Роль владельца изменить нельзя.' });
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
    response.status(400).json({ error: 'Владельца удалить нельзя.' });
    return;
  }

  const member = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramIdValue) } });
  if (!member) {
    response.status(404).json({ error: 'Аккаунт не найден.' });
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

app.get('/api/address/suggest', async (request, response) => {
  const query = normalizeAddressText(textValue(request.query.q, 120));

  if (query.length < 3 || !/[a-zа-яё]{2,}/i.test(query)) {
    response.json([]);
    return;
  }

  const cacheKey = query.toLowerCase();
  const cached = addressSuggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    response.json(cached.suggestions);
    return;
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '6');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'by');
    url.searchParams.set('accept-language', 'ru');
    url.searchParams.set('q', query.includes('Минск') ? query : `Минск ${query}`);

    const geoResponse = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Sakura Vape MiniApp address autocomplete',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!geoResponse.ok) {
      response.json([]);
      return;
    }

    const results = (await geoResponse.json()) as NominatimResult[];
    const suggestions = results
      .map(toAddressSuggestion)
      .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
      .filter((suggestion, index, list) => list.findIndex((item) => item.value === suggestion.value) === index)
      .slice(0, 5);

    addressSuggestionCache.set(cacheKey, {
      suggestions,
      expiresAt: Date.now() + 1000 * 60 * 60,
    });
    response.json(suggestions);
  } catch {
    response.json([]);
  }
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
    response.status(400).json({ error: 'Введите название категории.' });
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
    response.status(400).json({ error: 'Введите название категории.' });
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
    response.status(409).json({ error: 'Сначала перенесите товары в другую категорию.' });
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
    response.status(400).json({ error: 'Укажите название, бренд и категорию товара.' });
    return;
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    response.status(400).json({ error: 'Такой категории нет.' });
    return;
  }

  input.imageUrl = await storeUploadedImage(input.imageUrl);
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
    response.status(404).json({ error: 'Товар не найден.' });
    return;
  }

  const input = productInput({ ...current, ...request.body });
  if (!input) {
    response.status(400).json({ error: 'Укажите название, бренд и категорию товара.' });
    return;
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    response.status(400).json({ error: 'Такой категории нет.' });
    return;
  }

  input.imageUrl = await storeUploadedImage(input.imageUrl);
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

app.post('/api/orders', async (request, response) => {
  const user = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const order = isRecord(request.body?.order) ? request.body.order : {};
  const requestedItems = Array.isArray(order.items) ? order.items : [];
  const delivery = isRecord(order.delivery) ? order.delivery : {};
  const isPickup = delivery.method === 'pickup';
  const deliveryAddress = isPickup ? pickupAddress : normalizeAddressText(textValue(delivery.address, 320));

  if (requestedItems.length === 0 || requestedItems.length > 15) {
    response.status(400).json({ error: 'Корзина пуста.' });
    return;
  }

  const addressError = isPickup ? '' : getAddressError(deliveryAddress);
  if (addressError) {
    response.status(400).json({ error: addressError });
    return;
  }

  const telegramId = Number(user.telegramId);
  const now = Date.now();
  if (now - (orderCooldowns.get(telegramId) ?? 0) < 10_000) {
    response.status(429).json({ error: 'Подождите несколько секунд перед следующим заказом.' });
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
        throw new Error(
          product ? `«${product.title}»: в наличии только ${product.quantity} шт.` : 'Один из товаров больше не продаётся.',
        );
      }

      const updated = await tx.product.updateMany({
        where: { id: product.id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });

      if (updated.count !== 1) {
        throw new Error(`Остаток «${product.title}» только что изменился, попробуйте ещё раз.`);
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
        deliveryAddress,
        deliveryComment: textValue(delivery.comment, 500),
        items: { create: items },
      },
      include: orderInclude,
    });
  });

  orderCooldowns.set(telegramId, now);
  notifyManagersAboutOrder(result).catch((error) => console.error('[bot]', error));
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
    response.status(404).json({ error: 'Товар не найден.' });
    return;
  }

  const quantity = Math.max(1, Math.min(99, Math.floor(numberValue(request.body?.quantity) || 1)));
  const price = Math.max(0, Math.round(numberValue(request.body?.price) || product.price));
  const totalPrice = price * quantity;
  const customerTelegramId = textValue(request.body?.customerTelegramId, 30);
  const customerName = textValue(request.body?.customerName, 160);

  if (customerTelegramId && !/^\d{5,20}$/.test(customerTelegramId)) {
    response.status(400).json({ error: 'Telegram ID клиента должен содержать только цифры.' });
    return;
  }

  const order = await prisma.$transaction(async (tx) => {
    const linkedUser = customerTelegramId
      ? await tx.user.findUnique({ where: { telegramId: BigInt(customerTelegramId) } })
      : null;
    const orderUser = linkedUser ?? (customerTelegramId
      ? await tx.user.create({
          data: {
            telegramId: BigInt(customerTelegramId),
            firstName: customerName || `Клиент ${customerTelegramId}`,
            username: null,
          },
        })
      : admin);

    const updated = await tx.product.updateMany({
      where: { id: product.id, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (updated.count !== 1) {
      throw new Error(`На складе меньше ${quantity} шт. товара «${product.title}».`);
    }
    await tx.stockLog.create({
      data: {
        productId: product.id,
        adminId: admin.id,
        oldQuantity: product.quantity,
        newQuantity: product.quantity - quantity,
        reason: 'offline_sale',
      },
    });

    return tx.order.create({
      data: {
        userId: orderUser.id,
        totalPrice,
        status: statusFromClient(request.body?.status),
        deliveryName: customerName || orderUser.firstName || 'Офлайн покупатель',
        deliveryPhone: '',
        deliveryAddress: textValue(request.body?.address, 320) || offlineAddress,
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

  const order = await changeOrderStatus(request.params.id, statusFromClient(request.body?.status), admin.id);
  response.json(serializeOrder(order));
});

// Учёт продаж: сколько и чего продано за период + последние движения склада
app.get('/api/admin/stats', async (request, response) => {
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  const period = textValue(request.query.period, 10);
  const now = new Date();
  const since =
    period === 'day' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : period === 'week' ? new Date(now.getTime() - 7 * 86_400_000)
    : period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === 'year' ? new Date(now.getFullYear(), 0, 1)
    : null;

  const [items, products, stockLogs] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { status: { not: OrderStatus.CANCELED }, ...(since ? { createdAt: { gte: since } } : {}) } },
      select: { productId: true, productTitle: true, quantity: true, priceAtPurchase: true, orderId: true },
    }),
    prisma.product.findMany({ where: { isArchived: false }, select: { id: true, title: true, brand: true, quantity: true, price: true } }),
    prisma.stockLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { product: { select: { title: true } }, admin: { select: { firstName: true, username: true } } },
    }),
  ]);

  const byProduct = new Map<string, { productId: string; title: string; sold: number; revenue: number }>();
  for (const item of items) {
    const row = byProduct.get(item.productId) ?? { productId: item.productId, title: item.productTitle, sold: 0, revenue: 0 };
    row.sold += item.quantity;
    row.revenue += item.quantity * item.priceAtPurchase;
    byProduct.set(item.productId, row);
  }

  response.json({
    period: since ? period : 'all',
    revenue: items.reduce((sum, item) => sum + item.quantity * item.priceAtPurchase, 0),
    unitsSold: items.reduce((sum, item) => sum + item.quantity, 0),
    ordersCount: new Set(items.map((item) => item.orderId)).size,
    products: [...byProduct.values()].sort((left, right) => right.sold - left.sold),
    stock: products
      .map((product) => ({ ...product, stockValue: product.quantity * product.price }))
      .sort((left, right) => left.quantity - right.quantity),
    stockLogs: stockLogs.map((log) => ({
      id: log.id,
      productTitle: log.product.title,
      oldQuantity: log.oldQuantity,
      newQuantity: log.newQuantity,
      reason: log.reason,
      adminName: log.admin.username ? `@${log.admin.username}` : log.admin.firstName,
      createdAt: log.createdAt.toISOString(),
    })),
  });
});

if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, {
    index: false,
    setHeaders: (response, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else if (/.(webp|png|jpe?g)$/i.test(filePath)) response.setHeader('Cache-Control', 'public, max-age=604800');
    },
  }));
  // Telegram любит кэшировать оболочку приложения — index.html всегда отдаём свежим
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Наши ошибки бизнес-логики написаны по-русски — их можно показать пользователю
  if (/[а-яё]/i.test(message)) {
    response.status(409).json({ error: message });
    return;
  }
  console.error('[api]', error);
  response.status(500).json({ error: 'Внутренняя ошибка сервера. Попробуйте ещё раз.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API server is running on http://localhost:${port}`);
  if (botToken && process.env.TELEGRAM_POLLING === '1') startTelegramPolling();
});

const shutdown = () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
