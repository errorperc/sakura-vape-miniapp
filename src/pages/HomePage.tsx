import { PackageOpen, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { AgeGate } from '../components/AgeGate';
import { CategorySlider } from '../components/CategorySlider';
import { EmptyState } from '../components/EmptyState';
import { ProductCard } from '../components/ProductCard';
import { publicAsset } from '../lib/assets';
import type { CatalogFilter, Product } from '../types';

interface HomePageProps {
  products: Product[];
  filters: CatalogFilter[];
  activeFilterId: string;
  isAdmin: boolean;
  ageConfirmed: boolean;
  onConfirmAge: () => void;
  onFilterChange: (filterId: string) => void;
  onAddToCart: (product: Product) => boolean;
  onOpenProduct: (product: Product) => void;
  getCartQuantity: (productId: string) => number;
}

const matchesQuery = (product: Product, query: string) =>
  `${product.brand} ${product.name} ${product.taste}`.toLowerCase().includes(query);

export function HomePage({
  products,
  filters,
  activeFilterId,
  isAdmin,
  ageConfirmed,
  onConfirmAge,
  onFilterChange,
  onAddToCart,
  onOpenProduct,
  getCartQuantity,
}: HomePageProps) {
  const [query, setQuery] = useState('');

  if (!ageConfirmed) {
    return (
      <main className="page page--center">
        <AgeGate onConfirm={onConfirmAge} />
      </main>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = normalizedQuery ? products.filter((product) => matchesQuery(product, normalizedQuery)) : products;

  return (
    <main className="page">
      <div className="store-header">
        <div className="store-brand">
          <span className="store-logo" aria-hidden="true">
            <img src={publicAsset('assets/sakura-logo.webp')} alt="" />
          </span>
          <div>
            <strong>Sakura Vape</strong>
            <small>Доставка по городу · 18+</small>
          </div>
        </div>
        {isAdmin ? (
          <span className="admin-badge">
            <ShieldCheck size={13} strokeWidth={2.5} aria-hidden="true" />
            Админ
          </span>
        ) : null}
      </div>

      <header className="large-title">
        <h1>Каталог</h1>
      </header>

      <div className="catalog-sticky">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по бренду или вкусу"
            aria-label="Поиск товаров"
          />
        </label>
        <CategorySlider filters={filters} activeFilterId={activeFilterId} onChange={onFilterChange} />
      </div>

      <div className="section-heading">
        <h2>{normalizedQuery ? 'Результаты' : 'Все товары'}</h2>
        <span>{visibleProducts.length} поз.</span>
      </div>

      {visibleProducts.length > 0 ? (
        // Смена бренда или категории пересобирает сетку — карточки появляются каскадом, без резкой подмены
        <div className="product-grid" key={activeFilterId}>
          {visibleProducts.map((product, index) => (
            <ProductCard
              product={product}
              cartQuantity={getCartQuantity(product.id)}
              onAddToCart={onAddToCart}
              onOpen={onOpenProduct}
              eager={index < 4}
              index={index}
              key={product.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<PackageOpen size={32} aria-hidden="true" />}
          title="Ничего не найдено"
          text="Попробуйте другой запрос или категорию."
        />
      )}
    </main>
  );
}
