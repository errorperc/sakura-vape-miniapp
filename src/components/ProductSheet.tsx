import { Check, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
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
  const { launch, renderFly } = useCartFly();
  const availableCount = Math.max(0, product.stockCount - cartQuantity);
  const unavailable = !product.isActive || availableCount <= 0;
  const category = categories.find((candidate) => candidate.id === product.category)?.label;
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Фокус внутрь шторки при открытии — для клавиатуры и экранного диктора
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  const drag = useRef<{ startY: number; startTime: number; dy: number } | null>(null);

  // Закрытие с анимацией: шторка уезжает вниз, и только потом убираем её из дерева
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 380);
  };

  // Свайп вниз по фото: шторка идёт за пальцем, отпустили дальше порога — закрываем
  const onDragStart = (event: PointerEvent<HTMLElement>) => {
    if ((sheetRef.current?.scrollTop ?? 0) > 0) return;
    drag.current = { startY: event.clientY, startTime: performance.now(), dy: 0 };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Без захвата указателя свайп всё равно работает, пока палец над фото
    }
    sheetRef.current?.classList.add('is-dragging');
    sheetRef.current?.classList.remove('is-settling');
  };

  const onDragMove = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const sheet = sheetRef.current;
    if (!state || !sheet) return;
    const raw = event.clientY - state.startY;
    // Вверх тянется туго, вниз — свободно
    state.dy = raw > 0 ? raw : raw / 6;
    sheet.style.transform = `translateY(${state.dy}px)`;
  };

  const onDragEnd = () => {
    const state = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!state || !sheet) return;
    sheet.classList.remove('is-dragging');
    const velocity = state.dy / Math.max(1, performance.now() - state.startTime);
    if (state.dy > 120 || (state.dy > 30 && velocity > 0.6)) {
      requestClose();
      return;
    }
    sheet.classList.add('is-settling');
    sheet.style.transform = '';
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1100);
    return () => window.clearTimeout(timer);
  }, [added]);

  const specs = [
    ['Вкус', product.taste],
    ['Никотин', product.nicotine],
    ['Категория', category],
    ['В наличии', availableCount > 0 ? `${availableCount} шт.` : getStockLabel(availableCount, cartQuantity)],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className={`sheet-backdrop ${closing ? 'is-closing' : ''}`} onClick={requestClose}>
      <section className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={product.name} onClick={(event) => event.stopPropagation()}>
        <span className="sheet__grabber" aria-hidden="true" />
        <button className="icon-button sheet__close" type="button" onClick={requestClose} aria-label="Закрыть" ref={closeRef}>
          <X size={18} aria-hidden="true" />
        </button>
        <div
          className="sheet__media"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          {/* Сразу — фото из карточки (оно уже в кэше), чёткое большое проявляется поверх, когда догрузится */}
          <ProductImage src={product.image} width={480} priority />
          <div className="sheet__media-hi">
            <ProductImage src={product.image} width={900} alt={product.name} eager />
          </div>
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
      {renderFly(product.image)}
    </div>
  );
}
