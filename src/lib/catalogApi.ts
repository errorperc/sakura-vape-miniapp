import type { CatalogCategory, Product } from '../types';
import { getTelegramWebApp } from './telegram';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface CatalogPayload {
  categories: CatalogCategory[];
  products: Product[];
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error('API URL is not configured.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Request failed.');
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
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

export const getCatalog = () => requestJson<CatalogPayload>('/api/catalog');

export const getAdminCatalog = () => adminJson<CatalogPayload>('/api/admin/catalog');

export const createAdminProduct = (product: Product) =>
  adminJson<Product>('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });

export const updateAdminProduct = (product: Product) =>
  adminJson<Product>(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(product),
  });

export const removeAdminProduct = (productId: string) =>
  adminJson<void>(`/api/admin/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });

export const createAdminCategory = (label: string) =>
  adminJson<CatalogCategory>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });

export const renameAdminCategory = (id: string, label: string) =>
  adminJson<CatalogCategory>(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  });

export const removeAdminCategory = (id: string) =>
  adminJson<void>(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
