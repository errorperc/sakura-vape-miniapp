import { Boxes, History, LoaderCircle, PackagePlus, ReceiptText, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { OrderList } from '../components/OrderList';
import { getAdminStats } from '../lib/ordersApi';
import type { AdminStats, ManualOrderDraft, Order, OrderStatus, Product, StatsPeriod } from '../types';

interface AdminOrdersPageProps {
  orders: Order[];
  products: Product[];
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onCreateManualOrder: (draft: ManualOrderDraft) => Promise<void>;
}

type Section = 'orders' | 'stats' | 'sale';

const periods: Array<{ id: StatsPeriod; label: string }> = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
  { id: 'all', label: 'Всё' },
];

const stockReasons: Record<string, string> = {
  seed: 'Стартовый остаток',
  admin_create: 'Новый товар',
  admin_update: 'Правка остатка',
  offline_sale: 'Офлайн-продажа',
  order_cancel: 'Отмена заказа',
  order_restore: 'Заказ возвращён',
};

const formatMoney = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

function SalesStats({ orders }: { orders: Order[] }) {
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    getAdminStats(period)
      .then((result) => !cancelled && setStats(result))
      .catch((requestError) => !cancelled && setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить учёт.'));
    return () => {
      cancelled = true;
    };
    // Заказы меняются — пересчитываем учёт
  }, [period, orders]);

  const maxSold = Math.max(1, ...(stats?.products.map((row) => row.sold) ?? [1]));
  const stockValue = stats?.stock.reduce((sum, row) => sum + row.stockValue, 0) ?? 0;

  return (
    <>
      <div className="segmented segmented--small" role="tablist" aria-label="Период">
        {periods.map((item) => (
          <button
            className={period === item.id ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            key={item.id}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="form-note form-note--warning">{error}</p> : null}
      {!stats && !error ? (
        <div className="loading-state loading-state--inline">
          <LoaderCircle className="spin" size={22} aria-hidden="true" />
          <span>Считаем продажи</span>
        </div>
      ) : null}

      {stats ? (
        <>
          <section className="revenue-grid" aria-label="Итоги периода">
            <article className="revenue-card revenue-card--accent">
              <span>Выручка</span>
              <strong>{formatMoney(stats.revenue)}</strong>
            </article>
            <article className="revenue-card">
              <span>Продано, шт.</span>
              <strong>{stats.unitsSold}</strong>
            </article>
            <article className="revenue-card">
              <span>Заказов</span>
              <strong>{stats.ordersCount}</strong>
            </article>
            <article className="revenue-card">
              <span>Средний чек</span>
              <strong>{formatMoney(stats.ordersCount ? Math.round(stats.revenue / stats.ordersCount) : 0)}</strong>
            </article>
          </section>

          <section className="list-section">
            <div className="section-heading">
              <h2><TrendingUp size={18} aria-hidden="true" /> Продажи по товарам</h2>
            </div>
            {stats.products.length === 0 ? (
              <p className="list-empty">За этот период продаж нет.</p>
            ) : (
              <div className="list-group">
                {stats.products.map((row) => (
                  <div className="sales-row" key={row.productId}>
                    <div className="sales-row__top">
                      <strong>{row.title}</strong>
                      <span>{row.sold} шт. · {formatMoney(row.revenue)}</span>
                    </div>
                    <span className="sales-row__bar" style={{ width: `${(row.sold / maxSold) * 100}%` }} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="list-section">
            <div className="section-heading">
              <h2><Boxes size={18} aria-hidden="true" /> Остатки</h2>
              <span>{formatMoney(stockValue)} на складе</span>
            </div>
            <div className="list-group">
              {stats.stock.map((row) => (
                <div className="list-row" key={row.id}>
                  <div>
                    <strong>{row.brand} {row.title}</strong>
                    <span>{formatMoney(row.price)} за шт.</span>
                  </div>
                  <em className={row.quantity === 0 ? 'tone-danger' : row.quantity <= 5 ? 'tone-warning' : ''}>
                    {row.quantity} шт.
                  </em>
                </div>
              ))}
            </div>
          </section>

          <section className="list-section">
            <div className="section-heading">
              <h2><History size={18} aria-hidden="true" /> Движение склада</h2>
            </div>
            <div className="list-group">
              {stats.stockLogs.map((log) => {
                const diff = log.newQuantity - log.oldQuantity;
                return (
                  <div className="list-row" key={log.id}>
                    <div>
                      <strong>{log.productTitle}</strong>
                      <span>
                        {stockReasons[log.reason] ?? log.reason} · {log.adminName} ·{' '}
                        {new Date(log.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <em className={diff < 0 ? 'tone-danger' : 'tone-success'}>
                      {diff > 0 ? '+' : ''}{diff}
                    </em>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

export function AdminOrdersPage({ orders, products, onStatusChange, onCreateManualOrder }: AdminOrdersPageProps) {
  const availableProducts = products.filter((product) => product.isActive && product.stockCount > 0);
  const [section, setSection] = useState<Section>('orders');
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
  const newOrdersCount = orders.filter((order) => order.status === 'Новый').length;
  const selectedProduct = availableProducts.find((product) => product.id === manualOrder.productId);

  useEffect(() => {
    if (manualOrder.productId || !availableProducts[0]) return;
    setManualOrder((current) => ({ ...current, productId: availableProducts[0].id, price: availableProducts[0].price }));
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
      <header className="large-title">
        <h1>Продажи</h1>
        {newOrdersCount > 0 ? <span className="pill pill--accent">{newOrdersCount} новых</span> : null}
      </header>

      <div className="segmented" role="tablist" aria-label="Разделы продаж">
        <button className={section === 'orders' ? 'is-active' : ''} type="button" role="tab" aria-selected={section === 'orders'} onClick={() => setSection('orders')}>
          <ReceiptText size={15} aria-hidden="true" /> Заказы
        </button>
        <button className={section === 'stats' ? 'is-active' : ''} type="button" role="tab" aria-selected={section === 'stats'} onClick={() => setSection('stats')}>
          <TrendingUp size={15} aria-hidden="true" /> Учёт
        </button>
        <button className={section === 'sale' ? 'is-active' : ''} type="button" role="tab" aria-selected={section === 'sale'} onClick={() => setSection('sale')}>
          <PackagePlus size={15} aria-hidden="true" /> Продажа
        </button>
      </div>

      {section === 'orders' ? (
        <OrderList orders={orders} title="Заказы клиентов" editable onStatusChange={onStatusChange} />
      ) : null}

      {section === 'stats' ? <SalesStats orders={orders} /> : null}

      {section === 'sale' ? (
        <form className="admin-form manual-order-form" onSubmit={submit}>
          <p className="form-hint">Продажа в магазине или с рук: товар спишется со склада и попадёт в учёт.</p>
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
                  {product.brand} · {product.name} ({product.stockCount} шт.)
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Кол-во
              <input
                min="1"
                max={selectedProduct?.stockCount}
                type="number"
                value={manualOrder.quantity}
                onChange={(event) => update('quantity', Number(event.target.value))}
              />
            </label>
            <label>
              Цена за шт.
              <input min="0" type="number" value={manualOrder.price} onChange={(event) => update('price', Number(event.target.value))} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Покупатель
              <input value={manualOrder.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="Имя (необязательно)" />
            </label>
            <label>
              Telegram ID
              <input
                inputMode="numeric"
                value={manualOrder.customerTelegramId ?? ''}
                onChange={(event) => update('customerTelegramId', event.target.value.replace(/\D/g, ''))}
                placeholder="Необязательно"
              />
            </label>
          </div>
          <label>
            Статус
            <select value={manualOrder.status} onChange={(event) => update('status', event.target.value as OrderStatus)}>
              <option value="Завершен">Завершен</option>
              <option value="Новый">Новый</option>
              <option value="В обработке">В обработке</option>
            </select>
          </label>
          <label>
            Комментарий
            <textarea rows={2} value={manualOrder.comment} onChange={(event) => update('comment', event.target.value)} placeholder="Например: продано на точке" />
          </label>
          <div className="checkout-summary">
            <div>
              <span>Сумма продажи</span>
              <strong>{formatMoney(manualOrder.price * manualOrder.quantity)}</strong>
            </div>
          </div>
          <button className="button button--primary" type="submit" disabled={submitting || !manualOrder.productId}>
            {submitting ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <PackagePlus size={18} aria-hidden="true" />}
            {submitting ? 'Сохраняем...' : 'Провести продажу'}
          </button>
        </form>
      ) : null}
    </main>
  );
}
