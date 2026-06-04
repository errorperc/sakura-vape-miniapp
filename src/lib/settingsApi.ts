import type { DeliverySettings } from '../types';
import { getTelegramWebApp } from './telegram';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error('API URL is not configured.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Request failed.');
  }

  return (await response.json()) as T;
};

const adminJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const initData = getTelegramWebApp().initData;

  if (!initData) {
    throw new Error('Open the admin panel inside Telegram.');
  }

  return requestJson<T>(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': initData,
      ...init?.headers,
    },
  });
};

export const getDeliverySettings = () => requestJson<DeliverySettings>('/api/settings/delivery');

export const saveDeliverySettings = (settings: DeliverySettings) =>
  adminJson<DeliverySettings>('/api/admin/settings/delivery', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
