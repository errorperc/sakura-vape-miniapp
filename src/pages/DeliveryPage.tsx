import {
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CheckoutDraft, DeliverySettings } from '../types';

interface DeliveryPageProps {
  settings: DeliverySettings;
  initialDraft: CheckoutDraft;
  cartCount: number;
  onPrepareDelivery: (draft: CheckoutDraft) => void;
}

export function DeliveryPage({ settings, initialDraft, cartCount, onPrepareDelivery }: DeliveryPageProps) {
  const [draft, setDraft] = useState<CheckoutDraft>(initialDraft);
  const [saved, setSaved] = useState(false);
  const deliveryCards = [
    { icon: Bike, title: settings.courierTitle, text: settings.courierDescription },
    { icon: Store, title: settings.pickupTitle, text: settings.pickupDescription },
    { icon: Clock3, title: settings.timeTitle, text: settings.timeDescription },
    { icon: MapPin, title: settings.zonesTitle, text: settings.zonesDescription },
  ];

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const update = (key: keyof CheckoutDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onPrepareDelivery(draft);
    setSaved(true);
  };

  return (
    <main className="page delivery-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Доставка</span>
          <h1>Как получить заказ</h1>
        </div>
        <span className="cost-badge">
          <Bike size={14} aria-hidden="true" />
          {settings.priceLabel}
        </span>
      </div>

      <section className="delivery-services" aria-label="Информация о доставке">
        <div className="delivery-services__heading">
          <span>Сервис Sakura</span>
          <small>Детали подтверждает администратор</small>
        </div>
        {deliveryCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <article className="delivery-service" key={`${card.title}-${index}`}>
              <span className="delivery-service__icon" aria-hidden="true">
                <Icon size={19} />
              </span>
              <div>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </div>
              <small>{String(index + 1).padStart(2, '0')}</small>
            </article>
          );
        })}
      </section>

      <section className="delivery-rules">
        <h2>Условия</h2>
        <div className="delivery-rule">
          <CheckCircle2 size={18} aria-hidden="true" />
          <p>{settings.primaryCondition}</p>
        </div>
        <div className="delivery-rule">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>{settings.secondaryCondition}</p>
        </div>
      </section>

      <form className="delivery-contact-form" onSubmit={submit}>
        <div className="section-heading">
          <h2>Данные доставки</h2>
          <span>{cartCount > 0 ? `${cartCount} в корзине` : 'Корзина пуста'}</span>
        </div>

        <div className="delivery-contact-fields">
          <label>
            Имя
            <span className="field-control">
              <UserRound size={17} aria-hidden="true" />
              <input required value={draft.name} onChange={(event) => update('name', event.target.value)} />
            </span>
          </label>
          <label>
            Телефон
            <span className="field-control">
              <Phone size={17} aria-hidden="true" />
              <input
                required
                inputMode="tel"
                value={draft.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="+375 29 123-45-67"
              />
            </span>
          </label>
          <label>
            Адрес
            <span className="field-control">
              <MapPin size={17} aria-hidden="true" />
              <input
                required
                value={draft.address}
                onChange={(event) => update('address', event.target.value)}
                placeholder="Город, улица, дом, квартира"
              />
            </span>
          </label>
          <label>
            Комментарий
            <span className="field-control field-control--textarea">
              <MessageSquareText size={17} aria-hidden="true" />
              <textarea
                rows={3}
                value={draft.comment}
                onChange={(event) => update('comment', event.target.value)}
                placeholder="Подъезд, время, пожелания"
              />
            </span>
          </label>
        </div>

        <button className="button button--primary" type="submit">
          <PackageCheck size={18} aria-hidden="true" />
          Подготовить заказ
        </button>

        {saved ? (
          <p className="form-note">
            Данные сохранены в локальном состоянии и готовы к отправке администратору.
          </p>
        ) : null}
      </form>
    </main>
  );
}
