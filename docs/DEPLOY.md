# Выкладка Sakura Vape на сервер

Инструкция от пустого VPS до работающего магазина в Telegram. Всё запускается в Docker:
Caddy (HTTPS и сайт), API на Node.js и PostgreSQL. Node.js на сервер ставить не нужно.

## Какой нужен сервер

| | Минимум | Рекомендую на старт |
|---|---|---|
| Процессор | 1 vCPU | **2 vCPU** |
| Память | 2 GB | **2 GB** (+2 GB swap делает bootstrap) |
| Диск | 20 GB SSD | **30–40 GB NVMe** |
| Система | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Виртуализация | KVM | KVM (на OpenVZ/LXC Docker может не работать) |
| Сеть | публичный IPv4 | публичный IPv4, трафик от 1 TB |

Почему так: в работе магазин занимает около 600–800 MB памяти (Postgres до 640 MB, API до 384 MB,
Caddy до 128 MB — лимиты прописаны в `compose.yaml`). Больше всего память нужна при сборке
обновления на сервере, поэтому 1 GB не подходит. Такой сервер спокойно держит сотни заказов в день;
переходить на 4 GB стоит, когда сборка начнёт идти дольше пары минут или база вырастет до гигабайтов.

Расположение: ближе к покупателям и с доступом к Telegram (Польша, Литва, Латвия, Финляндия,
Германия, Нидерланды). Перед покупкой проверьте, что провайдер принимает вашу карту.

## 1. Домен

Мини-апп в Telegram открывается только по HTTPS, поэтому нужен домен, который указывает на IP сервера.

- **Свой домен** (рекомендую): в панели регистратора создайте A-запись `shop` → IP сервера.
  Получится `shop.ваш-домен`.
- **Без домена на старте**: адрес `203-0-113-10.sslip.io`, где цифры — IP сервера через дефис.
  Работает сразу, сертификат выдаётся автоматически. Позже можно сменить на свой домен
  (поменять `.env`, `sudo bash scripts/deploy-server.sh`, `sudo bash scripts/configure-bot-server.sh`).

## 2. Подготовка сервера

Подключитесь по SSH (`ssh root@IP`) и выполните:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/errorperc/sakura-vape-miniapp.git /opt/sakura-vape
cd /opt/sakura-vape
sudo bash scripts/bootstrap-ubuntu.sh
```

Скрипт поставит Docker, автоматические обновления безопасности и 2 GB swap.

Если репозиторий приватный, `git clone` попросит логин и пароль. Вместо пароля укажите
GitHub-токен с правом только на чтение (Settings → Developer settings → Fine-grained tokens).

Firewall — включайте только после того, как убедились, что SSH работает на порту 22:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
```

## 3. Настройки

```bash
cd /opt/sakura-vape
cp .env.production.example .env
openssl rand -hex 32   # скопируйте результат в POSTGRES_PASSWORD
nano .env
chmod 600 .env
```

Заполните домен, пароль базы, токен бота и три Telegram ID — пояснения есть в самом файле.

## 4. Первый запуск

```bash
sudo docker compose up -d --build --wait
sudo docker compose ps
```

Первая сборка занимает 3–8 минут. Все сервисы должны быть `healthy` или `running`, `migrate` — `exited (0)`.
Откройте `https://ваш-домен/api/health` в браузере: должно быть `{"status":"ok"}`.

## 5. Данные: перенести с компьютера или начать с нуля

Выберите **одно** из двух.

**Перенести то, что уже есть на компьютере** (товары, заказы, учёт, команда, фото):

```powershell
# на компьютере, в папке проекта
npm run data:export
scp -r data/export.json data/uploads root@IP:/opt/sakura-vape/data/
```

```bash
# на сервере
cd /opt/sakura-vape
sudo bash scripts/import-to-server.sh
```

**Начать с чистого каталога** (стартовые товары, цены поправите в админке):

```bash
sudo docker compose run --rm api npm run db:seed
```

Импорт работает только в пустую базу, поэтому после `db:seed` перенос уже не сделать.

## 6. Переключить бота на сервер

```bash
sudo bash scripts/configure-bot-server.sh
```

Скрипт ставит вебхук, кнопку «Начать покупки», команды и описание бота. После этого
`npm run local` на компьютере этого бота не трогает — для тестов дома заведите отдельного бота.

В `@BotFather` → ваш бот → Bot Settings → Configure Mini App укажите тот же адрес,
чтобы в профиле бота появилась большая кнопка запуска.

Проверка: откройте бота, оформите тестовый заказ — он должен прийти менеджеру.

## 7. Резервные копии

Копия базы и фото:

```bash
sudo bash scripts/backup-server.sh
```

Каждую ночь в 03:30 автоматически (копии старше 14 дней удаляются):

```bash
echo '30 3 * * * root cd /opt/sakura-vape && bash scripts/backup-server.sh >> /var/log/sakura-backup.log 2>&1' \
  | sudo tee /etc/cron.d/sakura-backup
```

Копии лежат в `/opt/sakura-vape/backups` на том же сервере — если сервер пропадёт, пропадут и они.
Раз в неделю забирайте свежую копию к себе:

```powershell
scp root@IP:/opt/sakura-vape/backups/db_*.dump D:\sakura-backups\
```

Восстановление (текущие данные заменяются, перед этим скрипт сам делает копию):

```bash
sudo bash scripts/restore-server.sh backups/db_2026-11-25_03-30.dump backups/uploads_2026-11-25_03-30.tar.gz
```

## 8. Обновление

После того как изменения попали в GitHub:

```bash
cd /opt/sakura-vape
sudo bash scripts/deploy-server.sh
```

Скрипт заберёт код, соберёт образы, проверит конфиг Caddy и перезапустит сервисы.
Пока новая версия собирается, старая продолжает работать. Новые миграции базы применяются сами.

Откат на прошлую версию:

```bash
git log --oneline -5
git checkout <прошлый-коммит>
sudo docker compose up -d --build --wait
```

Если в обновлении была миграция базы, перед откатом восстановите копию, сделанную до обновления.

## Полезные команды

```bash
sudo docker compose ps                     # состояние сервисов
sudo docker compose logs -f --tail=100 api # логи API
sudo docker compose restart api            # перезапуск API
df -h && free -h                           # диск и память
```
