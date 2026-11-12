import { formatOrderId } from '../lib/ordersApi';
import type { Order, OrderStatus } from '../types';

const activeStatuses: OrderStatus[] = ['Новый', 'В обработке', 'Передан в доставку'];

export const isActiveOrder = (order: Order) => activeStatuses.includes(order.status);

const isPickup = (order: Order) => order.delivery.method === 'pickup' || order.delivery.address.startsWith('Самовывоз');

const getSteps = (pickup: boolean) => [
  { label: 'Принят', title: 'Заказ принят', text: 'Менеджер скоро подтвердит заказ' },
  {
    label: 'Собираем',
    title: 'Собираем заказ',
    text: pickup ? 'Напишем, когда можно забирать' : 'Напишем, когда курьер выедет',
  },
  pickup
    ? { label: 'Готов', title: 'Готов к выдаче', text: 'Заказ ждёт вас в пункте выдачи' }
    : { label: 'В пути', title: 'Курьер в пути', text: 'Курьер свяжется с вами перед приездом' },
];

// Заказ в работе: крупный текущий этап и полоска из трёх шагов
export function ActiveOrderCard({ order }: { order: Order }) {
  const steps = getSteps(isPickup(order));
  const current = Math.max(0, activeStatuses.indexOf(order.status));
  const step = steps[current];

  return (
    <article className="active-order" aria-label={`Заказ ${formatOrderId(order.id)}: ${step.title}`}>
      <div className="active-order__top">
        <span>
          Заказ {formatOrderId(order.id)} ·{' '}
          {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        <em>
          шаг {current + 1} из {steps.length}
        </em>
      </div>

      <strong className="active-order__title">{step.title}</strong>
      <p className="active-order__text">{step.text}</p>

      <ol className="active-order__steps">
        {steps.map((item, index) => (
          <li className={index < current ? 'is-done' : index === current ? 'is-current' : ''} key={item.label}>
            <i aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ol>

      <div className="active-order__items">
        {order.items.map((item) => (
          <div key={`${order.id}-${item.productId}`}>
            <span>{item.productName}</span>
            <span>
              {item.quantity} × {item.price.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        ))}
      </div>

      <div className="active-order__bottom">
        <span>{order.delivery.address}</span>
        <strong>{order.total.toLocaleString('ru-RU')} ₽</strong>
      </div>
    </article>
  );
}
