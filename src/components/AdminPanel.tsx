import { Bike, Clock3, Edit3, ImagePlus, Link, Plus, Save, Settings2, Store, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { publicAsset } from '../lib/assets';
import type { DeliverySettings, Order, OrderStatus, Product, ProductCategory, StockStatus } from '../types';
import { OrderList } from './OrderList';
import { TeamManagement } from './TeamManagement';

interface AdminPanelProps {
  isOwner: boolean;
  products: Product[];
  orders: Order[];
  deliverySettings: DeliverySettings;
  initialProduct?: Product | null;
  onCreateProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onUpdateDeliverySettings: (settings: DeliverySettings) => void;
}

const categories: Array<{ value: ProductCategory; label: string }> = [
  { value: 'disposable', label: 'Одноразки' },
  { value: 'liquid', label: 'Жидкости' },
  { value: 'pod', label: 'POD-системы' },
  { value: 'cartridge', label: 'Картриджи' },
  { value: 'accessory', label: 'Аксессуары' },
];

const stockStatuses: Array<{ value: StockStatus; label: string }> = [
  { value: 'in_stock', label: 'В наличии' },
  { value: 'low_stock', label: 'Мало' },
  { value: 'out_of_stock', label: 'Нет в наличии' },
];

const makeEmptyProduct = (): Product => ({
  id: `product-${Date.now()}`,
  name: '',
  brand: '',
  category: 'disposable',
  taste: '',
  description: '',
  price: 0,
  stock: 'in_stock',
  stockCount: 1,
  isActive: true,
  image: publicAsset('products/hqd-cuvie-plus.png'),
  accent: '#2481cc',
  nicotine: '20 мг',
});

export function AdminPanel({
  isOwner,
  products,
  orders,
  deliverySettings,
  initialProduct,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onStatusChange,
  onUpdateDeliverySettings,
}: AdminPanelProps) {
  const [draft, setDraft] = useState<Product>(() => makeEmptyProduct());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<DeliverySettings>(deliverySettings);
  const [deliverySaved, setDeliverySaved] = useState(false);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  useEffect(() => {
    if (initialProduct) {
      setDraft(initialProduct);
      setEditingId(initialProduct.id);
    }
  }, [initialProduct]);

  useEffect(() => {
    setDeliveryDraft(deliverySettings);
  }, [deliverySettings]);

  const updateDraft = <K extends keyof Product>(key: K, value: Product[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setDraft(makeEmptyProduct());
    setEditingId(null);
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateDraft('image', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized: Product = {
      ...draft,
      id: editingId ?? draft.id,
      price: Number(draft.price),
      stockCount: Number(draft.stockCount),
      stock: Number(draft.stockCount) === 0 ? 'out_of_stock' : draft.stock,
    };

    if (editingId) {
      onUpdateProduct(normalized);
    } else {
      onCreateProduct({ ...normalized, id: `product-${Date.now()}` });
    }

    resetForm();
  };

  const startEdit = (product: Product) => {
    setDraft(product);
    setEditingId(product.id);
  };

  const updateDeliveryDraft = <K extends keyof DeliverySettings>(key: K, value: DeliverySettings[K]) => {
    setDeliveryDraft((current) => ({ ...current, [key]: value }));
    setDeliverySaved(false);
  };

  const submitDeliverySettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onUpdateDeliverySettings(deliveryDraft);
    setDeliverySaved(true);
  };

  return (
    <main className="page admin-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Admin mode</span>
          <h1>Управление магазином</h1>
        </div>
        <span className="admin-badge">{isOwner ? 'Главный админ' : 'Администратор'}</span>
      </div>

      {isOwner ? <TeamManagement /> : null}

      <form className="admin-form admin-delivery-editor" onSubmit={submitDeliverySettings}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Витрина</span>
            <h2>Настройки доставки</h2>
          </div>
          <span className="admin-delivery-editor__icon" aria-hidden="true">
            <Settings2 size={18} />
          </span>
        </div>

        <label>
          Подпись стоимости
          <input
            required
            value={deliveryDraft.priceLabel}
            onChange={(event) => updateDeliveryDraft('priceLabel', event.target.value)}
            placeholder="Например: от 0 ₽"
          />
        </label>

        <div className="admin-delivery-editor__service">
          <Bike size={19} aria-hidden="true" />
          <label>
            Заголовок
            <input
              required
              value={deliveryDraft.courierTitle}
              onChange={(event) => updateDeliveryDraft('courierTitle', event.target.value)}
            />
          </label>
          <label>
            Описание курьера
            <textarea
              rows={2}
              required
              value={deliveryDraft.courierDescription}
              onChange={(event) => updateDeliveryDraft('courierDescription', event.target.value)}
            />
          </label>
        </div>

        <div className="admin-delivery-editor__service">
          <Store size={19} aria-hidden="true" />
          <label>
            Заголовок
            <input
              required
              value={deliveryDraft.pickupTitle}
              onChange={(event) => updateDeliveryDraft('pickupTitle', event.target.value)}
            />
          </label>
          <label>
            Описание самовывоза
            <textarea
              rows={2}
              required
              value={deliveryDraft.pickupDescription}
              onChange={(event) => updateDeliveryDraft('pickupDescription', event.target.value)}
            />
          </label>
        </div>

        <div className="admin-delivery-editor__compact">
          <Clock3 size={18} aria-hidden="true" />
          <label>
            Заголовок сроков
            <input
              required
              value={deliveryDraft.timeTitle}
              onChange={(event) => updateDeliveryDraft('timeTitle', event.target.value)}
            />
          </label>
          <label>
            Сроки
            <textarea
              rows={3}
              required
              value={deliveryDraft.timeDescription}
              onChange={(event) => updateDeliveryDraft('timeDescription', event.target.value)}
            />
          </label>
        </div>

        <label>
          Основное условие
          <textarea
            rows={3}
            required
            value={deliveryDraft.primaryCondition}
            onChange={(event) => updateDeliveryDraft('primaryCondition', event.target.value)}
          />
        </label>
        <label>
          Дополнительное условие
          <textarea
            rows={3}
            required
            value={deliveryDraft.secondaryCondition}
            onChange={(event) => updateDeliveryDraft('secondaryCondition', event.target.value)}
          />
        </label>

        <button className="button button--primary" type="submit">
          <Save size={18} aria-hidden="true" />
          Сохранить доставку
        </button>
        {deliverySaved ? <p className="form-note">Информация обновлена на странице доставки.</p> : null}
      </form>

      <section className="admin-grid">
        <form className="admin-form" onSubmit={submitProduct}>
          <div className="section-heading">
            <h2>{isEditing ? 'Редактировать товар' : 'Добавить товар'}</h2>
            <button className="button button--ghost button--compact" type="button" onClick={resetForm}>
              <Plus size={16} aria-hidden="true" />
              Новый
            </button>
          </div>

          <label>
            Название
            <input
              required
              value={draft.name}
              onChange={(event) => updateDraft('name', event.target.value)}
              placeholder="Например, BC5000 Ultra"
            />
          </label>
          <div className="form-row">
            <label>
              Бренд
              <input
                required
                value={draft.brand}
                onChange={(event) => updateDraft('brand', event.target.value)}
                placeholder="Elf Bar"
              />
            </label>
            <label>
              Цена
              <input
                min="0"
                required
                type="number"
                value={draft.price}
                onChange={(event) => updateDraft('price', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Категория
              <select
                value={draft.category}
                onChange={(event) => updateDraft('category', event.target.value as ProductCategory)}
              >
                {categories.map((category) => (
                  <option value={category.value} key={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Наличие
              <select
                value={draft.stock}
                onChange={(event) => updateDraft('stock', event.target.value as StockStatus)}
              >
                {stockStatuses.map((status) => (
                  <option value={status.value} key={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Количество
              <input
                min="0"
                type="number"
                value={draft.stockCount}
                onChange={(event) => updateDraft('stockCount', Number(event.target.value))}
              />
            </label>
            <label>
              Никотин
              <input value={draft.nicotine} onChange={(event) => updateDraft('nicotine', event.target.value)} />
            </label>
          </div>

          <label className="switch-row">
            <span>
              Активен на витрине
              <small>Выключенный товар скрыт от покупателей</small>
            </span>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => updateDraft('isActive', event.target.checked)}
            />
          </label>

          <section className="upload-panel" aria-label="Фото товара">
            <div className="upload-preview">
              <img src={publicAsset(draft.image)} alt={draft.name || 'Фото товара'} />
            </div>
            <div className="upload-panel__content">
              <label className="file-upload">
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                <ImagePlus size={18} aria-hidden="true" />
                Загрузить фото
              </label>
              <label>
                Ссылка или data URL
                <div className="input-with-icon">
                  <Link size={16} aria-hidden="true" />
                  <input
                    value={draft.image}
                    onChange={(event) => updateDraft('image', event.target.value)}
                    placeholder="/products/image.png"
                  />
                </div>
              </label>
            </div>
          </section>
          <label>
            Цвет карточки
            <input
              type="color"
              value={draft.accent}
              onChange={(event) => updateDraft('accent', event.target.value)}
            />
          </label>
          <label>
            Вкус
            <input value={draft.taste} onChange={(event) => updateDraft('taste', event.target.value)} />
          </label>
          <label>
            Описание
            <textarea
              rows={3}
              value={draft.description}
              onChange={(event) => updateDraft('description', event.target.value)}
            />
          </label>

          <button className="button button--primary" type="submit">
            <Save size={18} aria-hidden="true" />
            {isEditing ? 'Сохранить изменения' : 'Добавить товар'}
          </button>
        </form>

        <section className="admin-products" aria-labelledby="admin-products-title">
          <div className="section-heading">
            <h2 id="admin-products-title">Товары</h2>
            <span>{products.length}</span>
          </div>
          <div className="admin-products__list">
            {products.map((product) => (
              <article className="admin-product-row" key={product.id}>
                <img src={publicAsset(product.image)} alt="" loading="lazy" />
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {product.brand} · {product.price.toLocaleString('ru-RU')} ₽ · {product.stockCount} шт.
                  </span>
                </div>
                <button className="icon-button" type="button" onClick={() => startEdit(product)} title="Редактировать">
                  <Edit3 size={16} aria-hidden="true" />
                </button>
                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  onClick={() => onDeleteProduct(product.id)}
                  title="Удалить"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <OrderList orders={orders} title="Заказы клиентов" editable onStatusChange={onStatusChange} />
    </main>
  );
}
