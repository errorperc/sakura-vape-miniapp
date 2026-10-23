import { Bike, CheckCircle2, Clock3, ShieldCheck, Store } from 'lucide-react';
import type { DeliverySettings } from '../types';

interface DeliveryPageProps {
  settings: DeliverySettings;
}

export function DeliveryPage({ settings }: DeliveryPageProps) {
  const deliveryCards = [
    { icon: Bike, title: settings.courierTitle, text: settings.courierDescription },
    { icon: Store, title: settings.pickupTitle, text: settings.pickupDescription },
    { icon: Clock3, title: settings.timeTitle, text: settings.timeDescription },
  ];

  return (
    <main className="page delivery-page">
      <header className="large-title">
        <div>
          <h1>Доставка</h1>
          <p>Как получить заказ</p>
        </div>
        <span className="pill pill--accent">{settings.priceLabel}</span>
      </header>

      <section className="delivery-services" aria-label="Информация о доставке">
        <div className="delivery-services__heading">
          <span>Сервис Sakura</span>
          <small>Детали подтверждает менеджер</small>
        </div>
        {deliveryCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <article className="delivery-service" key={card.title}>
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
    </main>
  );
}
