import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { AnimationEvent, CSSProperties, MouseEvent } from 'react';
import { thumbAsset } from '../lib/assets';
import { ProductImage } from './ProductImage';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  onAddToCart: (product: Product) => boolean;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onOpen: (product: Product) => void;
  eager?: boolean;
  index?: number;
}

export const getStockClassName = (stockCount: number) => {
  if (stockCount <= 0) return 'out_of_stock';
  if (stockCount <= 5) return 'low_stock';
  return 'in_stock';
};

export const getStockLabel = (stockCount: number, inCart: number) => {
  if (stockCount <= 0) return inCart > 0 ? 'Вы взяли все' : 'Нет в наличии';
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
    window.setTimeout(() => setFlyStyle(null), 900);
  };

  // Товар долетел — нижнее меню «ловит» его иконкой корзины
  const onFlyEnd = (event: AnimationEvent<HTMLElement>) => {
    if (event.animationName === 'fly-y') window.dispatchEvent(new Event('cart:catch'));
  };

  // Летящая миниатюра рендерится в body: внутри карточки её обрезал бы overflow,
  // а backdrop-filter сместил бы position: fixed
  const renderFly = (image: string) =>
    flyStyle
      ? createPortal(
          <span className="product-card__fly" style={flyStyle} key={flyKey} aria-hidden="true">
            <img src={thumbAsset(image, 160)} alt="" onAnimationEnd={onFlyEnd} />
          </span>,
          document.body,
        )
      : null;

  return { launch, renderFly };
};

export function ProductCard({ product, cartQuantity, onAddToCart, onChangeQuantity, onOpen, eager = false, index = 0 }: ProductCardProps) {
  const { launch, renderFly } = useCartFly();
  const availableCount = Math.max(0, product.stockCount - cartQuantity);
  const inCart = cartQuantity > 0;
  const unavailable = !product.isActive || (availableCount <= 0 && !inCart);
  const stockLabel = getStockLabel(availableCount, cartQuantity);

  const add = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onAddToCart(product)) launch(event);
  };

  const remove = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChangeQuantity(product.id, cartQuantity - 1);
  };

  return (
    <article
      className={`product-card product-card--${getStockClassName(availableCount)}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(event) => event.key === 'Enter' && event.target === event.currentTarget && onOpen(product)}
      aria-label={`${product.brand} ${product.name}`}
      style={{ '--i': Math.min(index, 8) } as CSSProperties}
    >
      <div className="product-card__media">
        <ProductImage src={product.image} width={480} eager={eager} />
        {stockLabel ? <span className="product-card__stock">{stockLabel}</span> : null}
      </div>

      <div className="product-card__body">
        <span className="product-card__brand">{product.brand}</span>
        <h3>{product.name}</h3>
        {product.taste ? <span className="product-card__taste">{product.taste}</span> : null}
        <strong className="product-card__price">{product.price.toLocaleString('ru-RU')} ₽</strong>

        {/* Одна кнопка, которая превращается в счётчик: «+ В корзину» → «− 2 шт +» */}
        <div className={`cart-control ${inCart ? 'is-active' : ''}`} onClick={(event) => event.stopPropagation()}>
          <button className="cart-control__side" type="button" onClick={remove} tabIndex={inCart ? 0 : -1} aria-label="Убрать одну штуку">
            <Minus size={16} strokeWidth={2.75} aria-hidden="true" />
          </button>
          {inCart ? (
            <span className="cart-control__count" aria-live="polite" key={cartQuantity}>
              {cartQuantity} шт
            </span>
          ) : (
            <button className="cart-control__main" type="button" onClick={add} disabled={unavailable}>
              {unavailable ? (
                'Нет в наличии'
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.75} aria-hidden="true" /> В корзину
                </>
              )}
            </button>
          )}
          <button
            className="cart-control__side"
            type="button"
            onClick={add}
            disabled={availableCount <= 0}
            tabIndex={inCart ? 0 : -1}
            aria-label="Добавить ещё одну"
          >
            <Plus size={16} strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {renderFly(product.image)}
    </article>
  );
}
