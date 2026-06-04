import { PrismaClient, ProductCategory, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    title: 'Cuvie Plus 1200',
    brand: 'HQD',
    category: ProductCategory.disposable,
    description: 'Компактная одноразка с мягкой тягой и ярким тропическим вкусом.',
    flavor: 'Манго, лед',
    price: 1290,
    imageUrl: '/products/hqd-cuvie-plus.png',
    quantity: 18,
  },
  {
    title: 'BC5000 Ultra',
    brand: 'Elf Bar',
    category: ProductCategory.disposable,
    description: 'Емкая одноразовая модель для длительного использования.',
    flavor: 'Клубника, киви',
    price: 2190,
    imageUrl: '/products/elfbar-bc5000.png',
    quantity: 4,
  },
  {
    title: 'Salt Berry Mix',
    brand: 'Brusko',
    category: ProductCategory.liquid,
    description: 'Солевая жидкость 30 мл с насыщенным ягодным профилем.',
    flavor: 'Лесные ягоды',
    price: 850,
    imageUrl: '/products/brusko-salt-berry.png',
    quantity: 32,
  },
  {
    title: 'Картридж XROS 0.8',
    brand: 'Vaporesso',
    category: ProductCategory.cartridge,
    description: 'Сменный картридж для линейки XROS, упаковка 2 шт.',
    flavor: 'Сетка 0.8 Ом',
    price: 690,
    imageUrl: '/products/cartridge-xros.png',
    quantity: 16,
  },
];

async function main() {
  const adminTelegramId = BigInt(process.env.OWNER_TELEGRAM_ID ?? process.env.ADMIN_TELEGRAM_ID ?? '777000');
  const admin = await prisma.user.upsert({
    where: { telegramId: adminTelegramId },
    update: { role: UserRole.owner },
    create: {
      telegramId: adminTelegramId,
      firstName: 'Алексей',
      username: 'demo_vaper',
      role: UserRole.owner,
    },
  });

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { title: product.title, brand: product.brand },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
      continue;
    }

    const created = await prisma.product.create({ data: product });
    await prisma.stockLog.create({
      data: {
        productId: created.id,
        adminId: admin.id,
        oldQuantity: 0,
        newQuantity: created.quantity,
        reason: 'seed',
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
