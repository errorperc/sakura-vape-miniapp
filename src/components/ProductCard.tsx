import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { publicAsset } from '../lib/assets';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
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

export function ProductCard({ product, cartQuantity, onAddToCart }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [flyStyle, setFlyStyle] = useState<CSSProperties | null>(null);
  const [flyKey, setFlyKey] = useState(0);
  const availableCount = Math.max(0, product.stockCount - cartQuantity);
  const soldOutAfterCart = product.stockCount > 0 && availableCount <= 0;
  const stockClassName = getStockClassName({ ...product, stockCount: availableCount });
  const unavailable = !product.isActive || availableCount <= 0;
  const disabled = unavailable || isAdding;
  const stockLabel = soldOutAfterCart ? 'Закончился' : getStockLabel({ ...product, stockCount: availableCount });
  const imageIsLivePhoto = product.image.includes('live-photo');
  const imageIsPhoto = imageIsLivePhoto || product.image.startsWith('data:') || /^https?:\/\//i.test(product.image);
  const buttonLabel = isAdding
    ? '...'
    : added
      ? 'Добавлено'
      : soldOutAfterCart
        ? 'Товар закончился'
        : unavailable
          ? 'Нет в наличии'
          : 'В корзину';

  useEffect(() => {
    if (!added) {
      return;
    }

    const timer = window.setTimeout(() => setAdded(false), 950);
    return () => window.clearTimeout(timer);
  }, [added]);

  const launchCartFly = (event: MouseEvent<HTMLButtonElement>) => {
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const target = document.querySelector<HTMLElement>('[data-cart-target="true"] .bottom-nav__icon');
    const targetRect = target?.getBoundingClientRect();

    if (!targetRect) {
      return;
    }

    setFlyStyle({
      '--fly-start-x': `${buttonRect.left + buttonRect.width / 2}px`,
      '--fly-start-y': `${buttonRect.top + buttonRect.height / 2}px`,
      '--fly-end-x': `${targetRect.left + targetRect.width / 2}px`,
      '--fly-end-y': `${targetRect.top + targetRect.height / 2}px`,
    } as CSSProperties);
    setFlyKey((current) => current + 1);
    window.setTimeout(() => setFlyStyle(null), 860);
  };

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    setIsAdding(true);
    const success = onAddToCart(product);

    if (success) {
      launchCartFly(event);
    }

    window.setTimeout(() => {
      setIsAdding(false);
      setAdded(success);
    }, 220);
  };

  return (
    <article
      className={`product-card product-card--${stockClassName} ${imageIsLivePhoto ? 'product-card--live-photo' : ''}`}
      style={{ '--accent': product.accent } as CSSProperties}
    >
      <div className="product-card__media">
        <span className="product-card__accent" aria-hidden="true" />
        <span className={`product-card__image-shell ${imageIsPhoto ? 'product-card__image-shell--cover' : ''}`}>
          <img src={publicAsset(product.image)} alt={product.name} loading="lazy" />
        </span>
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
          <span className={`stock-pill stock-pill--${stockClassName}`}>{stockLabel}</span>
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
            ) : null}
            {buttonLabel}
          </button>
        </div>
      </div>
      {flyStyle ? (
        <span className="product-card__fly" style={flyStyle} key={flyKey} aria-hidden="true">
          <img src={publicAsset(product.image)} alt="" />
        </span>
      ) : null}
    </article>
  );
}
