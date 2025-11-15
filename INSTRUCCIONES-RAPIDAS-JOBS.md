# 🚀 Lanzar Jobs en Producción - Guía Rápida

## Opción 1: Script TypeScript (Recomendado)

```bash
# Con token como argumento
tsx scripts/run-jobs-production.ts TU_CRON_TOKEN

# O con variable de entorno
export CRON_TOKEN="tu_token"
tsx scripts/run-jobs-production.ts
```

## Opción 2: Script Bash

```bash
./scripts/run-jobs-production.sh TU_CRON_TOKEN
```

## Opción 3: Manual con curl

```bash
CRON_TOKEN="tu_token"
BASE_URL="https://macro-dashboard-seven.vercel.app"

# 1. FRED
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$BASE_URL/api/jobs/ingest/fred"

# 2. Correlations
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$BASE_URL/api/jobs/correlations"

# 3. Bias
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  "$BASE_URL/api/jobs/compute/bias"
```

## 🔑 Obtener CRON_TOKEN

- **Vercel:** Settings → Environment Variables → Production → `CRON_TOKEN`
- **GitHub:** Settings → Secrets and variables → Actions → `CRON_TOKEN`

**IMPORTANTE:** Ambos deben tener el mismo valor.

## ✅ Verificar Resultado

Después de lanzar los jobs:

```bash
curl https://macro-dashboard-seven.vercel.app/api/health | jq '.'
```

Deberías ver:
- `hasData: true`
- `observationCount > 0`
- `biasCount > 0`
- `correlationCount > 0`
