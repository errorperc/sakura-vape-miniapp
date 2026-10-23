import { ChevronRight, ShoppingBag } from 'lucide-react';

interface CartBarProps {
  count: number;
  total: number;
  onOpen: () => void;
}

// Плашка над нижним меню: сколько в корзине и на какую сумму, один тап — к оформлению
export function CartBar({ count, total, onOpen }: CartBarProps) {
  return (
    <button className="cart-bar" type="button" onClick={onOpen}>
      <span className="cart-bar__icon" aria-hidden="true">
        <ShoppingBag size={18} />
      </span>
      <span className="cart-bar__text">
        Корзина <em>· {count} шт</em>
      </span>
      <strong key={total}>{total.toLocaleString('ru-RU')} ₽</strong>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
