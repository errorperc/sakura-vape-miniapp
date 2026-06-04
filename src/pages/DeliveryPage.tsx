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
