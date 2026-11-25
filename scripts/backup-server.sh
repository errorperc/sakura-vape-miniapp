#!/usr/bin/env bash
# Резервная копия магазина на сервере: база PostgreSQL и фото из админки.
#   sudo bash scripts/backup-server.sh            — сделать копию в ./backups
#   BACKUP_DIR=/mnt/disk KEEP_DAYS=30 sudo bash scripts/backup-server.sh
# Копии старше KEEP_DAYS дней удаляются. Для ежедневного запуска см. docs/DEPLOY.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_USER="${POSTGRES_USER:-sakura}"
DB_NAME="${POSTGRES_DB:-sakura_vape}"
BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F_%H-%M)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# База: формат pg_dump -Fc сжат и восстанавливается через pg_restore (см. restore-server.sh)
DB_FILE="$BACKUP_DIR/db_$STAMP.dump"
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DB_FILE.part"
mv "$DB_FILE.part" "$DB_FILE"

# Фото из админки лежат в отдельном томе Docker
UPLOADS_VOLUME="$(docker volume ls -q \
  --filter label=com.docker.compose.project=sakura-vape \
  --filter label=com.docker.compose.volume=uploads)"
if [[ -n "$UPLOADS_VOLUME" ]]; then
  docker run --rm -v "$UPLOADS_VOLUME:/src:ro" -v "$BACKUP_DIR:/dst" alpine:3 \
    tar -czf "/dst/uploads_$STAMP.tar.gz" -C /src .
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db_*.dump' -o -name 'uploads_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "Копия готова: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
