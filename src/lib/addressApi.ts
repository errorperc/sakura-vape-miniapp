import type { AddressSuggestion } from '../types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export const getAddressValidationMessage = (address: string) => {
  const normalized = address.replace(/\s+/g, ' ').trim();

  if (normalized.length < 8) return 'Укажите улицу и номер дома.';
  if (!/[a-zа-яё]{3,}/i.test(normalized)) return 'Адрес должен содержать название улицы.';
  if (!/\d/.test(normalized)) return 'Добавьте номер дома.';
  if (/(.)\1{5,}/i.test(normalized.replace(/\s/g, ''))) return 'Похоже на случайный набор символов.';
  if (!/[,\s]/.test(normalized)) return 'Напишите адрес понятнее: город, улица, дом.';

  return '';
};

export const fetchAddressSuggestions = async (query: string): Promise<AddressSuggestion[]> => {
  const normalized = query.replace(/\s+/g, ' ').trim();

  if (!apiBaseUrl || normalized.length < 3 || !/[a-zа-яё]{2,}/i.test(normalized)) {
    return [];
  }

  const response = await fetch(`${apiBaseUrl}/api/address/suggest?q=${encodeURIComponent(normalized)}`);
  if (!response.ok) return [];

  return (await response.json()) as AddressSuggestion[];
};
