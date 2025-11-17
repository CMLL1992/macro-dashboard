#!/bin/bash

# Script para probar inserción de eventos de calendario
# Uso: ./scripts/test-insert-calendar.sh

APP_URL="${APP_URL:-http://localhost:3000}"
INGEST_KEY="${INGEST_KEY:-}"
CRON_TOKEN="${CRON_TOKEN:-}"

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📅 Probando inserción de eventos de calendario..."
echo ""

# Determinar método de autenticación
if [ -n "$INGEST_KEY" ]; then
  AUTH_HEADER="X-INGEST-KEY: $INGEST_KEY"
  echo "✅ Usando INGEST_KEY para autenticación"
elif [ -n "$CRON_TOKEN" ] && [ "$ENABLE_TELEGRAM_TESTS" = "true" ]; then
  AUTH_HEADER="Authorization: Bearer $CRON_TOKEN"
  echo "✅ Usando CRON_TOKEN para autenticación (modo dev)"
else
  echo -e "${RED}❌ Error: Necesitas configurar INGEST_KEY o CRON_TOKEN${NC}"
  exit 1
fi

# Calcular fechas (hoy + 3 días, hoy + 7 días)
TODAY=$(date +%Y-%m-%d)
DAY3=$(date -v+3d +%Y-%m-%d 2>/dev/null || date -d "+3 days" +%Y-%m-%d)
DAY7=$(date -v+7d +%Y-%m-%d 2>/dev/null || date -d "+7 days" +%Y-%m-%d)

# Test 1: Evento de alta importancia
echo ""
echo "📅 Test 1: Evento de alta importancia (CPI)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/calendar/insert" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"fecha\": \"$DAY3\",
    \"hora_local\": \"14:30\",
    \"pais\": \"US\",
    \"tema\": \"Inflación\",
    \"evento\": \"CPI m/m\",
    \"importancia\": \"high\",
    \"consenso\": \"0.3%\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Evento insertado correctamente${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Error insertando evento (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

# Test 2: Evento de importancia media
echo ""
echo "📅 Test 2: Evento de importancia media (NFP)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/calendar/insert" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"fecha\": \"$DAY7\",
    \"hora_local\": \"14:30\",
    \"pais\": \"US\",
    \"tema\": \"Empleo\",
    \"evento\": \"NFP\",
    \"importancia\": \"med\",
    \"consenso\": \"+200k\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Evento insertado correctamente${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Error insertando evento (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

# Test 3: Evento de baja importancia (no debería aparecer en weekly)
echo ""
echo "📅 Test 3: Evento de baja importancia"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/calendar/insert" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"fecha\": \"$DAY3\",
    \"hora_local\": \"16:00\",
    \"pais\": \"US\",
    \"tema\": \"Otros\",
    \"evento\": \"Beige Book\",
    \"importancia\": \"low\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Evento insertado correctamente${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Error insertando evento (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

echo ""
echo "✅ Tests completados"
echo ""
echo "💡 Los eventos de alta/media importancia aparecerán en la previa semanal"
echo "💡 Prueba ejecutar: curl -X POST $APP_URL/api/jobs/weekly -H \"Authorization: Bearer \$CRON_TOKEN\""





