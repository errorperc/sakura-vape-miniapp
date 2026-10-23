import { Check, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { thumbAsset } from '../lib/assets';
import { ProductImage } from './ProductImage';
import type { CatalogCategory, Product } from '../types';
import { getStockLabel, useCartFly } from './ProductCard';

interface ProductSheetProps {
  product: Product;
  categories: CatalogCategory[];
  cartQuantity: number;
  onAddToCart: (product: Product) => boolean;
  onClose: () => void;
}

export function ProductSheet({ product, categories, cartQuantity, onAddToCart, onClose }: ProductSheetProps) {
  const [added, setAdded] = useState(false);
  const { flyStyle, flyKey, launch } = useCartFly();
  const availableCount = Math.max(0, product.stockCount - cartQuantity);
  const unavailable = !product.isActive || availableCount <= 0;
  const category = categories.find((candidate) => candidate.id === product.category)?.label;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 900);
    return () => window.clearTimeout(timer);
  }, [added]);

  const specs = [
    ['Вкус', product.taste],
    ['Никотин', product.nicotine],
    ['Категория', category],
    ['В наличии', availableCount > 0 ? `${availableCount} шт.` : getStockLabel(availableCount, cartQuantity)],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={product.name} onClick={(event) => event.stopPropagation()}>
        <span className="sheet__grabber" aria-hidden="true" />
        <button className="icon-button sheet__close" type="button" onClick={onClose} aria-label="Закрыть">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="sheet__media">
          <ProductImage src={product.image} width={900} alt={product.name} eager />
        </div>
        <div className="sheet__body">
          <div className="sheet__title">
            <span>{product.brand}</span>
            <h2>{product.name}</h2>
          </div>
          {product.description ? <p>{product.description}</p> : null}
          <div className="sheet__specs">
            {specs.map(([label, value]) => (
              <div className="list-row" key={label}>
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <div className="sheet__buy">
            <strong>{product.price.toLocaleString('ru-RU')} ₽</strong>
            <button
              className="button button--primary"
              type="button"
              disabled={unavailable}
              onClick={(event) => {
                if (onAddToCart(product)) {
                  launch(event);
                  setAdded(true);
                }
              }}
            >
              {added ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              {unavailable ? 'Нет в наличии' : cartQuantity > 0 ? `В корзине: ${cartQuantity}` : 'В корзину'}
            </button>
          </div>
        </div>
      </section>
      {flyStyle ? (
        <span className="product-card__fly" style={flyStyle} key={flyKey} aria-hidden="true">
          <img src={thumbAsset(product.image, 160)} alt="" />
        </span>
      ) : null}
    </div>
  );
}
