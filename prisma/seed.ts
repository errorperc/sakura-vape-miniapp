import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { id: 'disposable', label: 'Одноразки' },
  { id: 'liquid', label: 'Жидкости' },
  { id: 'pod', label: 'POD-системы' },
  { id: 'cartridge', label: 'Картриджи' },
  { id: 'accessory', label: 'Аксессуары' },
];

// Цены и остатки — стартовые, поправьте в админке
const products = [
  {
    title: 'Extra',
    brand: 'Waka',
    categoryId: 'disposable',
    description: 'Одноразовая система с плотным паром и насыщенным вкусом.',
    flavor: 'Уточните вкус в админке',
    price: 1500,
    imageUrl: '/products/generated/waka-extra-live-photo.webp',
    accent: '#e8336f',
    nicotine: '20 мг',
    quantity: 10,
  },
  {
    title: '10000',
    brand: 'Waka',
    categoryId: 'disposable',
    description: 'До 10 000 затяжек, ровная тяга до последней.',
    flavor: 'Уточните вкус в админке',
    price: 1700,
    imageUrl: '/products/generated/waka-10000-styled.webp',
    accent: '#e8336f',
    nicotine: '20 мг',
    quantity: 10,
  },
  {
    title: 'Sopro 20000',
    brand: 'Waka',
    categoryId: 'disposable',
    description: 'До 20 000 затяжек для тех, кто не любит часто менять устройство.',
    flavor: 'Уточните вкус в админке',
    price: 2200,
    imageUrl: '/products/generated/waka-sopro-20000-live-photo.webp',
    accent: '#e8336f',
    nicotine: '20 мг',
    quantity: 10,
  },
  {
    title: 'Pafos',
    brand: 'Pafos',
    categoryId: 'disposable',
    description: 'Компактная одноразка с мягким вкусом.',
    flavor: 'Уточните вкус в админке',
    price: 1300,
    imageUrl: '/products/generated/pafos-live-photo.webp',
    accent: '#e8336f',
    nicotine: '20 мг',
    quantity: 10,
  },
  {
    title: 'Bad Trip',
    brand: 'Rick and Morty',
    categoryId: 'disposable',
    description: 'Лимитированная серия Rick and Morty.',
    flavor: 'Уточните вкус в админке',
    price: 1600,
    imageUrl: '/products/generated/rick-morty-bad-trip-live-photo.webp',
    accent: '#e8336f',
    nicotine: '20 мг',
    quantity: 10,
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

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { label: category.label },
      create: category,
    });
  }

  // Стартовый каталог — только в пустую базу, чтобы не затирать цены и остатки из админки
  if ((await prisma.product.count()) > 0) return;

  for (const product of products) {
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
