import {
  BadgeCheck,
  CalendarClock,
  Crown,
  History,
  ShoppingBag,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { OrderList } from '../components/OrderList';
import type { Order, TelegramUserProfile } from '../types';
import { formatUserName } from '../lib/telegram';

interface ProfilePageProps {
  user: TelegramUserProfile;
  orders: Order[];
  isAdmin: boolean;
}

const getClientStatus = (orders: Order[]) => {
  const total = orders.reduce((sum, order) => sum + order.total, 0);

  if (orders.length >= 15 || total >= 20000) {
    return 'VIP';
  }

  if (orders.length >= 10 || total >= 10000) {
    return 'Постоянный клиент';
  }

  return 'Новичок';
};

export function ProfilePage({ user, orders, isAdmin }: ProfilePageProps) {
  const name = formatUserName(user);
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const lastOrder = orders[0];
  const initials = `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <main className="page page--profile">
      <div className="page-header page-header--profile">
        <div>
          <span className="eyebrow">Профиль</span>
          <h1>Ваш аккаунт</h1>
        </div>
        <span className="page-header__icon" aria-hidden="true">
          <UserRound size={20} />
        </span>
      </div>

      <section className="profile-card">
        <div className="profile-card__avatar-wrap">
          <div className="profile-card__avatar">
            {user.photoUrl ? <img src={user.photoUrl} alt={name} /> : <span>{initials || <UserRound />}</span>}
          </div>
          <i aria-label="Пользователь активен" />
        </div>
        <div className="profile-card__info">
          <div>
            <h1>{name}</h1>
            <p>{user.username ? `@${user.username}` : 'username не указан'}</p>
          </div>
          <div className="profile-card__chips">
            <span>
              <BadgeCheck size={15} aria-hidden="true" />
              ID {user.id}
            </span>
            {isAdmin ? (
              <span>
                <Crown size={15} aria-hidden="true" />
                Администратор
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Статистика профиля">
        <div className="stat-card">
          <span className="stat-card__icon"><ShoppingBag size={16} aria-hidden="true" /></span>
          <span>Заказы</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon"><WalletCards size={16} aria-hidden="true" /></span>
          <span>Покупки</span>
          <strong>{total.toLocaleString('ru-RU')} ₽</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon"><CalendarClock size={16} aria-hidden="true" /></span>
          <span>Последний</span>
          <strong>
            {lastOrder
              ? new Date(lastOrder.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
              : 'Нет'}
          </strong>
        </div>
        <div className="stat-card stat-card--accent">
          <span className="stat-card__icon"><Sparkles size={16} aria-hidden="true" /></span>
          <span>Статус</span>
          <strong>{getClientStatus(orders)}</strong>
        </div>
      </section>

      {orders.length > 0 ? (
        <OrderList orders={orders} />
      ) : (
        <EmptyState
          icon={<History size={30} aria-hidden="true" />}
          title="История пуста"
          text="После первого оформления заказа здесь появятся состав, сумма и статус."
        />
      )}
    </main>
  );
}
