#!/usr/bin/env bash
# Переключает бота на сервер: вебхук, кнопка «Начать покупки», команды и описание.
# Токен и адрес берутся из .env, на сервере не нужен Node.js — скрипт работает внутри контейнера API.
#   sudo bash scripts/configure-bot-server.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${PUBLIC_APP_URL:?В .env нет PUBLIC_APP_URL}"

docker compose run --rm --no-deps -e TELEGRAM_MINI_APP_URL="$PUBLIC_APP_URL" api \
  node scripts/configure-telegram-bot.mjs
