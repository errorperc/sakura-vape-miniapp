import { getTelegramWebApp } from './telegram';
import type { Order } from '../types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export const notifyManagerAboutOrder = async (order: Order) => {
  if (!apiBaseUrl) {
    throw new Error('API URL is not configured.');
  }

  const response = await fetch(`${apiBaseUrl}/api/order-notifications`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      initData: getTelegramWebApp().initData,
      order,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Order notification failed.');
  }
};
