import { Check, LoaderCircle, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { publicAsset } from '../lib/assets';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => boolean;
}

const getStockLabel = (product: Product) => {
  if (product.stockCount <= 0) {
    return 'Нет в наличии';
  }

  if (product.stockCount <= 5) {
    return `Осталось ${product.stockCount} шт`;
  }

  return 'В наличии';
};

const getStockClassName = (product: Product) => {
  if (product.stockCount <= 0) {
    return 'out_of_stock';
  }

  if (product.stockCount <= 5) {
    return 'low_stock';
  }

  return 'in_stock';
};

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const stockClassName = getStockClassName(product);
  const disabled = !product.isActive || product.stockCount <= 0 || isAdding;

  useEffect(() => {
    if (!added) {
      return;
    }

    const timer = window.setTimeout(() => setAdded(false), 950);
    return () => window.clearTimeout(timer);
  }, [added]);

  const handleAdd = () => {
    setIsAdding(true);
    const success = onAddToCart(product);

    window.setTimeout(() => {
      setIsAdding(false);
      setAdded(success);
    }, 220);
  };

  return (
    <article className={`product-card product-card--${stockClassName}`}>
      <div className="product-card__media" style={{ '--accent': product.accent } as CSSProperties}>
        <span className="product-card__accent" aria-hidden="true" />
        <img src={publicAsset(product.image)} alt={product.name} loading="lazy" />
        <span className={`stock-pill stock-pill--${stockClassName}`}>{getStockLabel(product)}</span>
      </div>

      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.brand}</span>
          <span>{product.nicotine}</span>
        </div>
        <h3>{product.name}</h3>
        <p className="product-card__taste">{product.taste}</p>
        <p className="product-card__description">{product.description}</p>
      </div>

      <div className="product-card__footer">
        <div className="product-card__price">
          <strong>{product.price.toLocaleString('ru-RU')} ₽</strong>
          <small>{product.stockCount} шт.</small>
        </div>
        <div className="product-card__actions">
          <button
            className={`button product-card__cart ${added ? 'product-card__cart--added' : ''}`}
            type="button"
            disabled={disabled}
            onClick={handleAdd}
          >
            {isAdding ? (
              <LoaderCircle className="product-card__cart-loader" size={16} aria-hidden="true" />
            ) : added ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            {isAdding ? '...' : added ? 'Добавлено' : product.stockCount <= 0 ? 'Нет' : 'Добавить'}
          </button>
        </div>
      </div>
    </article>
  );
}
