#!/bin/bash
# Script para ejecutar jobs de ingesta manualmente
# Uso: ./scripts/ejecutar-jobs-manual.sh

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que CRON_TOKEN esté configurado
if [ -z "$CRON_TOKEN" ]; then
  echo -e "${RED}Error: CRON_TOKEN no está configurado${NC}"
  echo "Ejecuta: export CRON_TOKEN='tu-token'"
  exit 1
fi

# Verificar que APP_URL esté configurado
if [ -z "$APP_URL" ]; then
  echo -e "${RED}Error: APP_URL no está configurado${NC}"
  echo "Ejecuta: export APP_URL='https://tu-app.vercel.app' o 'http://localhost:3000'"
  exit 1
fi

echo -e "${GREEN}🚀 Ejecutando jobs de ingesta manualmente...${NC}"
echo "APP_URL: $APP_URL"
echo ""

# Función helper para ejecutar un job
run_job() {
  local job_name=$1
  local endpoint=$2
  
  echo -e "${YELLOW}📥 Ejecutando: $job_name${NC}"
  response=$(curl -sS -X POST \
    -H "Authorization: Bearer $CRON_TOKEN" \
    -H "Content-Type: application/json" \
    "$APP_URL$endpoint")
  
  if [ $? -eq 0 ]; then
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
  else
    echo -e "${RED}❌ Error ejecutando $job_name${NC}"
    echo ""
  fi
}

# 1. UK (GBP)
run_job "UK Indicators (GBP)" "/api/jobs/ingest/uk"

# 2. JP (JPY)
run_job "Japan Indicators (JPY)" "/api/jobs/ingest/jp"

# 3. AU (AUD)
run_job "Australia Indicators (AUD)" "/api/jobs/ingest/au"

# 4. FRED (USD)
run_job "FRED Indicators (USD)" "/api/jobs/ingest/fred"

# 5. European (EUR)
run_job "European Indicators (EUR)" "/api/jobs/ingest/european"

echo -e "${GREEN}✅ Jobs ejecutados. Revisa los logs arriba para verificar inserts.${NC}"
echo ""
echo "Próximos pasos:"
echo "1. Verifica que los jobs hayan insertado datos (revisa 'ingested' en la respuesta)"
echo "2. Ejecuta: /api/jobs/compute/bias para recalcular regímenes"
echo "3. Verifica el dashboard para ver si GBP/JPY/AUD ya tienen regímenes calculados"
