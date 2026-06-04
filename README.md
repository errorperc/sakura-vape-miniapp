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

## Production-сервер в Docker

Для первого запуска достаточно Ubuntu 24.04, 1 vCPU, 2 GB RAM и 30 GB NVMe. На такой машине проект использует ограничения памяти для контейнеров и создаёт 2 GB swap. Для роста и более спокойных сборок рекомендуется 2 vCPU и 4 GB RAM.

Перед запуском направьте DNS `A`-запись домена, например `shop.example.com`, на IP сервера. Telegram Mini App требует публичный HTTPS URL. Caddy автоматически получит и будет продлевать сертификат, если порты `80` и `443` открыты.

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
APP_DOMAIN=shop.example.com
POSTGRES_DB=sakura_vape
POSTGRES_USER=sakura
POSTGRES_PASSWORD=СЛУЧАЙНЫЙ_HEX_ПАРОЛЬ
ADMIN_TELEGRAM_ID=ВАШ_TELEGRAM_ID
VITE_ADMIN_TELEGRAM_IDS=ВАШ_TELEGRAM_ID
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
