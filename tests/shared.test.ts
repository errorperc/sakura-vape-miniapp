import { describe, expect, it } from 'vitest';
import { getAddressError } from '../shared/address';
import { cleanName } from '../shared/text';
import { describeRepeat, planRepeat } from '../src/lib/repeatOrder';
import { flavorCountLabel, groupByModel, orderItemTitle, realFlavor } from '../shared/models';
import { findModelImage, galleryImages } from '../src/lib/modelImages';
import type { Product } from '../src/types';

describe('проверка адреса', () => {
  it.each([
    'Минск, ул. Немига, 8',
    'Немига 8',
    'г. Минск, пр-т Независимости, 45к2, кв. 17',
    'ул. Пролетарская 12а, кв 5',
    'Минск, Притыцкого 156/2',
    'пр. Победителей, д. 21, подъезд 3, этаж 4',
    'Сурганова 57Б',
    '220030, Минск, ул. Кирова 13',
    'мкр. Уручье, ул. Шугаева 9-1',
    'улица Якуба Коласа, дом 36',
    'Логойский тракт 22',
    'Ленина 2',
  ])('принимает настоящий адрес: %s', (address) => {
    expect(getAddressError(address)).toBe('');
  });

  it.each([
    ['фывапролдж 12', 'случайный набор'],
    ['йцукен 5', 'случайный набор'],
    ['ааааааа 1', 'случайный набор'],
    ['абабабаб 3', 'случайный набор'],
    ['Минск', 'улицу и номер дома'],
    ['ул. Ленина', 'номер дома'],
    ['123456789', 'телефона'],
    ['+375 29 123-45-67', 'телефона'],
    ['ул <script> 5', 'лишние символы'],
    ['Пушкинa 5', 'раскладку'],
  ])('отклоняет «%s»', (address, hint) => {
    expect(getAddressError(address)).toContain(hint);
  });
});

describe('очистка имени', () => {
  it('убирает невидимые символы «пустых» имён Telegram', () => {
    expect(cleanName('ㅤ')).toBe('');
    expect(cleanName('ㅤㅤ Аня')).toBe('Аня');
    expect(cleanName('Max​')).toBe('Max');
    expect(cleanName(undefined)).toBe('');
  });
});

describe('фото по модели', () => {
  const product = (id: string, brand: string, name: string, image: string) => ({ id, brand, name, image }) as Product;
  const products = [
    product('1', 'Waka', 'Sopro 20000', 'products/generated/waka-sopro-20000-live-photo.webp'),
    product('2', 'Waka', '10000', 'products/generated/waka-10000-styled.webp'),
  ];

  it('та же модель с другим вкусом получает фото, другая модель — нет', () => {
    expect(findModelImage(products, 'waka', 'Sopro 20000 Арбуз')).toBe(products[0].image);
    expect(findModelImage(products, 'Waka', 'Sopro 10000')).toBeNull();
    expect(findModelImage(products, 'Elf Bar', 'Sopro 20000')).toBeNull();
  });

  it('галерея без повторов и без data URL', () => {
    const gallery = galleryImages([...products, product('3', 'X', 'Y', 'data:image/png;base64,AAA')]);
    expect(new Set(gallery).size).toBe(gallery.length);
    expect(gallery.some((image) => image.startsWith('data:'))).toBe(false);
  });
});

describe('вкусы модели', () => {
  const item = (brand: string, name: string, taste: string) => ({ brand, name, taste });

  it('товары с одинаковыми брендом и названием собираются в одну модель', () => {
    const models = groupByModel([
      item('Waka', 'Sopro 20000', 'Арбуз'),
      item('Pafos', 'Pafos', 'Кола'),
      item(' waka ', 'sopro  20000', 'Манго'),
      item('Waka', '10000', 'Мята'),
    ]);

    expect(models.map((model) => model.variants.length)).toEqual([2, 1, 1]);
    expect(models[0].variants.map((variant) => variant.taste)).toEqual(['Арбуз', 'Манго']);
    expect(models[0].name).toBe('Sopro 20000');
  });

  it('заглушка вкуса покупателю не показывается', () => {
    expect(realFlavor('Уточните вкус в админке')).toBe('');
    expect(realFlavor('  ')).toBe('');
    expect(realFlavor(' Арбуз ')).toBe('Арбуз');
  });

  it('строка заказа содержит вкус', () => {
    expect(orderItemTitle('Sopro 20000', 'Арбуз')).toBe('Sopro 20000 · Арбуз');
    expect(orderItemTitle('Sopro 20000', 'Уточните вкус в админке')).toBe('Sopro 20000');
  });

  it.each([
    [1, '1 вкус'],
    [2, '2 вкуса'],
    [5, '5 вкусов'],
    [11, '11 вкусов'],
    [12, '12 вкусов'],
    [21, '21 вкус'],
    [24, '24 вкуса'],
  ])('склонение: %i → %s', (count, label) => {
    expect(flavorCountLabel(count)).toBe(label);
  });
});

describe('повтор заказа', () => {
  const product = (id: string, stockCount: number, isActive = true) =>
    ({ id, name: id, brand: 'B', stockCount, isActive, price: 100 }) as Product;
  const line = (productId: string, quantity: number) => ({ productId, productName: productId, brand: 'B', price: 90, quantity });

  it('кладёт в корзину столько же, сколько было в заказе', () => {
    const plan = planRepeat([line('a', 2), line('b', 1)], [product('a', 10), product('b', 5)], []);
    expect(plan.set.map((entry) => [entry.product.id, entry.quantity])).toEqual([['a', 2], ['b', 1]]);
    expect(describeRepeat(plan)).toBe('');
  });

  it('не превышает остаток и сообщает о нехватке', () => {
    const plan = planRepeat([line('a', 5), line('b', 1), line('c', 1)], [product('a', 2), product('b', 0), product('c', 3, false)], []);
    expect(plan.set.map((entry) => [entry.product.id, entry.quantity])).toEqual([['a', 2]]);
    expect(plan.missing).toEqual(['b', 'c']);
    expect(plan.reduced).toEqual(['a']);
    expect(describeRepeat(plan)).toContain('Остальное добавлено');
  });

  it('не уменьшает то, что уже лежит в корзине, и переживает удалённый товар', () => {
    const plan = planRepeat([line('a', 1), line('gone', 2)], [product('a', 10)], [{ productId: 'a', quantity: 4 }]);
    expect(plan.set[0].quantity).toBe(4);
    expect(plan.missing).toEqual(['gone']);
  });
});
