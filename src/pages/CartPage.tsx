import {
  CheckCircle2,
  MapPin,
  MessageSquareText,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { publicAsset } from '../lib/assets';
import type { CheckoutDraft, DeliverySettings, Order, Product } from '../types';

export interface ResolvedCartItem {
  product: Product;
  quantity: number;
}

interface CartPageProps {
  items: ResolvedCartItem[];
  total: number;
  draft: CheckoutDraft;
  lastOrder: Order | null;
  warning: string;
  deliverySettings: DeliverySettings;
  onNavigateHome: () => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: (draft: CheckoutDraft) => void;
}

export function CartPage({
  items,
  total,
  draft,
  lastOrder,
  warning,
  deliverySettings,
  onNavigateHome,
  onQuantityChange,
  onRemove,
  onCheckout,
}: CartPageProps) {
  const [form, setForm] = useState<CheckoutDraft>(draft);

  useEffect(() => {
    setForm(draft);
  }, [draft]);

  const update = (key: keyof CheckoutDraft, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCheckout(form);
  };

  if (lastOrder && items.length === 0) {
    return (
      <main className="page page--center">
        <section className="success-state">
          <CheckCircle2 size={54} aria-hidden="true" />
          <h1>Заказ оформлен</h1>
          <p>
            {lastOrder.id} на сумму {lastOrder.total.toLocaleString('ru-RU')} ₽ создан и добавлен в список заказов.
          </p>
          <button className="button button--primary" type="button" onClick={onNavigateHome}>
            Вернуться в каталог
          </button>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="page page--center">
        <EmptyState
          icon={<ShoppingCart size={32} aria-hidden="true" />}
          title="Корзина пуста"
          text="Добавьте товары из каталога, а затем оформите доставку."
          action={
            <button className="button button--primary" type="button" onClick={onNavigateHome}>
              Перейти в каталог
            </button>
          }
        />
      </main>
    );
  }

  return (
    <main className="page cart-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Корзина</span>
          <h1>Ваш заказ</h1>
        </div>
        <span className="cost-badge">
          <ReceiptText size={14} aria-hidden="true" />
          {total.toLocaleString('ru-RU')} ₽
        </span>
      </div>

      <section className="cart-list" aria-label="Позиции корзины">
        {items.map(({ product, quantity }) => (
          <article className="cart-item" key={product.id}>
            <div className="cart-item__media" style={{ '--accent': product.accent } as CSSProperties}>
              <img src={publicAsset(product.image)} alt="" loading="lazy" />
            </div>
            <div className="cart-item__info">
              <strong>{product.name}</strong>
              <span>
                {product.brand} · {product.price.toLocaleString('ru-RU')} ₽
              </span>
              <em>{(product.price * quantity).toLocaleString('ru-RU')} ₽</em>
            </div>
            <div className="quantity-control" aria-label={`Количество ${product.name}`}>
              <button
                className="icon-button"
                type="button"
                onClick={() => onQuantityChange(product.id, quantity - 1)}
                title="Уменьшить"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <strong>{quantity}</strong>
              <button
                className="icon-button"
                type="button"
                onClick={() => onQuantityChange(product.id, quantity + 1)}
                disabled={quantity >= product.stockCount}
                title="Увеличить"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              className="icon-button icon-button--danger"
              type="button"
              onClick={() => onRemove(product.id)}
              title="Удалить"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>

      <form className="checkout-form" onSubmit={submit}>
        <div className="section-heading">
          <h2>Оформление</h2>
          <span>{items.length} поз.</span>
        </div>
        <div className="checkout-summary">
          <span className="checkout-summary__icon" aria-hidden="true">
            <ReceiptText size={20} />
          </span>
          <div>
            <span>К оплате</span>
            <strong>{total.toLocaleString('ru-RU')} ₽</strong>
          </div>
          <small>Доставка {deliverySettings.priceLabel}</small>
        </div>
        {warning ? <p className="form-note form-note--warning">{warning}</p> : null}
        <div className="checkout-fields">
          <label>
            Имя
            <span className="field-control">
              <UserRound size={17} aria-hidden="true" />
              <input required value={form.name} onChange={(event) => update('name', event.target.value)} />
            </span>
          </label>
          <label>
            Телефон
            <span className="field-control">
              <Phone size={17} aria-hidden="true" />
              <input required inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            </span>
          </label>
          <label>
            Адрес
            <span className="field-control">
              <MapPin size={17} aria-hidden="true" />
              <input required value={form.address} onChange={(event) => update('address', event.target.value)} />
            </span>
          </label>
          <label>
            Комментарий
            <span className="field-control field-control--textarea">
              <MessageSquareText size={17} aria-hidden="true" />
              <textarea rows={3} value={form.comment} onChange={(event) => update('comment', event.target.value)} />
            </span>
          </label>
        </div>
        <button className="button button--primary" type="submit">
          <CheckCircle2 size={18} aria-hidden="true" />
          Оформить заказ
        </button>
      </form>
    </main>
  );
}
