import { Home, PackageSearch, ReceiptText, ShoppingBag, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { View } from '../types';
import { segmentStyle } from '../lib/segment';

interface BottomNavProps {
  activeView: View;
  isAdmin: boolean;
  cartCount: number;
  cartTotal: number;
  onNavigate: (view: View) => void;
}

const navItems: Array<{ view: View; label: string; icon: typeof Home }> = [
  { view: 'home', label: 'Каталог', icon: Home },
  { view: 'cart', label: 'Корзина', icon: ShoppingBag },
  { view: 'profile', label: 'Профиль', icon: UserRound },
];

export function BottomNav({ activeView, isAdmin, cartCount, cartTotal, onNavigate }: BottomNavProps) {
  const [catching, setCatching] = useState(0);

  useEffect(() => {
    let timer = 0;
    const onCatch = () => {
      setCatching((current) => current + 1);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCatching(0), 600);
    };
    window.addEventListener('cart:catch', onCatch);
    return () => {
      window.removeEventListener('cart:catch', onCatch);
      window.clearTimeout(timer);
    };
  }, []);

  const items = isAdmin
    ? [
        ...navItems,
        { view: 'orders' as View, label: 'Продажи', icon: ReceiptText },
        { view: 'admin' as View, label: 'Магазин', icon: PackageSearch },
      ]
    : navItems;

  return (
    <nav className="bottom-nav" aria-label="Основная навигация" style={segmentStyle(items.findIndex((item) => item.view === activeView), items.length)}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.view;

        return (
          <button
            className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
            type="button"
            key={item.view}
            onClick={() => onNavigate(item.view)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            data-cart-target={item.view === 'cart' ? 'true' : undefined}
          >
            <span className="bottom-nav__active-glow" aria-hidden="true" />
            <span
              className={`bottom-nav__icon ${item.view === 'cart' && catching ? 'is-catching' : ''}`}
              key={item.view === 'cart' ? `cart-${catching}` : item.view}
            >
              <Icon size={20} strokeWidth={isActive ? 2.6 : 2.1} aria-hidden="true" />
              {item.view === 'cart' && cartCount > 0 ? (
                <span className="bottom-nav__badge" key={cartCount}>{cartCount}</span>
              ) : null}
            </span>
            {/* Когда в корзине что-то есть, вместо подписи — сумма: одна надпись вместо двух */}
            {item.view === 'cart' && cartCount > 0 ? (
              <span className="bottom-nav__label bottom-nav__label--total" key={cartTotal}>
                {cartTotal.toLocaleString('ru-RU')} ₽
              </span>
            ) : (
              <span className="bottom-nav__label">{item.label}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
