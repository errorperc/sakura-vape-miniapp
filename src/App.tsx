import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { BottomNav } from './components/BottomNav';
import { initialCategories, initialDeliverySettings, initialOrders, initialProducts } from './data/mockData';
import {
  createAdminCategory,
  createAdminProduct,
  getAdminCatalog,
  getCatalog,
  removeAdminCategory,
  removeAdminProduct,
  renameAdminCategory,
  updateAdminProduct,
} from './lib/catalogApi';
import { getAddressValidationMessage } from './lib/addressApi';
import {
  createCustomerOrder,
  createManualOrder as createManualOrderRequest,
  getAdminOrders,
  getMyOrders,
  notifyManagerAboutOrder,
  updateAdminOrderStatus,
} from './lib/ordersApi';
import { getDeliverySettings, saveDeliverySettings } from './lib/settingsApi';
import { formatUserName, getTelegramUser, haptic, initTelegramApp, isOwnerUser } from './lib/telegram';
import { getAdminSession } from './lib/teamApi';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { CartPage, type ResolvedCartItem } from './pages/CartPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { useCartStore } from './store/cartStore';
import type {
  AdminSession,
  CatalogCategory,
  CatalogFilter,
  CheckoutDraft,
  DeliverySettings,
  ManualOrderDraft,
  Order,
  OrderStatus,
  Product,
  StockStatus,
  View,
} from './types';

const storageKeys = {
  age: 'vape-shop-age-confirmed',
  delivery: 'vape-shop-delivery-draft',
  deliverySettings: 'vape-shop-delivery-settings',
};

interface CatalogPayload {
  categories: CatalogCategory[];
  products: Product[];
}

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
  const stamp = date.toISOString().slice(2, 10).replaceAll('-', '');
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

const makeCategoryId = (label: string, categories: CatalogCategory[]) => {
  const baseId =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `category-${Date.now()}`;

  return categories.some((category) => category.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
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
  const [products, setProducts] = useState<Product[]>(() => normalizeProducts(initialProducts));
  const [categories, setCategories] = useState<CatalogCategory[]>(initialCategories);
  const [orders, setOrders] = useState<Order[]>(() => (user.isDemo ? initialOrders : []));
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [cartWarning, setCartWarning] = useState('');
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
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

  const isOwner = isOwnerUser(user.id) || adminSession?.isOwner === true;
  const isAdmin = isOwner || adminSession?.isAdmin === true;

  const applyCatalog = (catalog: CatalogPayload) => {
    setCategories(catalog.categories.length > 0 ? catalog.categories : initialCategories);
    setProducts(normalizeProducts(catalog.products));
  };

  const showAdminError = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Не удалось выполнить действие.';
    haptic('error');
    window.alert(message);
  };

  const refreshPublicCatalog = async () => {
    const catalog = await getCatalog();
    applyCatalog(catalog);
  };

  const refreshAdminCatalog = async () => {
    const catalog = await getAdminCatalog();
    applyCatalog(catalog);
  };

  useEffect(() => {
    initTelegramApp();

    let isMounted = true;
    const fallbackTimer = window.setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 900);

    Promise.allSettled([getCatalog(), getDeliverySettings()])
      .then(([catalogResult, deliveryResult]) => {
        if (!isMounted) return;

        if (catalogResult.status === 'fulfilled') {
          applyCatalog(catalogResult.value);
        }

        if (deliveryResult.status === 'fulfilled') {
          setDeliverySettings(deliveryResult.value);
        }
      })
      .finally(() => {
        window.clearTimeout(fallbackTimer);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (user.isDemo) return;

    getAdminSession()
      .then(setAdminSession)
      .catch(() => setAdminSession(null));
  }, [user.isDemo]);

  useEffect(() => {
    if (user.isDemo) return;

    if (isAdmin) {
      Promise.all([getAdminCatalog(), getAdminOrders()])
        .then(([catalog, adminOrders]) => {
          applyCatalog(catalog);
          setOrders(adminOrders);
        })
        .catch(() => undefined);
      return;
    }

    getMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [isAdmin, user.isDemo]);

  useEffect(() => {
    writeStorage(storageKeys.age, ageConfirmed);
  }, [ageConfirmed]);

  useEffect(() => {
    writeStorage(storageKeys.delivery, deliveryDraft);
  }, [deliveryDraft]);

  useEffect(() => {
    writeStorage(storageKeys.deliverySettings, deliverySettings);
  }, [deliverySettings]);

  useEffect(() => {
    if (!isAdmin && (view === 'admin' || view === 'orders')) {
      setView('home');
    }
  }, [isAdmin, view]);

  const catalogFilters = useMemo<CatalogFilter[]>(() => {
    const visibleProducts = products.filter((product) => product.isActive);
    const populatedCategories = categories.filter((category) =>
      visibleProducts.some((product) => product.category === category.id),
    );
    const brands = [...new Set(visibleProducts.map((product) => product.brand.trim()).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right, 'ru'),
    );

    return [
      { id: 'all', label: 'Все', mode: 'all' },
      ...populatedCategories.map((category) => ({
        id: `category-${category.id}`,
        label: category.label,
        mode: 'category' as const,
        value: category.id,
      })),
      ...brands.map((brand) => ({
        id: `brand-${brand.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')}`,
        label: brand,
        mode: 'brand' as const,
        value: brand,
      })),
    ];
  }, [categories, products]);

  useEffect(() => {
    if (!catalogFilters.some((filter) => filter.id === selectedFilterId)) {
      setSelectedFilterId('all');
    }
  }, [catalogFilters, selectedFilterId]);

  const filteredProducts = useMemo(() => {
    const selectedFilter = catalogFilters.find((filter) => filter.id === selectedFilterId) ?? catalogFilters[0];
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
  }, [catalogFilters, products, selectedFilterId]);

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

  const createProduct = async (product: Product) => {
    if (user.isDemo) {
      setProducts((current) => [
        { ...product, isActive: product.isActive ?? true, stock: getStockStatus(product.stockCount) },
        ...current,
      ]);
      haptic('success');
      return;
    }

    try {
      const savedProduct = await createAdminProduct(product);
      setProducts((current) => [savedProduct, ...current.filter((candidate) => candidate.id !== savedProduct.id)]);
      await refreshAdminCatalog();
      haptic('success');
    } catch (error) {
      showAdminError(error);
    }
  };

  const updateProduct = async (product: Product) => {
    if (user.isDemo) {
      setProducts((current) =>
        current.map((candidate) =>
          candidate.id === product.id ? { ...product, stock: getStockStatus(product.stockCount) } : candidate,
        ),
      );
      haptic('success');
      return;
    }

    try {
      const savedProduct = await updateAdminProduct(product);
      setProducts((current) =>
        current.map((candidate) => (candidate.id === savedProduct.id ? savedProduct : candidate)),
      );
      await refreshAdminCatalog();
      haptic('success');
    } catch (error) {
      showAdminError(error);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (user.isDemo) {
      setProducts((current) => current.filter((product) => product.id !== productId));
      removeCartItem(productId);
      haptic('warning');
      return;
    }

    try {
      await removeAdminProduct(productId);
      setProducts((current) => current.filter((product) => product.id !== productId));
      removeCartItem(productId);
      await refreshAdminCatalog();
      haptic('warning');
    } catch (error) {
      showAdminError(error);
      throw error;
    }
  };

  const createCategory = async (label: string) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return;

    if (user.isDemo) {
      setCategories((current) => [...current, { id: makeCategoryId(normalizedLabel, current), label: normalizedLabel }]);
      haptic('success');
      return;
    }

    try {
      const category = await createAdminCategory(normalizedLabel);
      setCategories((current) => [...current, category]);
      await refreshAdminCatalog();
      haptic('success');
    } catch (error) {
      showAdminError(error);
    }
  };

  const renameCategory = async (id: string, label: string) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return;

    if (user.isDemo) {
      setCategories((current) =>
        current.map((category) => (category.id === id ? { ...category, label: normalizedLabel } : category)),
      );
      haptic('light');
      return;
    }

    try {
      const category = await renameAdminCategory(id, normalizedLabel);
      setCategories((current) => current.map((candidate) => (candidate.id === id ? category : candidate)));
      await refreshAdminCatalog();
      haptic('light');
    } catch (error) {
      showAdminError(error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (products.some((product) => product.category === id)) {
      haptic('warning');
      return false;
    }

    if (user.isDemo) {
      setCategories((current) => current.filter((category) => category.id !== id));
      haptic('warning');
      return true;
    }

    try {
      await removeAdminCategory(id);
      setCategories((current) => current.filter((category) => category.id !== id));
      await refreshAdminCatalog();
      haptic('warning');
      return true;
    } catch (error) {
      showAdminError(error);
      return false;
    }
  };

  const updateLocalStockAfterOrder = (items: ResolvedCartItem[]) => {
    setProducts((current) =>
      current.map((product) => {
        const ordered = items.find((item) => item.product.id === product.id);

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
  };

  const checkout = async (draft: CheckoutDraft) => {
    const addressError = getAddressValidationMessage(draft.address);
    if (addressError) {
      setCartWarning(addressError);
      haptic('warning');
      return false;
    }

    const unavailableItem = resolvedCart.find(
      ({ product, quantity }) => !product.isActive || product.stockCount <= 0 || quantity > product.stockCount,
    );

    if (unavailableItem) {
      setCartWarning(`${unavailableItem.product.name}: доступно ${Math.max(0, unavailableItem.product.stockCount)} шт.`);
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

    if (user.isDemo) {
      setDeliveryDraft(draft);
      setOrders((current) => [order, ...current]);
      updateLocalStockAfterOrder(resolvedCart);
      clearCart();
      setCartWarning('');
      setLastOrder(order);
      haptic('success');
      return true;
    }

    try {
      const savedOrder = await createCustomerOrder(order);
      notifyManagerAboutOrder(savedOrder).catch(() => undefined);

      setDeliveryDraft(draft);
      setOrders((current) => [savedOrder, ...current]);
      clearCart();
      setCartWarning('');
      setLastOrder(savedOrder);
      refreshPublicCatalog().catch(() => undefined);
      haptic('success');
      return true;
    } catch {
      setCartWarning('Не удалось оформить заказ. Проверьте подключение и попробуйте еще раз.');
      haptic('error');
      return false;
    }
  };

  const changeOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (user.isDemo) {
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
      haptic('light');
      return;
    }

    try {
      const savedOrder = await updateAdminOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => (order.id === orderId ? savedOrder : order)));
      haptic('light');
    } catch (error) {
      showAdminError(error);
    }
  };

  const createManualOrder = async (draft: ManualOrderDraft) => {
    const product = products.find((candidate) => candidate.id === draft.productId);
    if (!product) return;

    if (user.isDemo) {
      const quantity = Math.max(1, Math.floor(draft.quantity));
      const price = Math.max(0, Math.round(draft.price || product.price));
      const order: Order = {
        id: makeOrderId(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        status: draft.status,
        total: price * quantity,
        delivery: {
          name: draft.customerName.trim() || 'Офлайн покупатель',
          address: draft.address.trim() || 'Офлайн продажа',
          comment: draft.comment.trim(),
        },
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            price,
            quantity,
          },
        ],
      };

      setOrders((current) => [order, ...current]);
      setProducts((current) =>
        current.map((candidate) => {
          if (candidate.id !== product.id) return candidate;
          const stockCount = Math.max(0, candidate.stockCount - quantity);
          return { ...candidate, stockCount, stock: getStockStatus(stockCount) };
        }),
      );
      haptic('success');
      return;
    }

    try {
      const order = await createManualOrderRequest(draft);
      setOrders((current) => [order, ...current]);
      await refreshAdminCatalog();
      haptic('success');
    } catch (error) {
      showAdminError(error);
    }
  };

  const updateDeliverySettings = async (settings: DeliverySettings) => {
    if (user.isDemo) {
      setDeliverySettings(settings);
      haptic('success');
      return;
    }

    try {
      const savedSettings = await saveDeliverySettings(settings);
      setDeliverySettings(savedSettings);
      haptic('success');
    } catch (error) {
      showAdminError(error);
    }
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

    if (view === 'orders' && isAdmin) {
      return (
        <AdminOrdersPage
          orders={orders}
          products={products}
          onStatusChange={changeOrderStatus}
          onCreateManualOrder={createManualOrder}
        />
      );
    }

    if (view === 'admin' && isAdmin) {
      return (
        <AdminPanel
          isOwner={isOwner}
          categories={categories}
          products={products}
          deliverySettings={deliverySettings}
          onCreateProduct={createProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onUpdateDeliverySettings={updateDeliverySettings}
          onCreateCategory={createCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
        />
      );
    }

    return (
      <HomePage
        products={filteredProducts}
        filters={catalogFilters}
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
