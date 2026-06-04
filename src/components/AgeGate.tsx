import { ShieldCheck, XCircle } from 'lucide-react';
import { publicAsset } from '../lib/assets';

interface AgeGateProps {
  onConfirm: () => void;
}

export function AgeGate({ onConfirm }: AgeGateProps) {
  return (
    <section className="age-gate" aria-labelledby="age-title">
      <div className="age-gate__brand" aria-hidden="true">
        <img src={publicAsset('assets/sakura-logo.png')} alt="" />
        <span>Sakura Vape</span>
      </div>
      <div className="age-gate__badge">
        <ShieldCheck size={30} aria-hidden="true" />
        <span>18+</span>
      </div>
      <h1 id="age-title">Подтвердите возраст</h1>
      <p>
        Каталог вейпшопа доступен только совершеннолетним пользователям. Перед
        просмотром товаров подтвердите, что вам уже исполнилось 18 лет.
      </p>
      <div className="age-gate__actions">
        <button className="button button--primary" type="button" onClick={onConfirm}>
          <ShieldCheck size={18} aria-hidden="true" />
          Мне есть 18
        </button>
        <button className="button button--ghost" type="button">
          <XCircle size={18} aria-hidden="true" />
          Не подтверждаю
        </button>
      </div>
      <small>Товары с никотином вредят здоровью и не предназначены для несовершеннолетних.</small>
    </section>
  );
}
