/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_TELEGRAM_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
  };
  colorScheme?: 'light' | 'dark';
  themeParams?: TelegramThemeParams;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  enableClosingConfirmation?: () => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged?: () => void;
  };
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
