import { PackageOpen, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  onChangeQuantity: (productId: string, quantity: number) => void;
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
  onChangeQuantity,
  onOpenProduct,
  getCartQuantity,
}: HomePageProps) {
  const [query, setQuery] = useState('');
  // Панель поиска «прилипла» к верху: тогда у неё появляется плотный фон и тень
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [ageConfirmed]);

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
      <header className="catalog-title">
        <img className="catalog-title__logo" src={publicAsset('assets/sakura-logo.webp')} alt="Sakura Vape" />
        <div className="catalog-title__text">
          <h1>Каталог</h1>
          <small>Sakura Vape · доставка по городу</small>
        </div>
        {isAdmin ? (
          <span className="admin-badge">
            <ShieldCheck size={13} strokeWidth={2.5} aria-hidden="true" />
            Админ
          </span>
        ) : null}
      </header>

      <div className="sticky-sentinel" ref={sentinelRef} aria-hidden="true" />
      <div className={`catalog-sticky ${stuck ? 'is-stuck' : ''}`}>
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
              onChangeQuantity={onChangeQuantity}
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
