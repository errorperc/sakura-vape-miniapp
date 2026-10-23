import { Home, PackageSearch, ReceiptText, ShoppingBag, UserRound } from 'lucide-react';
import type { View } from '../types';
import { segmentStyle } from '../lib/segment';

interface BottomNavProps {
  activeView: View;
  isAdmin: boolean;
  cartCount: number;
  onNavigate: (view: View) => void;
}

const navItems: Array<{ view: View; label: string; icon: typeof Home }> = [
  { view: 'home', label: 'Каталог', icon: Home },
  { view: 'cart', label: 'Корзина', icon: ShoppingBag },
  { view: 'profile', label: 'Профиль', icon: UserRound },
];

export function BottomNav({ activeView, isAdmin, cartCount, onNavigate }: BottomNavProps) {
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
            <span className="bottom-nav__icon">
              <Icon size={20} strokeWidth={isActive ? 2.6 : 2.1} aria-hidden="true" />
              {item.view === 'cart' && cartCount > 0 ? (
                <span className="bottom-nav__badge" key={cartCount}>{cartCount}</span>
              ) : null}
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
