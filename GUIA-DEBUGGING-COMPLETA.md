# 🔍 Guía Completa de Debugging - Por qué no se actualizan los datos

## 📋 Checklist de Verificación

### 1. Verificar Variables de Entorno en Vercel

**Ve a:** Vercel Dashboard → Tu proyecto → Settings → Environment Variables

**Verifica que existan estos valores (PRODUCTION):**

```
APP_URL = https://macro-dashboard-seven.vercel.app
CRON_TOKEN = cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
INGEST_KEY = cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
FRED_API_KEY = ccc90330e6a50afa217fb55ac48c4d28
```

**Opcionales (si quieres usar esas fuentes):**
```
FMP_API_KEY = (tu key de Financial Modeling Prep)
FINNHUB_API_KEY = (tu key de Finnhub)
NEWSAPI_KEY = (tu key de NewsAPI)
TRADING_ECONOMICS_API_KEY = (tu key de Trading Economics, opcional)
```

### 2. Verificar Secrets en GitHub Actions

**Ve a:** https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions

**Verifica que existan los mismos nombres con los mismos valores:**

- `APP_URL` → **DEBE SER IDÉNTICO** al de Vercel
- `CRON_TOKEN` → **DEBE SER IDÉNTICO** al de Vercel
- `INGEST_KEY` → **DEBE SER IDÉNTICO** al de Vercel
- `FRED_API_KEY` → **DEBE SER IDÉNTICO** al de Vercel

**⚠️ CRÍTICO:** Si los valores no coinciden exactamente:
- Los workflows se ejecutarán "exitosamente" en GitHub
- Pero las llamadas a la API devolverán 401 Unauthorized
- Los datos NO se escribirán en la base de datos

### 3. Verificar que los Workflows Llaman a la URL Correcta

**Ejecuta manualmente los workflows:**

1. **Daily Macro Jobs:**
   - https://github.com/CMLL1992/macro-dashboard/actions/workflows/daily-jobs.yml
   - Click en "Run workflow" → "Run workflow"

2. **News & Calendar Ingest:**
   - https://github.com/CMLL1992/macro-dashboard/actions/workflows/news-calendar-ingest.yml
   - Click en "Run workflow" → "Run workflow"

**Revisa los logs de cada step:**

#### Para Daily Macro Jobs:

**Step "Ingest FRED":**
```bash
# Busca en los logs:
curl -sS -X POST -H "Authorization: Bearer $CRON_TOKEN" "${APP_URL}/api/jobs/ingest/fred"

# Debe devolver algo como:
{"success":true,"ingested":14,"errors":0,"duration_ms":5000}
```

**Si ves:**
- `401 Unauthorized` → CRON_TOKEN incorrecto
- `404 Not Found` → APP_URL incorrecto
- `500 Internal Server Error` → Problema en el servidor (revisa logs de Vercel)

**Step "Correlations":**
```bash
# Debe devolver:
{"success":true,"processed":10,"updatedPairsCount":10}
```

**Step "Compute Bias":**
```bash
# Debe devolver:
{"success":true,"computed":9}
```

#### Para News & Calendar Ingest:

**Step "Debug environment":**
- Verifica que todas las variables muestren "YES"
- Si alguna muestra "NO", esa fuente no funcionará

**Step "Run all sources ingestion script":**
- Busca líneas como:
  - `✅ [RSS News] Completed successfully`
  - `✅ [FRED Calendar] Completed successfully`
  - `📅 Total Calendar: X inserted, Y skipped`
  - `📰 Total News: X inserted, Y skipped`

### 4. Verificar Estado de los Datos

**Opción A: Usar el script de verificación**

```bash
APP_URL="https://macro-dashboard-seven.vercel.app" \
pnpm tsx scripts/check-data-status.ts
```

**Opción B: Llamar directamente a /api/health**

```bash
curl https://macro-dashboard-seven.vercel.app/api/health
```

**Debe devolver algo como:**
```json
{
  "hasData": true,
  "observationCount": 5000,
  "biasCount": 15,
  "correlationCount": 20,
  "latestDate": "2025-11-12"
}
```

**Interpretación:**

- `observationCount: 0` → Los endpoints `/api/jobs/ingest/fred` no están ingiriendo
  - Verifica: CRON_TOKEN, FRED_API_KEY, APP_URL
- `biasCount: 0` → No se ha calculado bias
  - Ejecuta: `/api/jobs/compute/bias`
- `correlationCount: 0` → No se han calculado correlaciones
  - Ejecuta: `/api/jobs/correlations`
- `latestDate` muy antigua (>7 días) → Los datos están desactualizados
  - Ejecuta los workflows manualmente

### 5. Verificar que el Dashboard Llama a la API Correcta

El dashboard (`/dashboard`) llama a `/api/bias` usando `APP_URL`.

**Problema común:** Si `APP_URL` en Vercel apunta a otra URL (ej: `localhost:3000`), el dashboard no verá los datos.

**Solución:** Asegúrate de que `APP_URL` en Vercel sea exactamente:
```
https://macro-dashboard-seven.vercel.app
```

### 6. Debugging de Errores Específicos

#### Error 401 Unauthorized

**Causa:** Token/llave incorrecta

**Solución:**
1. Verifica que `CRON_TOKEN` en GitHub sea idéntico al de Vercel
2. Verifica que `INGEST_KEY` en GitHub sea idéntico al de Vercel
3. Asegúrate de que los secrets en GitHub estén actualizados

#### Error 404 Not Found

**Causa:** APP_URL incorrecto

**Solución:**
1. Verifica que `APP_URL` en GitHub sea exactamente la URL pública de Vercel
2. Verifica que la URL sea accesible: `curl https://macro-dashboard-seven.vercel.app/api/health`

#### Error 500 Internal Server Error

**Causa:** Error en el servidor

**Solución:**
1. Revisa los logs de Vercel (Deployments → Latest → Functions → Logs)
2. Verifica que `FRED_API_KEY` sea válida
3. Verifica que la base de datos esté accesible (`/tmp/macro.db` en Vercel)

#### Workflow "Exitoso" pero Sin Datos

**Causa:** Las llamadas HTTP fallan silenciosamente

**Solución:**
1. Revisa los logs completos del workflow (no solo el resumen)
2. Busca errores en los steps individuales
3. Verifica que las respuestas JSON muestren `success: true`

### 7. Scripts de Verificación

He creado dos scripts para ayudarte:

#### `scripts/verify-config.ts`
Verifica que todas las variables estén configuradas correctamente y que los endpoints respondan.

```bash
APP_URL="https://macro-dashboard-seven.vercel.app" \
CRON_TOKEN="tu_token" \
INGEST_KEY="tu_key" \
FRED_API_KEY="tu_fred_key" \
pnpm tsx scripts/verify-config.ts
```

#### `scripts/check-data-status.ts`
Verifica el estado actual de los datos en la base de datos.

```bash
APP_URL="https://macro-dashboard-seven.vercel.app" \
pnpm tsx scripts/check-data-status.ts
```

### 8. Flujo de Datos Correcto

```
GitHub Actions Workflow
    ↓
Llama a APP_URL/api/jobs/ingest/fred (con CRON_TOKEN)
    ↓
Vercel API valida CRON_TOKEN
    ↓
Vercel API llama a FRED API (con FRED_API_KEY)
    ↓
Vercel API escribe en /tmp/macro.db
    ↓
Dashboard llama a APP_URL/api/bias
    ↓
Vercel API lee de /tmp/macro.db
    ↓
Dashboard muestra los datos
```

**Si algún paso falla, los datos no se actualizarán.**

### 9. Comandos Rápidos de Verificación

```bash
# Verificar que la API responde
curl https://macro-dashboard-seven.vercel.app/api/health

# Verificar autenticación (debe devolver 405 Method Not Allowed, no 401)
curl -X POST \
  -H "Authorization: Bearer tu_cron_token" \
  https://macro-dashboard-seven.vercel.app/api/jobs/ingest/fred

# Verificar ingesta (debe devolver 400 Bad Request sin body, no 401)
curl -X POST \
  -H "X-INGEST-KEY: tu_ingest_key" \
  https://macro-dashboard-seven.vercel.app/api/news/insert
```

### 10. Resumen de Valores Esperados

**En Vercel (Production):**
```
APP_URL = https://macro-dashboard-seven.vercel.app
CRON_TOKEN = cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
INGEST_KEY = cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82
FRED_API_KEY = ccc90330e6a50afa217fb55ac48c4d28
```

**En GitHub Secrets (Actions):**
```
APP_URL = https://macro-dashboard-seven.vercel.app (MISMO VALOR)
CRON_TOKEN = cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82 (MISMO VALOR)
INGEST_KEY = cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82 (MISMO VALOR)
FRED_API_KEY = ccc90330e6a50afa217fb55ac48c4d28 (MISMO VALOR)
```

---

**Última actualización:** 13/11/2025



