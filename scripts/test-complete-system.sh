#!/bin/bash

# Script completo de pruebas del sistema de notificaciones
# Envía diferentes tipos de notificaciones a Telegram

APP_URL="${APP_URL:-http://localhost:3000}"
INGEST_KEY="${INGEST_KEY:-}"
CRON_TOKEN="${CRON_TOKEN:-}"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 PRUEBA COMPLETA DEL SISTEMA DE NOTIFICACIONES${NC}"
echo ""

# Determinar autenticación
if [ -n "$INGEST_KEY" ]; then
  AUTH_HEADER="X-INGEST-KEY: $INGEST_KEY"
  echo -e "${GREEN}✅ Usando INGEST_KEY${NC}"
elif [ -n "$CRON_TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $CRON_TOKEN"
  echo -e "${GREEN}✅ Usando CRON_TOKEN${NC}"
else
  echo -e "${RED}❌ Error: Configura INGEST_KEY o CRON_TOKEN${NC}"
  exit 1
fi

# Función helper
send_request() {
  local name=$1
  local endpoint=$2
  local data=$3
  
  echo -e "\n${YELLOW}📤 $name${NC}"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL$endpoint" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "$data")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Éxito${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    return 0
  else
    echo -e "${RED}❌ Error (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    return 1
  fi
}

# Obtener timestamp actual
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP=$(date +%s)

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRUEBA 1: NOTICIA DE IMPACTO ALTO (CPI)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

send_request "Noticia CPI - Sorpresa al alza" "/api/news/insert" "{
  \"id_fuente\": \"test_cpi_${TIMESTAMP}\",
  \"fuente\": \"BLS\",
  \"pais\": \"US\",
  \"tema\": \"Inflación\",
  \"titulo\": \"CPI m/m (nov) +0.6% vs esperado +0.3% - Sorpresa alcista\",
  \"impacto\": \"high\",
  \"published_at\": \"$NOW\",
  \"valor_publicado\": 0.6,
  \"valor_esperado\": 0.3,
  \"resumen\": \"La inflación mensual supera ampliamente las expectativas, indicando presión alcista persistente en los precios.\"
}"

sleep 3

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRUEBA 2: NOTICIA DE IMPACTO MEDIO (PMI)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

send_request "Noticia PMI - Actividad manufacturera" "/api/news/insert" "{
  \"id_fuente\": \"test_pmi_${TIMESTAMP}\",
  \"fuente\": \"S&P Global\",
  \"pais\": \"US\",
  \"tema\": \"PMI\",
  \"titulo\": \"PMI Manufacturero (nov) 52.3 vs esperado 50.5\",
  \"impacto\": \"med\",
  \"published_at\": \"$NOW\",
  \"valor_publicado\": 52.3,
  \"valor_esperado\": 50.5,
  \"resumen\": \"El sector manufacturero muestra expansión moderada, por encima de expectativas.\"
}"

sleep 3

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRUEBA 3: NOTICIA DE EMPLEO (NFP)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

send_request "Noticia NFP - Empleo fuerte" "/api/news/insert" "{
  \"id_fuente\": \"test_nfp_${TIMESTAMP}\",
  \"fuente\": \"BLS\",
  \"pais\": \"US\",
  \"tema\": \"Empleo\",
  \"titulo\": \"NFP (nov) +280k vs esperado +200k - Mercado laboral robusto\",
  \"impacto\": \"high\",
  \"published_at\": \"$NOW\",
  \"valor_publicado\": 280,
  \"valor_esperado\": 200,
  \"resumen\": \"Creación de empleo muy por encima de expectativas, señal de fortaleza del mercado laboral.\"
}"

sleep 3

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRUEBA 4: NOTICIA DE IMPACTO BAJO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

send_request "Noticia de impacto bajo" "/api/news/insert" "{
  \"id_fuente\": \"test_low_${TIMESTAMP}\",
  \"fuente\": \"Census\",
  \"pais\": \"US\",
  \"tema\": \"Ventas\",
  \"titulo\": \"Ventas al por menor (oct) +0.2% m/m\",
  \"impacto\": \"low\",
  \"published_at\": \"$NOW\",
  \"valor_publicado\": 0.2,
  \"resumen\": \"Ventas minoristas con crecimiento moderado.\"
}"

sleep 3

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRUEBA 5: EVENTO DE CALENDARIO (ALTA IMPORTANCIA)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Calcular fecha en 3 días
if [[ "$OSTYPE" == "darwin"* ]]; then
  FUTURE_DATE=$(date -v+3d +%Y-%m-%d)
else
  FUTURE_DATE=$(date -d "+3 days" +%Y-%m-%d)
fi

send_request "Evento FOMC - Reunión de política monetaria" "/api/calendar/insert" "{
  \"fecha\": \"$FUTURE_DATE\",
  \"hora_local\": \"20:00\",
  \"pais\": \"US\",
  \"tema\": \"Política Monetaria\",
  \"evento\": \"Decisión de tipos FOMC\",
  \"importancia\": \"high\",
  \"consenso\": \"Mantenimiento en 5.25-5.50%\"
}"

sleep 3

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRUEBA 6: EVENTO DE CALENDARIO (MEDIA IMPORTANCIA)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ "$OSTYPE" == "darwin"* ]]; then
  FUTURE_DATE2=$(date -v+5d +%Y-%m-%d)
else
  FUTURE_DATE2=$(date -d "+5 days" +%Y-%m-%d)
fi

send_request "Evento PPI - Índice de precios productores" "/api/calendar/insert" "{
  \"fecha\": \"$FUTURE_DATE2\",
  \"hora_local\": \"14:30\",
  \"pais\": \"US\",
  \"tema\": \"Inflación\",
  \"evento\": \"PPI m/m\",
  \"importancia\": \"med\",
  \"consenso\": \"+0.2%\"
}"

sleep 3

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}VERIFICANDO ESTADO DEL SISTEMA${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${YELLOW}📊 Estado de notificaciones:${NC}"
curl -s "$APP_URL/api/notifications/status" | jq '{
  bot_ok,
  chat_ok,
  enabled,
  currentNarrative,
  counters,
  recentNotifications: .recentNotifications[0:3]
}'

echo -e "\n${YELLOW}📊 Estado de la cola:${NC}"
curl -s "$APP_URL/api/notifications/queue/status" | jq '.'

echo -e "\n${YELLOW}📊 Métricas:${NC}"
curl -s "$APP_URL/api/metrics/prometheus" | head -30

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ PRUEBAS COMPLETADAS${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}💡 Revisa tu Telegram para ver las notificaciones${NC}"
echo -e "${BLUE}💡 Dashboard: $APP_URL/admin/dashboard${NC}"
echo -e "${BLUE}💡 Estado: $APP_URL/api/notifications/status${NC}"
echo ""





