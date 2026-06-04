import { PackageOpen, ShieldCheck } from 'lucide-react';
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
}

export function HomePage({
  products,
  filters,
  activeFilterId,
  isAdmin,
  ageConfirmed,
  onConfirmAge,
  onFilterChange,
  onAddToCart,
}: HomePageProps) {
  if (!ageConfirmed) {
    return (
      <main className="page page--center">
        <AgeGate onConfirm={onConfirmAge} />
      </main>
    );
  }

  return (
    <main className="page">
      <div className="catalog-sticky">
        <div className="store-header">
          <div className="store-brand">
            <span className="store-logo" aria-hidden="true">
              <img src={publicAsset('assets/sakura-logo.png')} alt="" />
            </span>
            <div>
              <h1>Sakura Vape</h1>
              <p>Каталог 18+</p>
            </div>
          </div>
          <div className="store-header__meta">
            {isAdmin ? (
              <span className="admin-badge">
                <ShieldCheck size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>Админ</span>
                <i aria-hidden="true" />
              </span>
            ) : null}
            <span className="catalog-count">{products.length} поз.</span>
          </div>
        </div>

        <CategorySlider filters={filters} activeFilterId={activeFilterId} onChange={onFilterChange} />
      </div>

      <div className="section-heading">
        <h2>Ассортимент</h2>
        <span>в наличии</span>
      </div>

      {products.length > 0 ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              product={product}
              onAddToCart={onAddToCart}
              key={product.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<PackageOpen size={32} aria-hidden="true" />}
          title="Ничего не найдено"
          text="Попробуйте выбрать другой бренд или категорию в верхнем фильтре."
        />
      )}
    </main>
  );
}
