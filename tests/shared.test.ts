import { describe, expect, it } from 'vitest';
import { getAddressError } from '../shared/address';
import { cleanName } from '../shared/text';
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
