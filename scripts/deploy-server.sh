#!/usr/bin/env bash
# Обновление магазина на сервере до последней версии из GitHub.
#   sudo bash scripts/deploy-server.sh
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only

# Ошибку в конфиге Caddy ловим до перезапуска, пока старая версия ещё работает
docker compose build --pull
docker compose run --rm --no-deps --entrypoint caddy gateway \
  validate --config /etc/caddy/Caddyfile --adapter caddyfile

docker compose up -d --remove-orphans --wait
docker compose ps

# Старые слои сборки быстро съедают диск на маленьком сервере
docker image prune -f > /dev/null
docker builder prune -f --filter until=168h > /dev/null

echo "Готово: $(git log -1 --format='%h %s')"
