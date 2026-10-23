import { getTelegramWebApp } from './telegram';
import type { AdminStats, ManualOrderDraft, Order, OrderStatus, StatsPeriod } from '../types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const authedRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {

  const initData = getTelegramWebApp().initData;
  if (!initData) {
    throw new Error('Откройте магазин внутри Telegram и попробуйте ещё раз.');
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
    throw new Error(body?.error ?? 'Не получилось. Проверьте интернет и попробуйте ещё раз.');
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

export const getAdminStats = (period: StatsPeriod) =>
  authedRequest<AdminStats>(`/api/admin/stats?period=${period}`);

// Короткий номер заказа — тот же, что в сообщении менеджеру в Telegram
export const formatOrderId = (id: string) => `№${id.replace(/^order-/, '').slice(0, 8).toUpperCase()}`;
