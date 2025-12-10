#!/bin/bash

# Script para actualizar todos los datos macro y correlaciones
# Ejecuta los jobs necesarios para tener datos actualizados al día de hoy

set -e

CRON_TOKEN="${CRON_TOKEN:-dev_local_token}"
APP_URL="${APP_URL:-http://localhost:3000}"

echo "🔄 Iniciando actualización de datos..."
echo "📅 Fecha objetivo: $(date +%Y-%m-%d)"
echo ""

# 1. Actualizar datos FRED
echo "1️⃣ Actualizando datos macro desde FRED..."
FRED_RESULT=$(curl -s -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/ingest/fred" \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$FRED_RESULT" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$FRED_RESULT" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Datos FRED actualizados correctamente"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ Error actualizando FRED: HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo ""
sleep 2

# 2. Calcular correlaciones
echo "2️⃣ Calculando correlaciones..."
CORR_RESULT=$(curl -s -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/correlations" \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$CORR_RESULT" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$CORR_RESULT" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Correlaciones calculadas correctamente"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ Error calculando correlaciones: HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo ""
sleep 2

# 3. Recalcular bias
echo "3️⃣ Recalculando sesgos (bias)..."
BIAS_RESULT=$(curl -s -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$APP_URL/api/jobs/compute/bias" \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$BIAS_RESULT" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$BIAS_RESULT" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Sesgos recalculados correctamente"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ Error recalculando sesgos: HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo ""
echo "✅ ✅ ✅ Actualización completa!"
echo "📊 Todos los datos están actualizados al $(date +%Y-%m-%d)"
echo ""
echo "🌐 Puedes verificar en: $APP_URL/dashboard"
