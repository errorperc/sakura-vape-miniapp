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

## Хостинг без GitHub Pages

Mini App можно полностью хостить на вашем VPS: Caddy отдаёт React-приложение на корне HTTPS-домена, а `/api/*` проксирует в Express backend. Репозиторий при этом может быть публичным или приватным, потому что пользователи открывают не GitHub Pages, а ваш сервер.

Текущий временный URL:

```text
https://api.185-246-217-69.sslip.io/
```

## Создание и настройка Telegram-бота

1. Откройте `@BotFather` и выполните `/newbot`.
2. Сохраните выданный токен. Никогда не публикуйте его в GitHub.
3. Укажите токен и HTTPS-адрес Mini App только в текущем терминале:

```powershell
$env:TELEGRAM_BOT_TOKEN="ТОКЕН_ОТ_BOTFATHER"
$env:TELEGRAM_MINI_APP_URL="https://api.185-246-217-69.sslip.io/"
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

## Production-сервер в Docker

Для первого запуска достаточно Ubuntu 24.04, 1 vCPU, 2 GB RAM и 30 GB NVMe. На такой машине проект использует ограничения памяти для контейнеров и создаёт 2 GB swap. Для роста и более спокойных сборок рекомендуется 2 vCPU и 4 GB RAM.

Frontend и API можно размещать на одном сервере без GitHub Pages. Caddy отдаёт React-приложение на корне домена, а `/api/*` проксирует в backend. Временно можно использовать имя `api.185-246-217-69.sslip.io`, которое автоматически указывает на IP сервера. Позже лучше заменить его собственным доменом.

Первичная подготовка Ubuntu:

```bash
sudo bash scripts/bootstrap-ubuntu.sh
sudo git clone https://github.com/errorperc/sakura-vape-miniapp.git /opt/sakura-vape
cd /opt/sakura-vape
sudo cp .env.production.example .env
sudo nano .env
```

Для пароля PostgreSQL используйте случайную hex-строку без специальных URL-символов:

```bash
openssl rand -hex 32
```

Минимальное содержимое `.env`:

```env
APP_DOMAIN=api.185-246-217-69.sslip.io
PUBLIC_APP_URL=https://api.185-246-217-69.sslip.io/
POSTGRES_DB=sakura_vape
POSTGRES_USER=sakura
POSTGRES_PASSWORD=СЛУЧАЙНЫЙ_HEX_ПАРОЛЬ
ADMIN_TELEGRAM_ID=ВАШ_TELEGRAM_ID
PORT=4000
```

Откройте firewall только после проверки SSH-доступа:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Первый запуск:

```bash
cd /opt/sakura-vape
sudo docker compose up -d --build --wait
sudo docker compose run --rm api npm run db:seed
sudo docker compose ps
sudo docker compose logs --tail=100
```

Обновление после новых изменений в GitHub:

```bash
cd /opt/sakura-vape
sudo bash scripts/deploy-server.sh
```

PostgreSQL не опубликован наружу и доступен только контейнеру API. Данные базы, сертификаты Caddy и конфигурация сохраняются в Docker volumes.

Резервная копия базы:

```bash
cd /opt/sakura-vape
sudo docker compose exec -T postgres pg_dump -U sakura sakura_vape | gzip > "sakura-$(date +%F).sql.gz"
```

Для деплоя одной кнопкой в GitHub Actions добавьте repository secrets:

```text
SERVER_HOST     IP сервера
SERVER_USER     SSH-пользователь
SERVER_SSH_KEY  приватный SSH-ключ для деплоя
```

После этого запустите workflow `Deploy production server` вручную в разделе Actions.
