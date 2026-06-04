export type View = 'home' | 'profile' | 'delivery' | 'cart' | 'orders' | 'admin';

export type AdminRole = 'user' | 'manager' | 'admin' | 'owner';

export interface AdminSession {
  telegramId: string;
  role: AdminRole;
  isAdmin: boolean;
  isOwner: boolean;
}

export interface TeamMember {
  telegramId: string;
  firstName: string;
  username: string | null;
  role: AdminRole;
  createdAt: string;
}

export type ProductCategory = string;

export interface CatalogCategory {
  id: ProductCategory;
  label: string;
}

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

export interface ManualOrderDraft {
  customerName: string;
  address: string;
  comment: string;
  productId: string;
  quantity: number;
  price: number;
  status: OrderStatus;
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
