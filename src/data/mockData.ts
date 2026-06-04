import type { CatalogCategory, CatalogFilter, DeliverySettings, Order, Product } from '../types';
import { publicAsset } from '../lib/assets';

const configuredAdminIds = (import.meta.env.VITE_ADMIN_TELEGRAM_IDS ?? '')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value > 0);

export const ADMIN_TELEGRAM_IDS = configuredAdminIds.length > 0 ? configuredAdminIds : [777000];
export const OWNER_TELEGRAM_ID =
  Number(import.meta.env.VITE_OWNER_TELEGRAM_ID) || ADMIN_TELEGRAM_IDS[0];

export const filters: CatalogFilter[] = [
  { id: 'all', label: 'Все', mode: 'all' },
  { id: 'disposables', label: 'Одноразки', mode: 'category', value: 'disposable' },
  { id: 'liquids', label: 'Жидкости', mode: 'category', value: 'liquid' },
  { id: 'pods', label: 'POD-системы', mode: 'category', value: 'pod' },
  { id: 'cartridges', label: 'Картриджи', mode: 'category', value: 'cartridge' },
  { id: 'accessories', label: 'Аксессуары', mode: 'category', value: 'accessory' },
  { id: 'hqd', label: 'HQD', mode: 'brand', value: 'HQD' },
  { id: 'elf-bar', label: 'Elf Bar', mode: 'brand', value: 'Elf Bar' },
  { id: 'brusko', label: 'Brusko', mode: 'brand', value: 'Brusko' },
];

export const initialCategories: CatalogCategory[] = [
  { id: 'disposable', label: 'Одноразки' },
  { id: 'liquid', label: 'Жидкости' },
  { id: 'pod', label: 'POD-системы' },
  { id: 'cartridge', label: 'Картриджи' },
  { id: 'accessory', label: 'Аксессуары' },
];

export const initialDeliverySettings: DeliverySettings = {
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

export const initialProducts: Product[] = [
  {
    id: 'hqd-cuvie-plus',
    name: 'Cuvie Plus 1200',
    brand: 'HQD',
    category: 'disposable',
    taste: 'Манго, лед',
    description: 'Компактная одноразка с мягкой тягой и ярким тропическим вкусом.',
    price: 1290,
    stock: 'in_stock',
    stockCount: 18,
    isActive: true,
    image: publicAsset('products/hqd-cuvie-plus.png'),
    accent: '#23a6f0',
    nicotine: '20 мг',
  },
  {
    id: 'elfbar-bc5000',
    name: 'BC5000 Ultra',
    brand: 'Elf Bar',
    category: 'disposable',
    taste: 'Клубника, киви',
    description: 'Емкая одноразовая модель для длительного использования.',
    price: 2190,
    stock: 'low_stock',
    stockCount: 4,
    isActive: true,
    image: publicAsset('products/elfbar-bc5000.png'),
    accent: '#ff5f7e',
    nicotine: '20 мг',
  },
  {
    id: 'brusko-salt-berry',
    name: 'Salt Berry Mix',
    brand: 'Brusko',
    category: 'liquid',
    taste: 'Лесные ягоды',
    description: 'Солевая жидкость 30 мл с насыщенным ягодным профилем.',
    price: 850,
    stock: 'in_stock',
    stockCount: 32,
    isActive: true,
    image: publicAsset('products/brusko-salt-berry.png'),
    accent: '#7d5cff',
    nicotine: '20 мг',
  },
  {
    id: 'brusko-mint',
    name: 'Salt Frost Mint',
    brand: 'Brusko',
    category: 'liquid',
    taste: 'Мята, холодок',
    description: 'Свежая солевая жидкость для повседневного использования.',
    price: 790,
    stock: 'in_stock',
    stockCount: 21,
    isActive: true,
    image: publicAsset('products/brusko-mint.png'),
    accent: '#1ec9a5',
    nicotine: '20 мг',
  },
  {
    id: 'voopoo-argus-p1',
    name: 'Argus P1 Kit',
    brand: 'Voopoo',
    category: 'pod',
    taste: 'Устройство',
    description: 'POD-система с быстрой зарядкой и регулируемой тягой.',
    price: 3490,
    stock: 'in_stock',
    stockCount: 7,
    isActive: true,
    image: publicAsset('products/voopoo-argus-p1.png'),
    accent: '#f6a609',
    nicotine: '0 мг',
  },
  {
    id: 'xros-mini',
    name: 'XROS Mini 3',
    brand: 'Vaporesso',
    category: 'pod',
    taste: 'Устройство',
    description: 'Минималистичная POD-система с картриджами XROS.',
    price: 2990,
    stock: 'low_stock',
    stockCount: 3,
    isActive: true,
    image: publicAsset('products/xros-mini.png'),
    accent: '#4c82ff',
    nicotine: '0 мг',
  },
  {
    id: 'elfbar-lowit',
    name: 'Lowit 5500',
    brand: 'Elf Bar',
    category: 'disposable',
    taste: 'Арбуз, жвачка',
    description: 'Одноразка с мягким фруктовым вкусом и индикатором заряда.',
    price: 2350,
    stock: 'out_of_stock',
    stockCount: 0,
    isActive: true,
    image: publicAsset('products/elfbar-lowit.png'),
    accent: '#ff9d2f',
    nicotine: '20 мг',
  },
  {
    id: 'cartridge-xros',
    name: 'Картридж XROS 0.8',
    brand: 'Vaporesso',
    category: 'cartridge',
    taste: 'Сетка 0.8 Ом',
    description: 'Сменный картридж для линейки XROS, упаковка 2 шт.',
    price: 690,
    stock: 'in_stock',
    stockCount: 16,
    isActive: true,
    image: publicAsset('products/cartridge-xros.png'),
    accent: '#35b96f',
    nicotine: '0 мг',
  },
];

export const initialOrders: Order[] = [
  {
    id: 'ORD-2406-1021',
    userId: 777000,
    createdAt: '2026-05-28T15:40:00.000Z',
    status: 'Завершен',
    total: 2140,
    delivery: {
      name: 'Алексей',
      address: 'Минск, ул. Немига, 8',
      comment: 'После 19:00',
    },
    items: [
      {
        productId: 'brusko-salt-berry',
        productName: 'Salt Berry Mix',
        brand: 'Brusko',
        price: 850,
        quantity: 1,
      },
      {
        productId: 'hqd-cuvie-plus',
        productName: 'Cuvie Plus 1200',
        brand: 'HQD',
        price: 1290,
        quantity: 1,
      },
    ],
  },
  {
    id: 'ORD-2406-1044',
    userId: 777000,
    createdAt: '2026-06-01T11:25:00.000Z',
    status: 'Передан в доставку',
    total: 3490,
    delivery: {
      name: 'Алексей',
      address: 'Минск, пр-т Победителей, 21',
      comment: 'Позвонить за 10 минут',
    },
    items: [
      {
        productId: 'voopoo-argus-p1',
        productName: 'Argus P1 Kit',
        brand: 'Voopoo',
        price: 3490,
        quantity: 1,
      },
    ],
  },
];
