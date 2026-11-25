#!/usr/bin/env bash
# Восстановление базы из копии backup-server.sh. ЗАМЕНЯЕТ текущие данные магазина.
#   sudo bash scripts/restore-server.sh backups/db_2026-11-25_03-30.dump [backups/uploads_2026-11-25_03-30.tar.gz]
set -euo pipefail

cd "$(dirname "$0")/.."

DB_FILE="${1:-}"
UPLOADS_FILE="${2:-}"

if [[ -z "$DB_FILE" || ! -f "$DB_FILE" ]]; then
  echo "Укажите файл копии базы: sudo bash scripts/restore-server.sh backups/db_….dump [backups/uploads_….tar.gz]"
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_USER="${POSTGRES_USER:-sakura}"
DB_NAME="${POSTGRES_DB:-sakura_vape}"

echo "Текущие товары, заказы и учёт будут заменены данными из $DB_FILE."
read -r -p "Чтобы продолжить, напишите «да»: " answer
[[ "$answer" == "да" ]] || { echo "Отменено."; exit 1; }

# Сначала свежая копия текущего состояния — на случай, если восстановили не тот файл
bash scripts/backup-server.sh

docker compose stop gateway api
docker compose exec -T postgres pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$DB_FILE"

if [[ -n "$UPLOADS_FILE" ]]; then
  UPLOADS_VOLUME="$(docker volume ls -q \
    --filter label=com.docker.compose.project=sakura-vape \
    --filter label=com.docker.compose.volume=uploads)"
  docker run --rm -v "$UPLOADS_VOLUME:/dst" -v "$(cd "$(dirname "$UPLOADS_FILE")" && pwd):/src:ro" alpine:3 \
    sh -c "tar -xzf /src/$(basename "$UPLOADS_FILE") -C /dst && chown -R 1000:1000 /dst"
fi

docker compose up -d --wait
echo "Восстановлено."
