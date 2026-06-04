import { BarChart3, CalendarDays, CircleDollarSign, PackagePlus, ReceiptText, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { OrderList } from '../components/OrderList';
import type { ManualOrderDraft, Order, OrderStatus, Product } from '../types';

interface AdminOrdersPageProps {
  orders: Order[];
  products: Product[];
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onCreateManualOrder: (draft: ManualOrderDraft) => Promise<void>;
}

const revenueStatuses: OrderStatus[] = ['Новый', 'В обработке', 'Передан в доставку', 'Завершен'];

const formatMoney = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

const getRevenue = (orders: Order[], predicate: (date: Date) => boolean) =>
  orders.reduce((sum, order) => {
    const date = new Date(order.createdAt);
    return revenueStatuses.includes(order.status) && predicate(date) ? sum + order.total : sum;
  }, 0);

export function AdminOrdersPage({
  orders,
  products,
  onStatusChange,
  onCreateManualOrder,
}: AdminOrdersPageProps) {
  const availableProducts = products.filter((product) => product.isActive);
  const [manualOrder, setManualOrder] = useState<ManualOrderDraft>(() => ({
    customerTelegramId: '',
    customerName: '',
    address: 'Офлайн продажа',
    comment: '',
    productId: availableProducts[0]?.id ?? '',
    quantity: 1,
    price: availableProducts[0]?.price ?? 0,
    status: 'Завершен',
  }));
  const [submitting, setSubmitting] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return {
      month: getRevenue(orders, (date) => date.getFullYear() === year && date.getMonth() === month),
      year: getRevenue(orders, (date) => date.getFullYear() === year),
      all: getRevenue(orders, () => true),
      count: orders.filter((order) => revenueStatuses.includes(order.status)).length,
    };
  }, [orders]);

  const selectedProduct = availableProducts.find((product) => product.id === manualOrder.productId);

  useEffect(() => {
    if (manualOrder.productId || !availableProducts[0]) return;

    setManualOrder((current) => ({
      ...current,
      productId: availableProducts[0].id,
      price: availableProducts[0].price,
    }));
  }, [availableProducts, manualOrder.productId]);

  const update = <K extends keyof ManualOrderDraft>(key: K, value: ManualOrderDraft[K]) => {
    setManualOrder((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualOrder.productId) return;

    setSubmitting(true);
    await onCreateManualOrder(manualOrder);
    setSubmitting(false);
    setManualOrder((current) => ({
      ...current,
      customerTelegramId: '',
      customerName: '',
      comment: '',
      quantity: 1,
      price: selectedProduct?.price ?? current.price,
    }));
  };

  return (
    <main className="page admin-orders-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Продажи</span>
          <h1>Заказы</h1>
        </div>
        <span className="cost-badge">
          <ReceiptText size={14} aria-hidden="true" />
          {orders.length}
        </span>
      </div>

      <section className="revenue-grid" aria-label="Статистика заказов">
        <article className="revenue-card revenue-card--accent">
          <CalendarDays size={18} aria-hidden="true" />
          <span>Текущий месяц</span>
          <strong>{formatMoney(stats.month)}</strong>
        </article>
        <article className="revenue-card">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Текущий год</span>
          <strong>{formatMoney(stats.year)}</strong>
        </article>
        <article className="revenue-card">
          <CircleDollarSign size={18} aria-hidden="true" />
          <span>Выручка</span>
          <strong>{formatMoney(stats.all)}</strong>
        </article>
        <article className="revenue-card">
          <BarChart3 size={18} aria-hidden="true" />
          <span>Заказов</span>
          <strong>{stats.count}</strong>
        </article>
      </section>

      <form className="manual-order-form" onSubmit={submit}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Офлайн</span>
            <h2>Добавить заказ вручную</h2>
          </div>
          <PackagePlus size={22} aria-hidden="true" />
        </div>
        <label>
          Покупатель
          <input
            value={manualOrder.customerName}
            onChange={(event) => update('customerName', event.target.value)}
            placeholder="Имя клиента"
          />
        </label>
        <label>
          Telegram ID клиента
          <input
            inputMode="numeric"
            value={manualOrder.customerTelegramId ?? ''}
            onChange={(event) => update('customerTelegramId', event.target.value)}
            placeholder="Опционально: ID покупателя"
          />
        </label>
        <div className="form-row">
          <label>
            Товар
            <select
              required
              value={manualOrder.productId}
              onChange={(event) => {
                const product = availableProducts.find((candidate) => candidate.id === event.target.value);
                update('productId', event.target.value);
                if (product) update('price', product.price);
              }}
            >
              {availableProducts.map((product) => (
                <option value={product.id} key={product.id}>
                  {product.brand} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Кол-во
            <input
              min="1"
              type="number"
              value={manualOrder.quantity}
              onChange={(event) => update('quantity', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Цена
            <input
              min="0"
              type="number"
              value={manualOrder.price}
              onChange={(event) => update('price', Number(event.target.value))}
            />
          </label>
          <label>
            Статус
            <select value={manualOrder.status} onChange={(event) => update('status', event.target.value as OrderStatus)}>
              <option value="Завершен">Завершен</option>
              <option value="Новый">Новый</option>
              <option value="В обработке">В обработке</option>
            </select>
          </label>
        </div>
        <label>
          Где купили
          <input
            value={manualOrder.address}
            onChange={(event) => update('address', event.target.value)}
            placeholder="Например: офлайн магазин"
          />
        </label>
        <label>
          Комментарий
          <textarea
            rows={2}
            value={manualOrder.comment}
            onChange={(event) => update('comment', event.target.value)}
            placeholder="Например: продано в магазине"
          />
        </label>
        <button className="button button--primary" type="submit" disabled={submitting || !manualOrder.productId}>
          <PackagePlus size={18} aria-hidden="true" />
          {submitting ? 'Сохраняем...' : 'Добавить в статистику'}
        </button>
      </form>

      <OrderList orders={orders} title="Заказы клиентов" editable onStatusChange={onStatusChange} />
    </main>
  );
}
