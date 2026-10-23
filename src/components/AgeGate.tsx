import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { publicAsset } from '../lib/assets';
import { getTelegramWebApp } from '../lib/telegram';

interface AgeGateProps {
  onConfirm: () => void;
}

export function AgeGate({ onConfirm }: AgeGateProps) {
  const [denied, setDenied] = useState(false);

  return (
    <section className="age-gate" aria-labelledby="age-title">
      <div className="age-gate__brand" aria-hidden="true">
        <img src={publicAsset('assets/sakura-logo.webp')} alt="" />
      </div>
      <div className="age-gate__badge">
        <ShieldCheck size={30} aria-hidden="true" />
        <span>18+</span>
      </div>
      <h1 id="age-title">Вам уже есть 18?</h1>
      <p>В магазине продаются товары с никотином. При получении курьер может попросить документ.</p>

      {denied ? (
        <>
          <p className="age-gate__denied" role="status">
            Каталог доступен только с 18 лет. Будем рады видеть вас позже.
          </p>
          <div className="age-gate__actions">
            <button className="button button--ghost" type="button" onClick={() => getTelegramWebApp().close?.()}>
              Закрыть магазин
            </button>
          </div>
        </>
      ) : (
        <div className="age-gate__actions">
          <button className="button button--primary" type="button" onClick={onConfirm}>
            Да, мне есть 18
          </button>
          <button className="button button--ghost" type="button" onClick={() => setDenied(true)}>
            Нет
          </button>
        </div>
      )}
      <small>Никотин вызывает зависимость.</small>
    </section>
  );
}
