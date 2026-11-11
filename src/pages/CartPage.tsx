import {
  Bike,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { getAddressValidationMessage } from '../lib/addressApi';
import { ProductImage } from '../components/ProductImage';
import { formatOrderId } from '../lib/ordersApi';
import { segmentStyle } from '../lib/segment';
import type { CheckoutDraft, DeliveryMethod, DeliverySettings, Order, Product } from '../types';
import { realFlavor } from '../../shared/models';

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
  onCheckout: (draft: CheckoutDraft) => Promise<boolean>;
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
  const [submitting, setSubmitting] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const lastQuantities = useRef(new Map<string, number>());

  // Сначала строка плавно уезжает и схлопывается, потом товар убирается из корзины
  const removeAnimated = (productId: string) => {
    if (removingIds.includes(productId)) return;
    setRemovingIds((current) => [...current, productId]);
    window.setTimeout(() => {
      onRemove(productId);
      setRemovingIds((current) => current.filter((id) => id !== productId));
    }, 420);
  };

  // Направление смены числа: больше — цифра въезжает снизу, меньше — сверху
  const quantityDirection = (productId: string, quantity: number) => {
    const previous = lastQuantities.current.get(productId) ?? quantity;
    lastQuantities.current.set(productId, quantity);
    return quantity < previous ? 'is-down' : '';
  };
  const method: DeliveryMethod = form.method ?? 'courier';
  const isPickup = method === 'pickup';

  useEffect(() => {
    setForm(draft);
  }, [draft]);

  const setMethod = (next: DeliveryMethod) => {
    setForm((current) => ({ ...current, method: next }));
    setAddressError('');
  };

  const update = (key: keyof CheckoutDraft, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'address') setAddressError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAddressError = isPickup ? '' : getAddressValidationMessage(form.address);
    if (nextAddressError) {
      setAddressError(nextAddressError);
      return;
    }

    setSubmitting(true);
    await onCheckout({ ...form, method });
    setSubmitting(false);
  };

  if (lastOrder && items.length === 0) {
    return (
      <main className="page page--center">
        <section className="success-state">
          <CheckCircle2 size={54} aria-hidden="true" />
          <h1>Заказ принят</h1>
          <p>
            Заказ {formatOrderId(lastOrder.id)} на сумму {lastOrder.total.toLocaleString('ru-RU')} ₽ передан менеджеру. Мы напишем вам в Telegram, когда он будет в пути.
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
      <main className="page page--center cart-empty-page">
        <EmptyState
          icon={<ShoppingCart size={32} aria-hidden="true" />}
          title="Корзина пуста"
          text="Загляните в каталог — там есть из чего выбрать."
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
      <header className="large-title">
        <h1>Корзина</h1>
        <span className="pill">{items.reduce((sum, item) => sum + item.quantity, 0)} шт.</span>
      </header>

      <section className="cart-list" aria-label="Позиции корзины">
        {items.map(({ product, quantity }) => (
          <article className={`cart-item ${removingIds.includes(product.id) ? 'is-removing' : ''}`} key={product.id}>
            <div className="cart-item__media" style={{ '--accent': product.accent } as CSSProperties}>
              <ProductImage src={product.image} width={160} />
            </div>
            <div className="cart-item__info">
              <strong>{product.name}</strong>
              <span>{[product.brand, realFlavor(product.taste)].filter(Boolean).join(' · ')}</span>
              <em>{(product.price * quantity).toLocaleString('ru-RU')} ₽</em>
            </div>
            <div className="quantity-control" aria-label={`Количество ${product.name}`}>
              <button
                className="icon-button"
                type="button"
                onClick={() => (quantity <= 1 ? removeAnimated(product.id) : onQuantityChange(product.id, quantity - 1))}
                title="Уменьшить"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <strong>
                <span className={quantityDirection(product.id, quantity)} key={quantity}>{quantity}</span>
              </strong>
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
              onClick={() => removeAnimated(product.id)}
              title="Удалить"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>

      <form className="checkout-form" onSubmit={submit}>
        <div className="section-heading">
          <h2>Способ получения</h2>
        </div>
        <div className="segmented" role="tablist" aria-label="Способ получения" style={segmentStyle(isPickup ? 1 : 0, 2)}>
          <button className={!isPickup ? 'is-active' : ''} type="button" role="tab" aria-selected={!isPickup} onClick={() => setMethod('courier')}>
            <Bike size={15} aria-hidden="true" /> {deliverySettings.courierTitle}
          </button>
          <button className={isPickup ? 'is-active' : ''} type="button" role="tab" aria-selected={isPickup} onClick={() => setMethod('pickup')}>
            <Store size={15} aria-hidden="true" /> {deliverySettings.pickupTitle}
          </button>
        </div>

        <div className="delivery-info" key={method}>
          <p>{isPickup ? deliverySettings.pickupDescription : deliverySettings.courierDescription}</p>
          {!isPickup ? (
            <span>
              <Clock3 size={14} aria-hidden="true" /> {deliverySettings.timeDescription}
            </span>
          ) : null}
          <details className="delivery-info__terms">
            <summary>
              Условия доставки <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <p><CheckCircle2 size={15} aria-hidden="true" /> {deliverySettings.primaryCondition}</p>
            <p><ShieldCheck size={15} aria-hidden="true" /> {deliverySettings.secondaryCondition}</p>
          </details>
        </div>

        <div className="checkout-fields">
          <label>
            Имя
            <span className="field-control">
              <UserRound size={17} aria-hidden="true" />
              <input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Как к вам обращаться" autoComplete="given-name" />
            </span>
          </label>
          {!isPickup ? (
          <label className="address-field">
            Адрес
            <span className="field-control">
              <MapPin size={17} aria-hidden="true" />
              <input
                required
                value={form.address}
                onChange={(event) => update('address', event.target.value)}
                placeholder="Немига 8, кв. 12"
                onBlur={() => form.address.trim() && setAddressError(getAddressValidationMessage(form.address))}
                aria-invalid={Boolean(addressError)}
                aria-describedby={addressError ? 'address-error' : undefined}
                autoComplete="street-address"
              />
            </span>
            {addressError ? <small className="field-error" id="address-error" role="alert">{addressError}</small> : null}
          </label>
          ) : null}
          <label>
            Комментарий
            <span className="field-control field-control--textarea">
              <MessageSquareText size={17} aria-hidden="true" />
              <textarea rows={3} value={form.comment} onChange={(event) => update('comment', event.target.value)} />
            </span>
          </label>
        </div>
        <div className="checkout-summary">
          <div>
            <span>К оплате</span>
            <strong>{total.toLocaleString('ru-RU')} ₽</strong>
          </div>
          <small>{isPickup ? 'Самовывоз бесплатно' : `Доставка ${deliverySettings.priceLabel}`}</small>
        </div>
        {warning ? <p className="form-note form-note--warning">{warning}</p> : null}
        <button className="button button--primary checkout-submit" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="product-card__cart-loader" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          {submitting ? 'Отправляем…' : `Оформить заказ · ${total.toLocaleString('ru-RU')} ₽`}
        </button>
      </form>
    </main>
  );
}
