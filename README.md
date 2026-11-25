# Sakura Vape Telegram Mini App

Рабочий прототип магазина на React, TypeScript и Vite с Telegram WebApp SDK, каталогом, корзиной, доставкой и админ-режимом.

## Быстрый запуск на своём компьютере (без Docker)

1. Заполните `.env` (шаблон — `.env.example`): `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `MANAGER_TELEGRAM_ID`.
   Свой ID можно узнать командой `/id` у бота.
2. Запустите `start.bat` двойным кликом или командой `npm run local`.

Скрипт сам поднимет встроенную PostgreSQL (данные в `data/pg`), применит миграции, заполнит пустой каталог,
соберёт мини-апп, откроет временный HTTPS-адрес и настроит кнопку «Магазин» у бота. Бот работает через long polling.
Если Cloudflare в вашей сети недоступен, добавьте в `.env` строку `TUNNEL=localhost.run`.

Что умеет бот: заказ приходит менеджеру с кнопками «Принять / В доставке / Выполнен / Отменить»,
покупатель получает уведомление о каждом статусе, отмена возвращает товар на склад.
В админке «Продажи → Учёт»: выручка и продажи по товарам за день/неделю/месяц/год, остатки и журнал склада.

## Режим разработки

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

## Выкладка на сервер

Пошаговая инструкция — от выбора VPS до резервных копий: [docs/DEPLOY.md](docs/DEPLOY.md).

## Создание и настройка Telegram-бота

1. Откройте `@BotFather` и выполните `/newbot`.
2. Сохраните выданный токен. Никогда не публикуйте его в GitHub.
3. Укажите токен и HTTPS-адрес Mini App только в текущем терминале:

```powershell
$env:TELEGRAM_BOT_TOKEN="ТОКЕН_ОТ_BOTFATHER"
$env:TELEGRAM_MINI_APP_URL="https://ваш-домен/"
npm run bot:configure
```

Команда настроит команды бота, описание и кнопку меню `Открыть магазин`.

Для большой кнопки запуска в профиле бота дополнительно откройте в `@BotFather`:

```text
/mybots → ваш бот → Bot Settings → Configure Mini App → Enable Mini App
```

и укажите тот же HTTPS-адрес Mini App.

## Backend локально

Для общей базы товаров, заказов всех клиентов, безопасной проверки Telegram-пользователя, уведомлений бота и общего хранения фотографий используется Express, Prisma и PostgreSQL:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run server:dev
```

Важно: админские действия на production проверяются backend-ом через Telegram `initData`.

## Переезд с компьютера на сервер и production

Перенос данных, запуск в Docker, переключение бота, резервные копии и обновления описаны в
[docs/DEPLOY.md](docs/DEPLOY.md).
