#!/bin/sh
# Ejecuta el job de correlaciones a diario (corr 12m/3m)
# Lee variables desde .env.local si existe

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Cargar .env.local si existe (KEY=VALUE sin comillas)
if [ -f ".env.local" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^[#[:space:]]' .env.local | xargs -I{} echo {})
fi

# Defaults
APP_URL="${APP_URL:-http://localhost:3000}"

echo "[launchd] Ejecutando correlaciones en ${APP_URL}"
pnpm job:correlations

echo "[launchd] Correlaciones finalizado"


