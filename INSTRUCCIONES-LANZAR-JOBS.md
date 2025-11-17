# 📋 Instrucciones para Lanzar Jobs en Producción

## 🔑 Paso 1: Obtener CRON_TOKEN

El `CRON_TOKEN` está configurado en:
- **Vercel:** Settings → Environment Variables → Production → `CRON_TOKEN`
- **GitHub Actions:** Settings → Secrets and variables → Actions → `CRON_TOKEN`

**IMPORTANTE:** Ambos deben tener el **mismo valor**.

## 🚀 Paso 2: Lanzar los Jobs

### Opción A: Usar el script (recomendado)

```bash
# Desde el directorio raíz del proyecto
./scripts/run-jobs-production.sh TU_CRON_TOKEN_AQUI
```

O si tienes CRON_TOKEN como variable de entorno:

```bash
export CRON_TOKEN="tu_token_aqui"
./scripts/run-jobs-production.sh
```

### Opción B: Lanzar manualmente con curl

```bash
BASE_URL="https://macro-dashboard-seven.vercel.app"
CRON_TOKEN="tu_token_aqui"

# 1. Ingest FRED
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/ingest/fred"

# 2. Correlations
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/correlations"

# 3. Compute Bias
curl -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/jobs/compute/bias"
```

## 📊 Paso 3: Verificar Respuestas

Cada job debería devolver algo como:

```json
{
  "success": true,
  "ingested": 14,
  "errors": 0,
  "duration_ms": 12345,
  "finishedAt": "2025-11-14T12:00:00.000Z"
}
```

### Posibles Errores:

- **401 Unauthorized:** El CRON_TOKEN es incorrecto o no está configurado
- **500 Internal Server Error:** Error en el job (revisar logs de Vercel)
- **404 Not Found:** La ruta no existe (verificar que el deployment está actualizado)

## 🔍 Paso 4: Verificar que los Datos Entraron

Después de lanzar los jobs, verifica:

```bash
# Health check
curl https://macro-dashboard-seven.vercel.app/api/health | jq '.'

# Diagnostic
curl https://macro-dashboard-seven.vercel.app/api/diag | jq '.'
```

Deberías ver:
- `hasData: true`
- `observationCount > 0`
- `biasCount > 0`
- `correlationCount > 0`
- `latestDate` con una fecha reciente

## 🎯 Resultado Esperado

Cuando los jobs funcionen correctamente:

1. ✅ `/api/health` mostrará `hasData: true`
2. ✅ El dashboard dejará de mostrar "Inicializando datos..."
3. ✅ El dashboard mostrará datos reales (bias, correlaciones, cuadrante macro, etc.)

## 🐛 Troubleshooting

### Si los jobs devuelven 401:

1. Verifica que `CRON_TOKEN` en Vercel es exactamente igual al de GitHub
2. Verifica que no hay espacios extra al inicio/final del token
3. Verifica que estás usando `Authorization: Bearer {token}` (con espacio después de Bearer)

### Si los jobs devuelven 500:

1. Revisa los logs de Vercel para ver el error específico
2. Verifica que la base de datos está accesible (`/tmp/macro.db` en producción)
3. Verifica que las APIs externas (FRED) están funcionando

### Si los jobs terminan pero no hay datos:

1. Verifica que los jobs realmente escribieron en la BD (revisar logs)
2. Verifica que `/api/health` está leyendo de la misma BD
3. Verifica que no hay errores silenciosos en los logs

