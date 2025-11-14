#!/bin/bash

# Script para probar inserción de noticias
# Uso: ./scripts/test-insert-news.sh

APP_URL="${APP_URL:-http://localhost:3000}"
INGEST_KEY="${INGEST_KEY:-}"
CRON_TOKEN="${CRON_TOKEN:-}"

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Probando inserción de noticias..."
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
  echo "   Configura en .env.local o exporta la variable:"
  echo "   export INGEST_KEY=tu_key"
  echo "   o"
  echo "   export CRON_TOKEN=tu_token"
  echo "   export ENABLE_TELEGRAM_TESTS=true"
  exit 1
fi

# Test 1: Noticia de inflación alta
echo ""
echo "📰 Test 1: Noticia de inflación (sorpresa al alza)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/news/insert" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente": "test_cpi_001",
    "fuente": "BLS",
    "pais": "US",
    "tema": "Inflación",
    "titulo": "CPI m/m (oct) +0.5% vs esperado 0.3%",
    "impacto": "high",
    "published_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "valor_publicado": 0.5,
    "valor_esperado": 0.3,
    "resumen": "Inflación supera expectativas, presión alcista"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Noticia insertada correctamente${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Error insertando noticia (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

# Esperar un poco
sleep 2

# Test 2: Noticia de empleo
echo ""
echo "📰 Test 2: Noticia de empleo (NFP)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/news/insert" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente": "test_nfp_001",
    "fuente": "BLS",
    "pais": "US",
    "tema": "Empleo",
    "titulo": "NFP +250k vs esperado +200k",
    "impacto": "high",
    "published_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "valor_publicado": 250,
    "valor_esperado": 200,
    "resumen": "Empleo más fuerte de lo esperado"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Noticia insertada correctamente${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Error insertando noticia (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

# Esperar un poco
sleep 2

# Test 3: Noticia duplicada (no debería enviar)
echo ""
echo "📰 Test 3: Noticia duplicada (debe ser ignorada)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/news/insert" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "id_fuente": "test_cpi_001",
    "fuente": "BLS",
    "pais": "US",
    "tema": "Inflación",
    "titulo": "CPI m/m (oct) +0.5% vs esperado 0.3%",
    "impacto": "high",
    "published_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "valor_publicado": 0.5,
    "valor_esperado": 0.3
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${YELLOW}⚠️ Noticia duplicada (esperado)${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Error inesperado (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

echo ""
echo "✅ Tests completados"
echo ""
echo "💡 Verifica en Telegram que recibiste las notificaciones"
echo "💡 Revisa el estado en: $APP_URL/api/notifications/status"





