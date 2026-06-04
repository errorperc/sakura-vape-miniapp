import express from 'express';
import { PrismaClient, OrderStatus, ProductCategory, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);

app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

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
        deliveryPhone: request.body.delivery.phone,
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
