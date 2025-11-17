#!/bin/bash

# Script para forzar actualización inmediata de todos los datos
# Ejecuta los endpoints directamente en Vercel

APP_URL="https://macro-dashboard-seven.vercel.app"
CRON_TOKEN="cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82"

echo "🔄 Forzando actualización de datos..."
echo "📍 URL: $APP_URL"
echo ""

# 1. Actualizar datos FRED
echo "📊 Paso 1: Actualizando datos FRED..."
FRED_RESULT=$(curl -sS -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$APP_URL/api/jobs/ingest/fred")

if echo "$FRED_RESULT" | grep -q '"ok":true'; then
  UPDATED=$(echo "$FRED_RESULT" | grep -o '"updatedSeriesCount":[0-9]*' | grep -o '[0-9]*')
  echo "✅ Datos FRED actualizados: $UPDATED series"
else
  echo "❌ Error actualizando FRED: $FRED_RESULT"
fi

echo ""
sleep 2

# 2. Calcular correlaciones
echo "🔗 Paso 2: Calculando correlaciones..."
CORR_RESULT=$(curl -sS -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$APP_URL/api/jobs/correlations")

if echo "$CORR_RESULT" | grep -q '"ok":true'; then
  UPDATED=$(echo "$CORR_RESULT" | grep -o '"updatedPairsCount":[0-9]*' | grep -o '[0-9]*')
  echo "✅ Correlaciones calculadas: $UPDATED pares"
else
  echo "❌ Error calculando correlaciones: $CORR_RESULT"
fi

echo ""
sleep 2

# 3. Calcular bias
echo "📈 Paso 3: Calculando bias macro..."
BIAS_RESULT=$(curl -sS -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$APP_URL/api/jobs/compute/bias")

if echo "$BIAS_RESULT" | grep -q '"ok":true'; then
  echo "✅ Bias macro calculado"
else
  echo "❌ Error calculando bias: $BIAS_RESULT"
fi

echo ""
echo "=" | tr -d '\n' | head -c 50
echo ""
echo "✅ Actualización completada!"
echo ""
echo "📅 Verifica el dashboard en: $APP_URL/dashboard"
echo "   El timestamp 'Actualizado' debería mostrar la fecha/hora actual"



