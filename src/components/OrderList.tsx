import { CalendarDays, CheckCircle2, Clock3, PackageCheck, Truck, XCircle } from 'lucide-react';
import type { Order, OrderStatus } from '../types';
import { EmptyState } from './EmptyState';

interface OrderListProps {
  orders: Order[];
  title?: string;
  editable?: boolean;
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
}

const statuses: OrderStatus[] = ['Новый', 'В обработке', 'Передан в доставку', 'Завершен', 'Отменен'];

const getStatusTone = (status: OrderStatus) => {
  if (status === 'Завершен') return 'complete';
  if (status === 'Отменен') return 'canceled';
  if (status === 'Передан в доставку') return 'delivery';

  return 'active';
};

const getStatusIcon = (status: OrderStatus) => {
  if (status === 'Завершен') return CheckCircle2;
  if (status === 'Отменен') return XCircle;
  if (status === 'Передан в доставку') return Truck;
  if (status === 'В обработке') return Clock3;

  return PackageCheck;
};

export function OrderList({ orders, title = 'История заказов', editable = false, onStatusChange }: OrderListProps) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageCheck size={30} aria-hidden="true" />}
        title="Заказов пока нет"
        text="Когда пользователь оформит заказ, он появится здесь со статусом и составом."
      />
    );
  }

  return (
    <section className={`order-list ${editable ? 'order-list--editable' : 'order-list--timeline'}`} aria-labelledby="orders-title">
      <div className="section-heading">
        <h2 id="orders-title">{title}</h2>
        <span>{orders.length}</span>
      </div>

      <div className="order-list__items">
        {orders.map((order) => {
          const StatusIcon = getStatusIcon(order.status);

          return (
            <article className={`order-card order-card--${getStatusTone(order.status)}`} key={order.id}>
              {!editable ? (
                <span className="order-card__marker" aria-hidden="true">
                  <StatusIcon size={17} strokeWidth={2.25} />
                </span>
              ) : null}
              <div className="order-card__top">
                <div>
                  <strong>{order.id}</strong>
                  <span>
                    <CalendarDays size={15} aria-hidden="true" />
                    {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {editable ? (
                  <select
                    className="select"
                    value={order.status}
                    onChange={(event) => onStatusChange?.(order.id, event.target.value as OrderStatus)}
                    aria-label={`Статус заказа ${order.id}`}
                  >
                    {statuses.map((status) => (
                      <option value={status} key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`status-badge status-badge--${getStatusTone(order.status)}`}>
                    <i aria-hidden="true" />
                    {order.status}
                  </span>
                )}
              </div>

              <div className="order-card__items">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.productId}`}>
                    <span>
                      {item.brand} {item.productName}
                    </span>
                    <span>
                      {item.quantity} × {item.price.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-card__bottom">
                <span className="order-card__address">{order.delivery.address}</span>
                <strong>{order.total.toLocaleString('ru-RU')} ₽</strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
