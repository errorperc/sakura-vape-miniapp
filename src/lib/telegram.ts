import WebApp from '@twa-dev/sdk';
import { OWNER_TELEGRAM_ID } from '../data/mockData';
import type { TelegramUserProfile } from '../types';
import { cleanName } from '../../shared/text';

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
  watchKeyboard();
};

// Пока открыта клавиатура, прячем нижнее меню: на iOS оно иначе всплывает над клавиатурой и закрывает поля
const watchKeyboard = () => {
  const isTextField = (target: EventTarget | null) =>
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'button', 'submit'].includes(target.type));
  const root = document.documentElement;
  let hideTimer = 0;

  document.addEventListener('focusin', (event) => {
    if (!isTextField(event.target)) return;
    window.clearTimeout(hideTimer);
    root.classList.add('keyboard-open');
  });
  // Переход между полями даёт focusout → focusin: ждём чуть-чуть, чтобы меню не мигало
  document.addEventListener('focusout', (event) => {
    if (!isTextField(event.target)) return;
    hideTimer = window.setTimeout(() => {
      if (!isTextField(document.activeElement)) root.classList.remove('keyboard-open');
    }, 120);
  });
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

  // Магазин всегда в тёмной теме: фото товаров сняты на тёмном фоне
  root.dataset.theme = 'dark';
  try {
    app.setHeaderColor?.('#000000');
    app.setBackgroundColor?.('#000000');
    app.setBottomBarColor?.('#000000');
  } catch {
    // Старые клиенты Telegram не поддерживают смену цветов
  }
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
  return cleanName([user.firstName, user.lastName].map(cleanName).filter(Boolean).join(' '));
};
