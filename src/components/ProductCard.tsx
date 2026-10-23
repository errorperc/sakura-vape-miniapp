import { Check, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { publicAsset } from '../lib/assets';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  onAddToCart: (product: Product) => boolean;
  onOpen: (product: Product) => void;
}

export const getStockClassName = (stockCount: number) => {
  if (stockCount <= 0) return 'out_of_stock';
  if (stockCount <= 5) return 'low_stock';
  return 'in_stock';
};

export const getStockLabel = (stockCount: number, inCart: number) => {
  if (stockCount <= 0) return inCart > 0 ? 'Всё в корзине' : 'Нет в наличии';
  if (stockCount <= 5) return `Осталось ${stockCount} шт`;
  return '';
};

// Полёт миниатюры товара к иконке корзины в нижнем меню
export const useCartFly = () => {
  const [flyStyle, setFlyStyle] = useState<CSSProperties | null>(null);
  const [flyKey, setFlyKey] = useState(0);

  const launch = (event: MouseEvent<HTMLElement>) => {
    const from = event.currentTarget.getBoundingClientRect();
    const target = document.querySelector<HTMLElement>('[data-cart-target="true"] .bottom-nav__icon')?.getBoundingClientRect();
    if (!target) return;

    setFlyStyle({
      '--fly-start-x': `${from.left + from.width / 2}px`,
      '--fly-start-y': `${from.top + from.height / 2}px`,
      '--fly-end-x': `${target.left + target.width / 2}px`,
      '--fly-end-y': `${target.top + target.height / 2}px`,
    } as CSSProperties);
    setFlyKey((current) => current + 1);
    window.setTimeout(() => setFlyStyle(null), 780);
  };

  return { flyStyle, flyKey, launch };
};

export function ProductCard({ product, cartQuantity, onAddToCart, onOpen }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const { flyStyle, flyKey, launch } = useCartFly();
  const availableCount = Math.max(0, product.stockCount - cartQuantity);
  const unavailable = !product.isActive || availableCount <= 0;
  const stockLabel = getStockLabel(availableCount, cartQuantity);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 900);
    return () => window.clearTimeout(timer);
  }, [added]);

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onAddToCart(product)) {
      launch(event);
      setAdded(true);
    }
  };

  return (
    <article
      className={`product-card product-card--${getStockClassName(availableCount)}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(event) => event.key === 'Enter' && onOpen(product)}
      aria-label={`${product.brand} ${product.name}`}
    >
      <div className="product-card__media">
        <img src={publicAsset(product.image)} alt="" loading="lazy" decoding="async" />
        {stockLabel ? <span className="product-card__stock">{stockLabel}</span> : null}
      </div>

      <div className="product-card__body">
        <span className="product-card__brand">{product.brand}</span>
        <h3>{product.name}</h3>
        <div className="product-card__footer">
          <strong>{product.price.toLocaleString('ru-RU')} ₽</strong>
          <button
            className={`product-card__add ${added ? 'product-card__add--added' : ''}`}
            type="button"
            disabled={unavailable}
            onClick={handleAdd}
            aria-label={`Добавить ${product.name} в корзину`}
          >
            {added ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : <Plus size={18} strokeWidth={2.75} aria-hidden="true" />}
            {cartQuantity > 0 ? <em>{cartQuantity}</em> : null}
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
