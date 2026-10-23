import {
  BadgeCheck,
  CalendarClock,
  Crown,
  Cloud,
  CloudFog,
  CloudLightning,
  History,
  ShoppingBag,
  Sparkles,
  Tornado,
  UserRound,
  WalletCards,
  Wind,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { EmptyState } from '../components/EmptyState';
import { OrderList } from '../components/OrderList';
import type { Order, TelegramUserProfile } from '../types';
import { formatUserName } from '../lib/telegram';

interface ProfilePageProps {
  user: TelegramUserProfile;
  orders: Order[];
  isAdmin: boolean;
}

// Уровни клиента: следующий открывается по числу заказов ИЛИ по сумме покупок
const levels = [
  { name: 'Лёгкая дымка', text: 'Первая затяжка в Sakura', icon: Wind, orders: 0, spent: 0 },
  { name: 'Облачко', text: 'Первый заказ уже ваш', icon: Cloud, orders: 1, spent: 0 },
  { name: 'Туман', text: 'Вы здесь свой', icon: CloudFog, orders: 3, spent: 5000 },
  { name: 'Грозовая туча', text: 'Любимый клиент магазина', icon: CloudLightning, orders: 7, spent: 15000 },
  { name: 'Ураган', text: 'Высший уровень — VIP', icon: Tornado, orders: 15, spent: 30000 },
];

const getClientLevel = (orders: Order[]) => {
  const counted = orders.filter((order) => order.status !== 'Отменен');
  const count = counted.length;
  const spent = counted.reduce((sum, order) => sum + order.total, 0);
  const reached = (level: (typeof levels)[number]) => count >= level.orders || (level.spent > 0 && spent >= level.spent);
  const index = levels.reduce((best, level, candidate) => (reached(level) ? candidate : best), 0);
  const next = levels[index + 1];

  if (!next) return { level: levels[index], index, next: null, progress: 1, hint: 'Максимальный уровень' };

  const ordersLeft = Math.max(0, next.orders - count);
  const spentLeft = Math.max(0, next.spent - spent);
  const progress = Math.max(count / next.orders, next.spent ? spent / next.spent : 0);
  const hint = next.spent
    ? `Ещё ${ordersLeft} ${ordersLeft === 1 ? 'заказ' : ordersLeft < 5 ? 'заказа' : 'заказов'} или ${spentLeft.toLocaleString('ru-RU')} ₽ до «${next.name}»`
    : `Оформите первый заказ — откроется «${next.name}»`;

  return { level: levels[index], index, next, progress: Math.min(1, progress), hint };
};

export function ProfilePage({ user, orders, isAdmin }: ProfilePageProps) {
  const name = formatUserName(user);
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const lastOrder = orders[0];
  const clientLevel = getClientLevel(orders);
  const LevelIcon = clientLevel.level.icon;
  const initials = `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <main className="page page--profile">
      <header className="large-title">
        <h1>Профиль</h1>
      </header>

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

      <section className={`level-card level-card--${clientLevel.index}`} aria-label="Уровень клиента">
        <span className="level-card__icon" aria-hidden="true">
          <LevelIcon size={22} />
        </span>
        <div className="level-card__info">
          <span>Ваш уровень</span>
          <strong>{clientLevel.level.name}</strong>
          <small>{clientLevel.level.text}</small>
        </div>
        <div className="level-card__steps" aria-hidden="true">
          {levels.map((level, index) => (
            <i className={index <= clientLevel.index ? 'is-reached' : ''} key={level.name} />
          ))}
        </div>
        <div className="level-card__progress">
          <span style={{ '--progress': clientLevel.progress } as CSSProperties} />
        </div>
        <p>{clientLevel.hint}</p>
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
        <div className="stat-card">
          <span className="stat-card__icon"><Sparkles size={16} aria-hidden="true" /></span>
          <span>Средний чек</span>
          <strong>{orders.length ? Math.round(total / orders.length).toLocaleString('ru-RU') : 0} ₽</strong>
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
