#!/usr/bin/env bash
# Перенос магазина с компьютера на сервер: загружает data/export.json и фото из data/uploads.
# Запускать один раз, на ПУСТОЙ базе: после первого `docker compose up`, без `db:seed`.
#   sudo bash scripts/import-to-server.sh [data/export.json]
set -euo pipefail

cd "$(dirname "$0")/.."

FILE="${1:-data/export.json}"
if [[ ! -f "$FILE" ]]; then
  echo "Нет файла $FILE. Скопируйте его с компьютера: scp data/export.json user@IP:/opt/sakura-vape/data/"
  exit 1
fi

# Фото из админки — в том uploads, владелец node (uid 1000), иначе API не сможет дописывать новые
if [[ -d data/uploads ]]; then
  UPLOADS_VOLUME="$(docker volume ls -q \
    --filter label=com.docker.compose.project=sakura-vape \
    --filter label=com.docker.compose.volume=uploads)"
  if [[ -z "$UPLOADS_VOLUME" ]]; then
    echo "Том для фото ещё не создан: сначала запустите sudo docker compose up -d --build --wait"
    exit 1
  fi
  docker run --rm -v "$UPLOADS_VOLUME:/dst" -v "$PWD/data/uploads:/src:ro" alpine:3 \
    sh -c 'cp -a /src/. /dst/ && chown -R 1000:1000 /dst'
  echo "Фото скопированы."
fi

docker compose run --rm --no-deps -v "$PWD/$FILE:/tmp/export.json:ro" api \
  node scripts/data-transfer.mjs import /tmp/export.json
