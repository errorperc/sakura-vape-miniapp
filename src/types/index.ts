export type View = 'home' | 'profile' | 'delivery' | 'cart' | 'admin';

export type ProductCategory = 'disposable' | 'liquid' | 'pod' | 'cartridge' | 'accessory';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type OrderStatus =
  | 'Новый'
  | 'В обработке'
  | 'Передан в доставку'
  | 'Завершен'
  | 'Отменен';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  taste: string;
  description: string;
  price: number;
  stock: StockStatus;
  stockCount: number;
  isActive: boolean;
  image: string;
  accent: string;
  nicotine: string;
}

export interface CatalogFilter {
  id: string;
  label: string;
  mode: 'all' | 'brand' | 'category';
  value?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface DeliveryDetails {
  name: string;
  phone: string;
  address: string;
  comment: string;
}

export interface DeliverySettings {
  priceLabel: string;
  courierTitle: string;
  courierDescription: string;
  pickupTitle: string;
  pickupDescription: string;
  timeTitle: string;
  timeDescription: string;
  zonesTitle: string;
  zonesDescription: string;
  primaryCondition: string;
  secondaryCondition: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  brand: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: number;
  createdAt: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  delivery: DeliveryDetails;
}

export interface TelegramUserProfile {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  isDemo: boolean;
}

export interface CheckoutDraft extends DeliveryDetails {}
