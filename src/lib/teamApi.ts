import { getTelegramWebApp } from './telegram';
import type { AdminRole, AdminSession, TeamMember } from '../types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const adminRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const initData = getTelegramWebApp().initData;

  if (!apiBaseUrl || !initData) {
    throw new Error('Откройте панель внутри Telegram.');
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
    throw new Error(body?.error ?? 'Не удалось выполнить запрос.');
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const getAdminSession = () => adminRequest<AdminSession>('/api/admin/session');

export const getTeamMembers = () => adminRequest<TeamMember[]>('/api/admin/team');

export const saveTeamMember = (member: {
  telegramId: string;
  firstName: string;
  username: string;
  role: Extract<AdminRole, 'admin' | 'manager'>;
}) =>
  adminRequest<TeamMember>('/api/admin/team', {
    method: 'POST',
    body: JSON.stringify(member),
  });

export const removeTeamMember = (telegramId: string) =>
  adminRequest<void>(`/api/admin/team/${encodeURIComponent(telegramId)}`, { method: 'DELETE' });
