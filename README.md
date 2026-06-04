# Sakura Vape Telegram Mini App

Рабочий прототип магазина на React, TypeScript и Vite с Telegram WebApp SDK, каталогом, корзиной, доставкой и админ-режимом.

## Локальный запуск

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Админ-доступ определяется списком Telegram ID:

```env
VITE_ADMIN_TELEGRAM_IDS="ВАШ_TELEGRAM_ID"
ADMIN_TELEGRAM_ID="ВАШ_TELEGRAM_ID"
```

После изменения `.env` перезапустите Vite.

## Демо на GitHub Pages

В проект уже добавлен workflow `.github/workflows/deploy-pages.yml`. Он автоматически собирает и публикует приложение после каждого push в `main`.

> GitHub Pages подходит только для демонстрации прототипа. По официальным ограничениям GitHub Pages нельзя использовать как хостинг реального интернет-магазина или сервиса, направленного на коммерческие транзакции. Для рабочего магазина используйте VPS или коммерческий hosting.

1. Создайте публичный репозиторий `sakura-vape-miniapp`.
2. Загрузите проект в ветку `main`.
3. В GitHub откройте `Settings` → `Pages` → `Source` и выберите `GitHub Actions`.
4. В `Settings` → `Secrets and variables` → `Actions` → `Variables` добавьте:

```text
VITE_ADMIN_TELEGRAM_IDS=ВАШ_TELEGRAM_ID
```

После успешного workflow приложение будет доступно по адресу:

```text
https://ВАШ_GITHUB_LOGIN.github.io/sakura-vape-miniapp/
```

## Создание и настройка Telegram-бота

1. Откройте `@BotFather` и выполните `/newbot`.
2. Сохраните выданный токен. Никогда не публикуйте его в GitHub.
3. Укажите токен и адрес GitHub Pages только в текущем терминале:

```powershell
$env:TELEGRAM_BOT_TOKEN="ТОКЕН_ОТ_BOTFATHER"
$env:TELEGRAM_MINI_APP_URL="https://ВАШ_GITHUB_LOGIN.github.io/sakura-vape-miniapp/"
npm run bot:configure
```

Команда настроит команды бота, описание и кнопку меню `Открыть магазин`.

Для большой кнопки запуска в профиле бота дополнительно откройте в `@BotFather`:

```text
/mybots → ваш бот → Bot Settings → Configure Mini App → Enable Mini App
```

и укажите тот же HTTPS-адрес GitHub Pages.

## Что работает без сервера

GitHub Pages бесплатно размещает интерфейс Mini App. В текущем прототипе товары, заказы, настройки доставки и загруженные администратором фотографии хранятся в `localStorage` конкретного устройства.

Для общей базы товаров, заказов всех клиентов, безопасной проверки Telegram-пользователя, уведомлений бота и общего хранения фотографий нужен backend. В проекте уже есть заготовки Express, Prisma и PostgreSQL:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run server:dev
```

Важно: проверка администратора только на frontend не является защитой для реального магазина. Перед запуском продаж backend должен валидировать Telegram `initData`.
