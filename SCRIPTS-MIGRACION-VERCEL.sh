#!/bin/bash
# Scripts para Migración Segura a Vercel
# Uso: ./SCRIPTS-MIGRACION-VERCEL.sh

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Scripts de Migración a Vercel${NC}"
echo ""

# Verificar que las variables están configuradas
if [ -z "$CRON_TOKEN" ] || [ -z "$NUEVA_URL" ]; then
    echo -e "${YELLOW}⚠️  Configura las variables de entorno primero:${NC}"
    echo ""
    echo "export CRON_TOKEN='tu_token_aqui'"
    echo "export NUEVA_URL='macro-dashboard-new-xxxxx.vercel.app'"
    echo ""
    echo "Luego ejecuta este script de nuevo."
    exit 1
fi

echo -e "${GREEN}✅ Variables configuradas${NC}"
echo "CRON_TOKEN: ${CRON_TOKEN:0:10}..."
echo "NUEVA_URL: $NUEVA_URL"
echo ""

# Función para ejecutar un job y mostrar resultado
run_job() {
    local job_path=$1
    local job_name=$2
    
    echo -e "${YELLOW}Ejecutando: $job_name${NC}"
    response=$(curl -s -w "\n%{http_code}" -XPOST \
        -H "Authorization: Bearer $CRON_TOKEN" \
        "https://$NUEVA_URL$job_path")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✅ $job_name: OK${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ $job_name: Error HTTP $http_code${NC}"
        echo "$body"
    fi
    echo ""
}

# Ejecutar jobs en orden
echo -e "${GREEN}📦 Ejecutando jobs de ingest...${NC}"
echo ""

run_job "/api/jobs/ingest/fred" "Ingest FRED"
sleep 2

run_job "/api/jobs/transform/indicators" "Transform Indicators"
sleep 2

run_job "/api/jobs/ingest/european" "Ingest European"
sleep 2

run_job "/api/jobs/ingest/calendar" "Ingest Calendar"
sleep 2

run_job "/api/jobs/ingest/assets" "Ingest Assets"
sleep 2

run_job "/api/jobs/correlations" "Correlations"
sleep 2

run_job "/api/jobs/compute/bias" "Compute Bias"
sleep 2

echo -e "${GREEN}✅ Todos los jobs ejecutados${NC}"
echo ""

# Verificar health
echo -e "${GREEN}🏥 Verificando health checks...${NC}"
echo ""

health_response=$(curl -s "https://$NUEVA_URL/api/health")
health_db_response=$(curl -s "https://$NUEVA_URL/api/health/db")

echo "Health General:"
echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
echo ""

echo "Health DB:"
echo "$health_db_response" | jq '.' 2>/dev/null || echo "$health_db_response"
echo ""

# Verificar indicadores críticos
echo -e "${GREEN}📊 Verificando indicadores críticos...${NC}"
echo ""

dashboard_data=$(curl -s "https://$NUEVA_URL/api/dashboard")
gdp_qoq=$(echo "$dashboard_data" | jq '.data.indicators[] | select(.key == "gdp_qoq")' 2>/dev/null)
nfp_delta=$(echo "$dashboard_data" | jq '.data.indicators[] | select(.key == "payems_delta")' 2>/dev/null)

echo "GDP QoQ:"
echo "$gdp_qoq" | jq '{key, value, date}' 2>/dev/null || echo "$gdp_qoq"
echo ""

echo "NFP Delta:"
echo "$nfp_delta" | jq '{key, value, date}' 2>/dev/null || echo "$nfp_delta"
echo ""

# Verificar correlaciones
echo -e "${GREEN}🔗 Verificando correlaciones...${NC}"
echo ""

correlations=$(curl -s "https://$NUEVA_URL/api/correlations")
corr_count=$(echo "$correlations" | jq 'length' 2>/dev/null || echo "0")
corr_with_data=$(echo "$correlations" | jq '[.[] | select(.corr12m != null or .corr3m != null)] | length' 2>/dev/null || echo "0")

echo "Total correlaciones: $corr_count"
echo "Con datos: $corr_with_data"
echo ""

echo -e "${GREEN}✅ Verificación completada${NC}"
echo ""
echo "Próximos pasos:"
echo "1. Verificar que los valores son correctos"
echo "2. Abrir https://$NUEVA_URL/dashboard en el navegador"
echo "3. Verificar que el dashboard carga sin errores"
echo "4. Continuar con la migración del dominio (si aplica)"
