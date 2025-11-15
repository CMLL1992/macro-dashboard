#!/bin/bash

# Script para lanzar los jobs de ingesta en producción
# Uso: ./scripts/run-jobs-production.sh [CRON_TOKEN]

set -e

BASE_URL="https://macro-dashboard-seven.vercel.app"
CRON_TOKEN="${1:-${CRON_TOKEN}}"

if [ -z "$CRON_TOKEN" ]; then
  echo "❌ Error: CRON_TOKEN no proporcionado"
  echo "Uso: $0 [CRON_TOKEN]"
  echo "O exporta CRON_TOKEN como variable de entorno"
  exit 1
fi

echo "🚀 Lanzando jobs en producción: $BASE_URL"
echo ""

# 1. Job: Ingest FRED
echo "📊 1. Lanzando /api/jobs/ingest/fred..."
RESPONSE_FRED=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/ingest/fred")

HTTP_CODE_FRED=$(echo "$RESPONSE_FRED" | tail -n1)
BODY_FRED=$(echo "$RESPONSE_FRED" | sed '$d')

echo "   Status: $HTTP_CODE_FRED"
echo "   Response: $BODY_FRED"
echo ""

# 2. Job: Correlations
echo "📈 2. Lanzando /api/jobs/correlations..."
RESPONSE_CORR=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/correlations")

HTTP_CODE_CORR=$(echo "$RESPONSE_CORR" | tail -n1)
BODY_CORR=$(echo "$RESPONSE_CORR" | sed '$d')

echo "   Status: $HTTP_CODE_CORR"
echo "   Response: $BODY_CORR"
echo ""

# 3. Job: Compute Bias
echo "🎯 3. Lanzando /api/jobs/compute/bias..."
RESPONSE_BIAS=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/compute/bias")

HTTP_CODE_BIAS=$(echo "$RESPONSE_BIAS" | tail -n1)
BODY_BIAS=$(echo "$RESPONSE_BIAS" | sed '$d')

echo "   Status: $HTTP_CODE_BIAS"
echo "   Response: $BODY_BIAS"
echo ""

# Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 RESUMEN:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$HTTP_CODE_FRED" = "200" ]; then
  echo "✅ /api/jobs/ingest/fred: OK"
else
  echo "❌ /api/jobs/ingest/fred: Error $HTTP_CODE_FRED"
fi

if [ "$HTTP_CODE_CORR" = "200" ]; then
  echo "✅ /api/jobs/correlations: OK"
else
  echo "❌ /api/jobs/correlations: Error $HTTP_CODE_CORR"
fi

if [ "$HTTP_CODE_BIAS" = "200" ]; then
  echo "✅ /api/jobs/compute/bias: OK"
else
  echo "❌ /api/jobs/compute/bias: Error $HTTP_CODE_BIAS"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar estado después
echo "🔍 Verificando estado después de los jobs..."
echo ""

echo "📊 /api/health:"
curl -s "$BASE_URL/api/health" | jq '.' || echo "Error al parsear JSON"
echo ""

echo "🔬 /api/diag:"
curl -s "$BASE_URL/api/diag" | jq '.' || echo "Error al parsear JSON"
echo ""

