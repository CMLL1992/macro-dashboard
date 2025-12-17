#!/bin/bash
# Script para testear ingesta de USPMI y capturar logs

set -e

echo "=========================================="
echo "Test USPMI Ingestion"
echo "=========================================="
echo ""

# Cargar variables de entorno
if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
    echo "✅ Variables de entorno cargadas"
else
    echo "❌ .env.local no encontrado"
    exit 1
fi

echo ""
echo "1️⃣ Ejecutando ingesta de USPMI..."
echo "   (Observa los logs del servidor en la otra terminal)"
echo ""

# Ejecutar ingesta con timeout
RESPONSE=$(curl -s -w "\n%{http_code}" -m 130 -X POST \
  "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
  -H "Authorization: Bearer dev_local_token" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response Body:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

echo "2️⃣ Validando en BD..."
echo ""

# Validar count en BD
node - <<'NODE'
const { createClient } = require("@libsql/client");
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
(async () => {
  try {
    const r = await client.execute({
      sql: "SELECT COUNT(*) n, MIN(date) min_date, MAX(date) max_date FROM macro_observations WHERE series_id='USPMI'"
    });
    const row = r.rows[0];
    console.log("USPMI count:", row.n);
    if (row.n > 0) {
      console.log("Min date:", row.min_date);
      console.log("Max date:", row.max_date);
      console.log("✅ USPMI tiene datos!");
    } else {
      console.log("❌ USPMI está vacío");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
  process.exit(0);
})();
NODE

echo ""
echo "=========================================="
echo "✅ Test completado"
echo ""
echo "📋 Qué revisar en los logs del servidor:"
echo "   - Buscar '[alphavantage] Fetching PMI'"
echo "   - Buscar '[alphavantage] Response body preview'"
echo "   - Buscar 'Error Message' o 'Information' o 'Note'"
echo "   - Buscar '[USPMI] fetchAlphaVantagePMI result'"
echo "=========================================="
