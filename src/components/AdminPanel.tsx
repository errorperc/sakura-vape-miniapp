import {
  Bike,
  Clock3,
  Edit3,
  ImagePlus,
  Link,
  PackageSearch,
  Plus,
  Save,
  Settings2,
  Store,
  Tags,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { publicAsset } from '../lib/assets';
import type { CatalogCategory, DeliverySettings, Product, ProductCategory } from '../types';
import { CategoryManagement } from './CategoryManagement';
import { TeamManagement } from './TeamManagement';

type AdminTab = 'catalog' | 'settings' | 'team';
type CatalogSection = 'products' | 'categories';
const uploadImageMaxSize = 1200;
const uploadImageQuality = 0.84;

interface AdminPanelProps {
  isOwner: boolean;
  categories: CatalogCategory[];
  products: Product[];
  deliverySettings: DeliverySettings;
  onCreateProduct: (product: Product) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onUpdateDeliverySettings: (settings: DeliverySettings) => Promise<void>;
  onCreateCategory: (label: string) => Promise<void>;
  onRenameCategory: (id: string, label: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<boolean>;
}

const makeEmptyProduct = (categories: CatalogCategory[]): Product => ({
  id: `product-${Date.now()}`,
  name: '',
  brand: '',
  category: categories[0]?.id ?? 'uncategorized',
  taste: '',
  description: '',
  price: 0,
  stock: 'in_stock',
  stockCount: 1,
  isActive: true,
  image: 'products/hqd-cuvie-plus.png',
  accent: '#f52b88',
  nicotine: '20 мг',
});

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Image read failed.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Image read failed.'));
    reader.readAsDataURL(file);
  });

const convertFileToWebpDataUrl = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, uploadImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');

    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/webp', uploadImageQuality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export function AdminPanel({
  isOwner,
  categories,
  products,
  deliverySettings,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateDeliverySettings,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  const [catalogSection, setCatalogSection] = useState<CatalogSection>('products');
  const [draft, setDraft] = useState<Product>(() => makeEmptyProduct(categories));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProductEditorOpen, setIsProductEditorOpen] = useState(false);
  const [deliveryDraft, setDeliveryDraft] = useState<DeliverySettings>(deliverySettings);
  const [deliverySaved, setDeliverySaved] = useState(false);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);
  const visibleProducts = useMemo(() => products, [products]);
  const tabs = useMemo(
    () => [
      { id: 'catalog' as const, label: 'Каталог', icon: PackageSearch },
      { id: 'settings' as const, label: 'Доставка', icon: Settings2 },
      ...(isOwner ? [{ id: 'team' as const, label: 'Команда', icon: UsersRound }] : []),
    ],
    [isOwner],
  );

  useEffect(() => {
    setDeliveryDraft(deliverySettings);
  }, [deliverySettings]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((category) => category.id === draft.category)) {
      setDraft((current) => ({ ...current, category: categories[0].id }));
    }
  }, [categories, draft.category]);

  const updateDraft = <K extends keyof Product>(key: K, value: Product[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setDraft(makeEmptyProduct(categories));
    setEditingId(null);
    setIsProductEditorOpen(false);
  };

  const focusProductEditor = () => {
    window.setTimeout(() => {
      document.querySelector('.admin-product-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 80);
  };

  const openNewProduct = () => {
    setDraft(makeEmptyProduct(categories));
    setEditingId(null);
    setIsProductEditorOpen(true);
    focusProductEditor();
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      updateDraft('image', await convertFileToWebpDataUrl(file));
    } catch {
      updateDraft('image', await readFileAsDataUrl(file));
    }
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const stockCount = Math.max(0, Number(draft.stockCount));
    const normalized: Product = {
      ...draft,
      id: editingId ?? `product-${Date.now()}`,
      price: Math.max(0, Number(draft.price)),
      stockCount,
      stock: stockCount === 0 ? 'out_of_stock' : stockCount <= 5 ? 'low_stock' : 'in_stock',
    };

    if (editingId) await onUpdateProduct(normalized);
    else await onCreateProduct(normalized);
    resetForm();
  };

  const startEdit = (product: Product) => {
    setDraft(product);
    setEditingId(product.id);
    setIsProductEditorOpen(true);
    focusProductEditor();
  };

  const submitDeliverySettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await onUpdateDeliverySettings(deliveryDraft);
      setDeliverySaved(true);
    } catch {
      setDeliverySaved(false);
    }
  };

  return (
    <main className="page admin-page">
      <div className="page-header admin-page__header">
        <div>
          <span className="eyebrow">Управление</span>
          <h1>Панель магазина</h1>
        </div>
        <span className="admin-badge">{isOwner ? 'Главный админ' : 'Администратор'}</span>
      </div>

      <nav className="admin-tabs" aria-label="Разделы админ-панели">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={activeTab === tab.id ? 'is-active' : ''}
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="admin-tab-content" key={activeTab}>
        {activeTab === 'catalog' ? (
          <>
            <div className="admin-catalog-switch" role="tablist" aria-label="Управление каталогом">
              <button
                className={catalogSection === 'products' ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={catalogSection === 'products'}
                onClick={() => setCatalogSection('products')}
              >
                <PackageSearch size={16} aria-hidden="true" />
                Товары
                <em>{visibleProducts.length}</em>
              </button>
              <button
                className={catalogSection === 'categories' ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={catalogSection === 'categories'}
                onClick={() => setCatalogSection('categories')}
              >
                <Tags size={16} aria-hidden="true" />
                Категории
                <em>{categories.length}</em>
              </button>
            </div>

            {catalogSection === 'categories' ? (
              <CategoryManagement
                categories={categories}
                products={visibleProducts}
                onCreate={onCreateCategory}
                onRename={onRenameCategory}
                onDelete={onDeleteCategory}
              />
            ) : null}

            {catalogSection === 'products' ? (
              <>
                {isProductEditorOpen ? (
                  <form className="admin-form admin-product-editor" onSubmit={submitProduct}>
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">{isEditing ? 'Редактирование' : 'Новая позиция'}</span>
                        <h2>{isEditing ? draft.name : 'Добавить товар'}</h2>
                      </div>
                      <button className="icon-button" type="button" onClick={resetForm} title="Закрыть форму">
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>

                    <label>
                      Название
                      <input required value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
                    </label>
                    <div className="form-row">
                      <label>
                        Бренд
                        <input required value={draft.brand} onChange={(event) => updateDraft('brand', event.target.value)} />
                      </label>
                      <label>
                        Цена
                        <input min="0" required type="number" value={draft.price} onChange={(event) => updateDraft('price', Number(event.target.value))} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Категория
                        <select value={draft.category} onChange={(event) => updateDraft('category', event.target.value as ProductCategory)}>
                          {categories.map((category) => (
                            <option value={category.id} key={category.id}>{category.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Остаток
                        <input min="0" type="number" value={draft.stockCount} onChange={(event) => updateDraft('stockCount', Number(event.target.value))} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Вкус
                        <input value={draft.taste} onChange={(event) => updateDraft('taste', event.target.value)} />
                      </label>
                      <label>
                        Никотин
                        <input value={draft.nicotine} onChange={(event) => updateDraft('nicotine', event.target.value)} />
                      </label>
                    </div>
                    <label>
                      Описание
                      <textarea rows={3} value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} />
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
                            <input value={draft.image} onChange={(event) => updateDraft('image', event.target.value)} />
                          </div>
                        </label>
                      </div>
                    </section>

                    <label className="switch-row">
                      <span>Показывать на витрине<small>Скрытые товары не видны покупателям</small></span>
                      <input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} />
                    </label>
                    <button className="button button--primary" type="submit">
                      <Save size={18} aria-hidden="true" />
                      {isEditing ? 'Сохранить изменения' : 'Добавить товар'}
                    </button>
                  </form>
                ) : null}

                <section className="admin-products" aria-labelledby="admin-products-title">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Ассортимент</span>
                      <h2 id="admin-products-title">Товары</h2>
                    </div>
                    <button className="button button--primary button--compact" type="button" onClick={openNewProduct}>
                      <Plus size={16} aria-hidden="true" />
                      Добавить
                    </button>
                  </div>
                  <div className="admin-products__list">
                    {visibleProducts.map((product) => (
                      <article className="admin-product-row" key={product.id}>
                        <img src={publicAsset(product.image)} alt="" loading="lazy" />
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.brand} · {product.price.toLocaleString('ru-RU')} ₽ · {product.stockCount} шт.</span>
                        </div>
                        <button className="icon-button" type="button" onClick={() => startEdit(product)} title="Редактировать">
                          <Edit3 size={16} aria-hidden="true" />
                        </button>
                        <button className="icon-button icon-button--danger" type="button" onClick={() => onDeleteProduct(product.id)} title="Удалить">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : null}

        {activeTab === 'settings' ? (
          <form className="admin-form admin-delivery-editor" onSubmit={submitDeliverySettings}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Витрина</span>
                <h2>Настройки доставки</h2>
              </div>
              <span className="admin-delivery-editor__icon"><Settings2 size={18} aria-hidden="true" /></span>
            </div>
            <label>
              Подпись стоимости
              <input required value={deliveryDraft.priceLabel} onChange={(event) => setDeliveryDraft((current) => ({ ...current, priceLabel: event.target.value }))} />
            </label>
            <div className="admin-delivery-editor__service">
              <Bike size={19} aria-hidden="true" />
              <label>Заголовок<input required value={deliveryDraft.courierTitle} onChange={(event) => setDeliveryDraft((current) => ({ ...current, courierTitle: event.target.value }))} /></label>
              <label>Описание курьера<textarea rows={2} required value={deliveryDraft.courierDescription} onChange={(event) => setDeliveryDraft((current) => ({ ...current, courierDescription: event.target.value }))} /></label>
            </div>
            <div className="admin-delivery-editor__service">
              <Store size={19} aria-hidden="true" />
              <label>Заголовок<input required value={deliveryDraft.pickupTitle} onChange={(event) => setDeliveryDraft((current) => ({ ...current, pickupTitle: event.target.value }))} /></label>
              <label>Описание самовывоза<textarea rows={2} required value={deliveryDraft.pickupDescription} onChange={(event) => setDeliveryDraft((current) => ({ ...current, pickupDescription: event.target.value }))} /></label>
            </div>
            <div className="admin-delivery-editor__compact">
              <Clock3 size={18} aria-hidden="true" />
              <label>Заголовок сроков<input required value={deliveryDraft.timeTitle} onChange={(event) => setDeliveryDraft((current) => ({ ...current, timeTitle: event.target.value }))} /></label>
              <label>Сроки<textarea rows={2} required value={deliveryDraft.timeDescription} onChange={(event) => setDeliveryDraft((current) => ({ ...current, timeDescription: event.target.value }))} /></label>
            </div>
            <label>Основное условие<textarea rows={3} required value={deliveryDraft.primaryCondition} onChange={(event) => setDeliveryDraft((current) => ({ ...current, primaryCondition: event.target.value }))} /></label>
            <label>Дополнительное условие<textarea rows={3} required value={deliveryDraft.secondaryCondition} onChange={(event) => setDeliveryDraft((current) => ({ ...current, secondaryCondition: event.target.value }))} /></label>
            <button className="button button--primary" type="submit"><Save size={18} aria-hidden="true" />Сохранить доставку</button>
            {deliverySaved ? <p className="form-note">Информация на странице доставки обновлена.</p> : null}
          </form>
        ) : null}

        {activeTab === 'team' && isOwner ? <TeamManagement /> : null}
      </div>
    </main>
  );
}
