import WebApp from '@twa-dev/sdk';
import { OWNER_TELEGRAM_ID } from '../data/mockData';
import type { TelegramUserProfile } from '../types';

const demoUser: TelegramUserProfile = {
  id: 777000,
  firstName: 'Алексей',
  lastName: 'Смирнов',
  username: 'demo_vaper',
  photoUrl: '',
  isDemo: true,
};

export const getTelegramWebApp = () => {
  return window.Telegram?.WebApp ?? WebApp;
};

export const initTelegramApp = () => {
  const app = getTelegramWebApp();

  try {
    app.ready?.();
    app.expand?.();
    app.enableClosingConfirmation?.();
  } catch {
    // The SDK is optional outside Telegram, so local preview keeps working.
  }

  applyTelegramTheme();
};

export const getTelegramUser = (): TelegramUserProfile => {
  const tgUser = getTelegramWebApp().initDataUnsafe?.user;

  if (!tgUser) {
    return demoUser;
  }

  return {
    id: tgUser.id,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
    username: tgUser.username,
    photoUrl: tgUser.photo_url,
    isDemo: false,
  };
};

export const isOwnerUser = (userId: number) => {
  return OWNER_TELEGRAM_ID === userId;
};

export const haptic = (type: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light') => {
  const feedback = getTelegramWebApp().HapticFeedback;

  try {
    if (type === 'success' || type === 'warning' || type === 'error') {
      feedback?.notificationOccurred?.(type);
      return;
    }

    feedback?.impactOccurred?.(type);
  } catch {
    // Haptics are best-effort in desktop and local browser.
  }
};

export const applyTelegramTheme = () => {
  const app = getTelegramWebApp();
  const params = app.themeParams ?? {};
  const root = document.documentElement;
  const isDark = app.colorScheme !== 'light';

  const setVar = (name: string, value?: string) => {
    if (value) {
      root.style.setProperty(name, value);
    }
  };

  root.dataset.theme = isDark ? 'dark' : 'light';
  setVar('--tg-bg', params.bg_color ?? '#0b0b0f');
  setVar('--tg-text', params.text_color ?? '#f7f7fb');
  setVar('--tg-hint', params.hint_color ?? '#8c8994');
  setVar('--tg-link', isDark ? '#ff58a8' : '#d91f73');
  setVar('--tg-button', isDark ? '#f52b88' : '#df2479');
  setVar('--tg-button-text', '#ffffff');
  setVar('--tg-secondary-bg', params.secondary_bg_color ?? '#111118');
  setVar('--tg-section-bg', params.section_bg_color ?? '#171720');
  setVar('--tg-subtitle', params.subtitle_text_color ?? '#a4a0ad');
  setVar('--tg-destructive', params.destructive_text_color ?? '#ff5c7a');
};

export const formatUserName = (user: TelegramUserProfile) => {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
};
