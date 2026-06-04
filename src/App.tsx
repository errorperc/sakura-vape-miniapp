import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { BottomNav } from './components/BottomNav';
import { filters, initialDeliverySettings, initialOrders, initialProducts } from './data/mockData';
import { notifyManagerAboutOrder } from './lib/ordersApi';
import { formatUserName, getTelegramUser, haptic, initTelegramApp, isAdminUser } from './lib/telegram';
import { CartPage, type ResolvedCartItem } from './pages/CartPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { useCartStore } from './store/cartStore';
import type { CheckoutDraft, DeliverySettings, Order, OrderStatus, Product, StockStatus, View } from './types';

const storageKeys = {
  age: 'vape-shop-age-confirmed',
  products: 'vape-shop-products',
  orders: 'vape-shop-orders',
  delivery: 'vape-shop-delivery-draft',
  deliverySettings: 'vape-shop-delivery-settings',
};

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // LocalStorage can be disabled inside some embedded browsers.
  }
};

const makeOrderId = () => {
  const date = new Date();
  const stamp = date
    .toISOString()
    .slice(2, 10)
    .replaceAll('-', '');
  const suffix = Math.floor(1000 + Math.random() * 9000);

  return `ORD-${stamp}-${suffix}`;
};

const getStockStatus = (stockCount: number): StockStatus => {
  if (stockCount <= 0) {
    return 'out_of_stock';
  }

  if (stockCount <= 5) {
    return 'low_stock';
  }

  return 'in_stock';
};

const normalizeProducts = (items: Product[]): Product[] => {
  return items.map((product) => ({
    ...product,
    isActive: product.isActive ?? true,
    stock: getStockStatus(product.stockCount),
  }));
};

function App() {
  const user = useMemo(() => getTelegramUser(), []);
  const cart = useCartStore((state) => state.items);
  const addCartItem = useCartStore((state) => state.addItem);
  const setCartQuantity = useCartStore((state) => state.setQuantity);
  const removeCartItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(true);
  const [selectedFilterId, setSelectedFilterId] = useState('all');
  const [ageConfirmed, setAgeConfirmed] = useState(() => readStorage(storageKeys.age, false));
  const [products, setProducts] = useState<Product[]>(() =>
    normalizeProducts(readStorage(storageKeys.products, initialProducts)),
  );
  const [orders, setOrders] = useState<Order[]>(() => readStorage(storageKeys.orders, initialOrders));
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [cartWarning, setCartWarning] = useState('');
  const [deliveryDraft, setDeliveryDraft] = useState<CheckoutDraft>(() =>
    readStorage(storageKeys.delivery, {
      name: formatUserName(user),
      address: '',
      comment: '',
    }),
  );
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(() =>
    readStorage(storageKeys.deliverySettings, initialDeliverySettings),
  );

  const isAdmin = isAdminUser(user.id);

  useEffect(() => {
    initTelegramApp();
    const timer = window.setTimeout(() => setLoading(false), 550);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    writeStorage(storageKeys.age, ageConfirmed);
  }, [ageConfirmed]);

  useEffect(() => {
    writeStorage(storageKeys.products, products);
  }, [products]);

  useEffect(() => {
    writeStorage(storageKeys.orders, orders);
  }, [orders]);

  useEffect(() => {
    writeStorage(storageKeys.delivery, deliveryDraft);
  }, [deliveryDraft]);

  useEffect(() => {
    writeStorage(storageKeys.deliverySettings, deliverySettings);
  }, [deliverySettings]);

  useEffect(() => {
    if (!isAdmin && view === 'admin') {
      setView('home');
    }
  }, [isAdmin, view]);

  const filteredProducts = useMemo(() => {
    const selectedFilter = filters.find((filter) => filter.id === selectedFilterId) ?? filters[0];
    const visibleProducts = products.filter((product) => product.isActive);

    if (selectedFilter.mode === 'all') {
      return visibleProducts;
    }

    return visibleProducts.filter((product) => {
      if (selectedFilter.mode === 'brand') {
        return product.brand === selectedFilter.value;
      }

      return product.category === selectedFilter.value;
    });
  }, [products, selectedFilterId]);

  const resolvedCart = useMemo<ResolvedCartItem[]>(() => {
    return cart
      .map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);

        return product ? { product, quantity: item.quantity } : null;
      })
      .filter((item): item is ResolvedCartItem => item !== null);
  }, [cart, products]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const cartTotal = useMemo(() => {
    return resolvedCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [resolvedCart]);

  const userOrders = useMemo(() => {
    return orders
      .filter((order) => order.userId === user.id)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, user.id]);

  const confirmAge = () => {
    setAgeConfirmed(true);
    haptic('success');
  };

  const addToCart = (product: Product) => {
    const added = addCartItem(product);

    if (!added) {
      setCartWarning('Нельзя добавить больше, чем есть на складе.');
      haptic('warning');
      return false;
    }

    setLastOrder(null);
    setCartWarning('');
    haptic('light');
    return true;
  };

  const changeQuantity = (productId: string, nextQuantity: number) => {
    const product = products.find((candidate) => candidate.id === productId);

    if (!product) {
      removeCartItem(productId);
      return;
    }

    const exactQuantityApplied = setCartQuantity(product, nextQuantity);
    setCartWarning(exactQuantityApplied ? '' : `Доступно только ${product.stockCount} шт.`);
  };

  const removeFromCart = (productId: string) => {
    removeCartItem(productId);
    setCartWarning('');
    haptic('light');
  };

  const createProduct = (product: Product) => {
    setProducts((current) => [{ ...product, isActive: product.isActive ?? true, stock: getStockStatus(product.stockCount) }, ...current]);
    haptic('success');
  };

  const updateProduct = (product: Product) => {
    setProducts((current) =>
      current.map((candidate) =>
        candidate.id === product.id ? { ...product, stock: getStockStatus(product.stockCount) } : candidate,
      ),
    );
    haptic('success');
  };

  const deleteProduct = (productId: string) => {
    setProducts((current) => current.filter((product) => product.id !== productId));
    removeCartItem(productId);
    haptic('warning');
  };

  const checkout = async (draft: CheckoutDraft) => {
    const unavailableItem = resolvedCart.find(
      ({ product, quantity }) => !product.isActive || product.stockCount <= 0 || quantity > product.stockCount,
    );

    if (unavailableItem) {
      setCartWarning(
        `${unavailableItem.product.name}: доступно ${Math.max(0, unavailableItem.product.stockCount)} шт.`,
      );
      haptic('warning');
      return false;
    }

    const items = resolvedCart.map(({ product, quantity }) => ({
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      price: product.price,
      quantity,
    }));

    const order: Order = {
      id: makeOrderId(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      status: 'Новый',
      items,
      total: cartTotal,
      delivery: draft,
    };

    try {
      await notifyManagerAboutOrder(order);
    } catch {
      setCartWarning('Не удалось отправить заказ менеджеру. Проверьте подключение и попробуйте ещё раз.');
      haptic('error');
      return false;
    }

    setDeliveryDraft(draft);
    setOrders((current) => [order, ...current]);
    setProducts((current) =>
      current.map((product) => {
        const ordered = resolvedCart.find((item) => item.product.id === product.id);

        if (!ordered) {
          return product;
        }

        const stockCount = Math.max(0, product.stockCount - ordered.quantity);

        return {
          ...product,
          stockCount,
          stock: getStockStatus(stockCount),
        };
      }),
    );
    clearCart();
    setCartWarning('');
    setLastOrder(order);
    haptic('success');
    return true;
  };

  const changeOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
    haptic('light');
  };

  const updateDeliverySettings = (settings: DeliverySettings) => {
    setDeliverySettings(settings);
    haptic('success');
  };

  const renderView = () => {
    if (loading) {
      return (
        <main className="page page--center">
          <div className="loading-state">
            <Loader2 size={34} aria-hidden="true" />
            <span>Загружаем магазин</span>
          </div>
        </main>
      );
    }

    if (view === 'profile') {
      return <ProfilePage user={user} orders={userOrders} isAdmin={isAdmin} />;
    }

    if (view === 'delivery') {
      return <DeliveryPage settings={deliverySettings} />;
    }

    if (view === 'cart') {
      return (
        <CartPage
          items={resolvedCart}
          total={cartTotal}
          draft={deliveryDraft}
          lastOrder={lastOrder}
          warning={cartWarning}
          deliverySettings={deliverySettings}
          onNavigateHome={() => setView('home')}
          onQuantityChange={changeQuantity}
          onRemove={removeFromCart}
          onCheckout={checkout}
        />
      );
    }

    if (view === 'admin' && isAdmin) {
      return (
        <AdminPanel
          products={products}
          orders={orders}
          deliverySettings={deliverySettings}
          onCreateProduct={createProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onStatusChange={changeOrderStatus}
          onUpdateDeliverySettings={updateDeliverySettings}
        />
      );
    }

    return (
      <HomePage
        products={filteredProducts}
        filters={filters}
        activeFilterId={selectedFilterId}
        isAdmin={isAdmin}
        ageConfirmed={ageConfirmed}
        onConfirmAge={confirmAge}
        onFilterChange={setSelectedFilterId}
        onAddToCart={addToCart}
      />
    );
  };

  return (
    <div className="app-shell">
      {renderView()}
      <BottomNav activeView={view} isAdmin={isAdmin} cartCount={cartCount} onNavigate={setView} />
    </div>
  );
}

export default App;
