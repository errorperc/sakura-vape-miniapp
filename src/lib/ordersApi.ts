import { getTelegramWebApp } from './telegram';
import type { ManualOrderDraft, Order, OrderStatus } from '../types';

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

const authedRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error('API URL is not configured.');
  }

  const initData = getTelegramWebApp().initData;
  if (!initData) {
    throw new Error('Open the shop inside Telegram and try again.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': initData,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Request failed.');
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const createCustomerOrder = (order: Order) =>
  authedRequest<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ order }),
  });

export const getMyOrders = () => authedRequest<Order[]>('/api/orders/my');

export const getAdminOrders = () => authedRequest<Order[]>('/api/admin/orders');

export const createManualOrder = (draft: ManualOrderDraft) =>
  authedRequest<Order>('/api/admin/orders', {
    method: 'POST',
    body: JSON.stringify(draft),
  });

export const updateAdminOrderStatus = (orderId: string, status: OrderStatus) =>
  authedRequest<Order>(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
