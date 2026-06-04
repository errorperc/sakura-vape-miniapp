import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { id: 'disposable', label: 'Одноразки' },
  { id: 'liquid', label: 'Жидкости' },
  { id: 'pod', label: 'POD-системы' },
  { id: 'cartridge', label: 'Картриджи' },
  { id: 'accessory', label: 'Аксессуары' },
];

const products = [
  {
    title: 'Cuvie Plus 1200',
    brand: 'HQD',
    categoryId: 'disposable',
    description: 'Компактная одноразка с мягкой тягой и ярким тропическим вкусом.',
    flavor: 'Манго, лед',
    price: 1290,
    imageUrl: '/products/hqd-cuvie-plus.png',
    accent: '#23a6f0',
    nicotine: '20 мг',
    quantity: 18,
  },
  {
    title: 'BC5000 Ultra',
    brand: 'Elf Bar',
    categoryId: 'disposable',
    description: 'Емкая одноразовая модель для длительного использования.',
    flavor: 'Клубника, киви',
    price: 2190,
    imageUrl: '/products/elfbar-bc5000.png',
    accent: '#ff5f7e',
    nicotine: '20 мг',
    quantity: 4,
  },
  {
    title: 'Salt Berry Mix',
    brand: 'Brusko',
    categoryId: 'liquid',
    description: 'Солевая жидкость 30 мл с насыщенным ягодным профилем.',
    flavor: 'Лесные ягоды',
    price: 850,
    imageUrl: '/products/brusko-salt-berry.png',
    accent: '#7d5cff',
    nicotine: '20 мг',
    quantity: 32,
  },
  {
    title: 'Salt Frost Mint',
    brand: 'Brusko',
    categoryId: 'liquid',
    description: 'Свежая солевая жидкость для повседневного использования.',
    flavor: 'Мята, холодок',
    price: 790,
    imageUrl: '/products/brusko-mint.png',
    accent: '#1ec9a5',
    nicotine: '20 мг',
    quantity: 21,
  },
  {
    title: 'Argus P1 Kit',
    brand: 'Voopoo',
    categoryId: 'pod',
    description: 'POD-система с быстрой зарядкой и регулируемой тягой.',
    flavor: 'Устройство',
    price: 3490,
    imageUrl: '/products/voopoo-argus-p1.png',
    accent: '#f6a609',
    nicotine: '0 мг',
    quantity: 7,
  },
  {
    title: 'XROS Mini 3',
    brand: 'Vaporesso',
    categoryId: 'pod',
    description: 'Минималистичная POD-система с картриджами XROS.',
    flavor: 'Устройство',
    price: 2990,
    imageUrl: '/products/xros-mini.png',
    accent: '#4c82ff',
    nicotine: '0 мг',
    quantity: 3,
  },
  {
    title: 'Lowit 5500',
    brand: 'Elf Bar',
    categoryId: 'disposable',
    description: 'Одноразка с мягким фруктовым вкусом и индикатором заряда.',
    flavor: 'Арбуз, жвачка',
    price: 2350,
    imageUrl: '/products/elfbar-lowit.png',
    accent: '#ff9d2f',
    nicotine: '20 мг',
    quantity: 0,
  },
  {
    title: 'Картридж XROS 0.8',
    brand: 'Vaporesso',
    categoryId: 'cartridge',
    description: 'Сменный картридж для линейки XROS, упаковка 2 шт.',
    flavor: 'Сетка 0.8 Ом',
    price: 690,
    imageUrl: '/products/cartridge-xros.png',
    accent: '#35b96f',
    nicotine: '0 мг',
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

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { label: category.label },
      create: category,
    });
  }

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
