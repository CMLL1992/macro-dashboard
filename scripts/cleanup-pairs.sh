#!/bin/bash

# Script para ejecutar el job de limpieza de pares
# Elimina pares no incluidos en tactical-pairs.json de la base de datos
# Uso: ./scripts/cleanup-pairs.sh [CRON_TOKEN]

set -e

BASE_URL="https://macro-dashboard-seven.vercel.app"
CRON_TOKEN="${1:-${CRON_TOKEN}}"

if [ -z "$CRON_TOKEN" ]; then
  echo "❌ Error: CRON_TOKEN no proporcionado"
  echo "Uso: $0 [CRON_TOKEN]"
  echo "O exporta CRON_TOKEN como variable de entorno"
  exit 1
fi

echo "🧹 Ejecutando limpieza de pares en producción: $BASE_URL"
echo ""

# Job: Cleanup Pairs
echo "📊 Lanzando /api/jobs/cleanup/pairs..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/cleanup/pairs")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "   Status: $HTTP_CODE"
echo "   Response: $BODY"
echo ""

# Parse response
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Limpieza completada exitosamente"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ Error en la limpieza (Status: $HTTP_CODE)"
  echo "$BODY"
  exit 1
fi
