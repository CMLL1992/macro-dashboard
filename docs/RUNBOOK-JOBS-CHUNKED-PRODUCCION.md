# 🚀 RUNBOOK PRODUCCIÓN — Jobs Chunked (FRED / Assets / Bias)

## 📋 Pre-requisitos

### 0) Pre-check (antes de tocar nada)

**Confirmar que el deploy en Vercel incluye el commit `f1be7d5`:**
- ✅ Tabla `job_state` en `scripts/migrate-turso.ts`
- ✅ Batch upsert en `lib/db/upsert-asset-prices-batch.ts`
- ✅ Batch size default 2 en `app/api/jobs/ingest/assets/route.ts`
- ✅ Guardrails en `lib/db/job-state.ts`

**Verificar en logs de Vercel:**
```
[db] Using Turso database: env: 'production'
```

Si no aparece este log, verificar variables de entorno:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

---

## 🔧 PASO 1: Crear tabla `job_state` en Turso PROD (BLOQUEANTE)

### Opción A: Script de migración (Recomendada)

```bash
# Desde el repo local (con .env.local configurado)
pnpm db:migrate:turso
```

**Requisitos:**
- `.env.local` con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`
- Acceso a la base de datos de producción

**Salida esperada:**
```
🚀 Iniciando migración de Turso...
✅ Conexión a Turso establecida
📋 Creando tablas e índices...
   ✅ CREATE TABLE job_state
   ✅ CREATE INDEX idx_job_state_updated_at
✅ Migración de Turso completada exitosamente
```

### Opción B: SQL manual en Turso

Si no puedes ejecutar el script, ejecuta directamente en Turso:

```sql
CREATE TABLE IF NOT EXISTS job_state (
  job_name TEXT PRIMARY KEY,
  cursor TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_run_status TEXT,
  last_run_duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_job_state_updated_at ON job_state(updated_at);
```

### Verificación (OBLIGATORIA)

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='job_state';
```

**Resultado esperado:**
```
job_state
```

Si no aparece, la tabla no se creó. Reintentar paso 1.

---

## ⚙️ PASO 2: Ajustar crons (Opcional pero recomendado)

### Para backfill rápido (cada 10 minutos)

Editar `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/jobs/ingest/fred?batch=10", "schedule": "*/10 * * * *" },
    { "path": "/api/jobs/transform/indicators", "schedule": "30 6 * * *" },
    { "path": "/api/jobs/ingest/european", "schedule": "0 7 * * *" },
    { "path": "/api/jobs/ingest/calendar", "schedule": "0 8 * * *" },
    { "path": "/api/jobs/daily/calendar", "schedule": "0 8 * * *" },
    { "path": "/api/jobs/ingest/assets?batch=2", "schedule": "*/10 * * * *" },
    { "path": "/api/jobs/correlations", "schedule": "30 9 * * *" },
    { "path": "/api/jobs/compute/bias?batch=5", "schedule": "*/10 * * * *" },
    { "path": "/api/jobs/weekly", "schedule": "0 18 * * 0" }
  ]
}
```

**Nota:** Los horarios `*/10 * * * *` (cada 10 minutos) son solo para backfill rápido. Una vez completado, volver a horarios normales (diarios).

### Horarios normales (después del backfill)

```json
{
  "crons": [
    { "path": "/api/jobs/ingest/fred?batch=10", "schedule": "0 6 * * *" },
    { "path": "/api/jobs/ingest/assets?batch=2", "schedule": "0 9 * * *" },
    { "path": "/api/jobs/compute/bias?batch=5", "schedule": "0 10 * * *" }
  ]
}
```

---

## 🎯 PASO 3: Ejecución manual (orden correcto)

### 3.1 FRED (Primero)

⚠️ **Advertencia sobre `reset=true`:** Este parámetro elimina el cursor guardado y reinicia el job desde el principio. Usar solo para backfill completo o debugging. Si el job ya está en progreso, omitir `reset=true` y usar solo `cursor=<NEXT_CURSOR>` para continuar.

**Reset y arrancar desde cero:**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/jobs/ingest/fred?batch=10&reset=true" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "job": "ingest_fred",
  "processed": 10,
  "nextCursor": "PERMIT",
  "done": false,
  "durationMs": 45231
}
```

**Si `done: false`, continuar con el cursor:**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/jobs/ingest/fred?batch=10&cursor=PERMIT" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Repetir hasta `done: true`.**

**Qué mirar en logs de Vercel:**
- ✅ `Starting batch: 10 series starting from index 0`
- ✅ `Processing batch: 10 series starting from index 0`
- ✅ `Saved cursor ... done:false` (si corta por tiempo)
- ✅ `FRED ingestion batch completed ... done:true` (final)
- ❌ NO debe aparecer: `Task timed out after 300 seconds`

**Tiempo esperado por batch:** < 240s

---

### 3.2 Assets (Segundo, después de FRED)

⚠️ **Advertencia sobre `reset=true`:** Este parámetro elimina el cursor guardado y reinicia el job desde el principio. Usar solo para backfill completo o debugging. Si el job ya está en progreso, omitir `reset=true` y usar solo `cursor=<NEXT_CURSOR>` para continuar.

**Reset:**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/jobs/ingest/assets?batch=2&reset=true" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Continuación:**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/jobs/ingest/assets?batch=2&cursor=DXY" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Repetir hasta `done: true`.**

**Qué mirar en logs:**
- ✅ `Processing batch: 2 assets starting from index 0`
- ✅ `upsertAssetPricesBatch` (batch inserts, no loops uno-por-uno)
- ✅ `Hard limit reached before upsert` (si corta antes de upsert)
- ✅ `Asset prices ingestion batch completed ... done:true`
- ✅ Duración < 240s por batch
- ❌ NO debe aparecer: `Task timed out after 300 seconds`

**Tiempo esperado por batch:** < 120s (con batch size 2)

---

### 3.3 Bias (Tercero, cuando FRED+Assets estén OK)

**Reset:**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/jobs/compute/bias?batch=5&reset=true" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Continuación:**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/jobs/compute/bias?batch=5&cursor=EURUSD" \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**Repetir hasta `done: true`.**

**Qué mirar en logs:**
- ✅ `Starting bias computation ... batchSize: 5`
- ✅ `Bias computation batch completed ... done:false` (batches intermedios)
- ✅ `Bias computation batch completed ... done:true` (último batch)
- ✅ `Skipping post-processing (alerts, snapshots) - not last batch` (batches intermedios)
- ✅ `Revalidate dashboard` (solo en último batch)
- ❌ NO debe aparecer: `Task timed out after 300 seconds`

**Importante:**
- Post-processing (alerts, snapshots, revalidate) solo se ejecuta cuando `done: true`
- Esto evita timeout y asegura que alerts solo se disparan una vez por ciclo completo

**Tiempo esperado por batch:** < 180s (con batch size 5)

---

## ✅ PASO 4: Verificación rápida en DB (sanity checks)

### 4.1 Confirmar que `job_state` se actualiza

```sql
SELECT 
  job_name, 
  cursor, 
  last_run_status, 
  last_run_duration_ms, 
  updated_at
FROM job_state
ORDER BY updated_at DESC;
```

**Resultado esperado:**
```
ingest_fred     | PERMIT    | partial | 45231 | 2025-01-15 10:30:00
ingest_assets   | DXY       | partial | 12345 | 2025-01-15 10:25:00
compute_bias    | null      | success | 89012 | 2025-01-15 10:20:00
```

**Cuando todos estén completos:**
```
ingest_fred     | null      | success | 45231 | 2025-01-15 10:30:00
ingest_assets   | null      | success | 12345 | 2025-01-15 10:25:00
compute_bias    | null      | success | 89012 | 2025-01-15 10:20:00
```

### 4.2 Eurozona tiene datos

```sql
SELECT 
  series_id, 
  COUNT(*) as count, 
  MAX(date) as last_date
FROM macro_observations
WHERE series_id LIKE 'EU_%'
GROUP BY series_id
ORDER BY last_date DESC
LIMIT 20;
```

**Resultado esperado:**
```
EU_CPI_YOY              | 180 | 2025-11-01
EU_GDP_QOQ              | 60  | 2025-07-01
EU_PMI_MANUFACTURING    | 240 | 2025-12-01
...
```

Si `count = 0` o `last_date` es muy antiguo, ejecutar:
```bash
POST /api/jobs/ingest/european
```

### 4.3 Assets tienen precios

```sql
SELECT 
  symbol, 
  COUNT(*) as count, 
  MAX(date) as last_date
FROM asset_prices
WHERE symbol IN ('DXY', 'EURUSD', 'GBPUSD', 'SPX', 'BTCUSD')
GROUP BY symbol
ORDER BY last_date DESC;
```

**Resultado esperado:**
```
DXY     | 1825 | 2025-01-15
EURUSD  | 1825 | 2025-01-15
SPX     | 1825 | 2025-01-15
...
```

### 4.4 Bias está calculado

```sql
SELECT 
  symbol, 
  score, 
  direction, 
  confidence, 
  computed_at
FROM macro_bias
ORDER BY computed_at DESC
LIMIT 20;
```

**Resultado esperado:**
```
EURUSD  | 0.65 | bullish | 0.78 | 2025-01-15 10:20:00
GBPUSD  | 0.42 | bullish | 0.65 | 2025-01-15 10:20:00
...
```

---

## 🐛 PASO 5: Troubleshooting rápido

### 5.1 Error: `no such table: job_state`

**Causa:** La migración NO se ejecutó en producción.

**Solución:**
1. Verificar que `.env.local` tiene `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` correctos
2. Ejecutar: `pnpm db:migrate:turso`
3. Verificar con: `SELECT name FROM sqlite_master WHERE type='table' AND name='job_state';`

**Nota:** Los jobs NO se romperán aunque falte la tabla (guardrails implementados), pero no podrán usar continuation.

---

### 5.2 Error: `504 Gateway Timeout` / `Task timed out after 300 seconds` en Assets

**Causa:** El job aún excede 300s a pesar de batch mode.

**Soluciones inmediatas:**

**A) Reducir batch size:**
```bash
POST /api/jobs/ingest/assets?batch=1
```

**B) Verificar que deadline checks están activos:**
En logs debe aparecer:
- `Hard limit reached, stopping batch processing` (si corta por tiempo)
- `Hard limit reached before upsert for SYMBOL` (si corta antes de upsert)

**C) Verificar que batch upsert está funcionando:**
En logs debe aparecer:
- `upsertAssetPricesBatch` (no loops `for (const price of prices)`)

**D) Añadir timeout a requests de Yahoo (si hace falta):**
Si los fetches de Yahoo se cuelgan, añadir timeout:
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
const res = await fetch(url, { signal: controller.signal })
clearTimeout(timeoutId)
```

---

### 5.3 El job repite siempre el mismo cursor

**Causa:** `saveJobState()` no se está ejecutando o falla silenciosamente.

**Diagnóstico:**

1. **Verificar que `saveJobState()` se llama:**
   En logs debe aparecer:
   ```
   Saved job state for ingest_fred ... cursor: PERMIT ... done:false
   ```

2. **Verificar que se guarda en DB:**
   ```sql
   SELECT * FROM job_state WHERE job_name = 'ingest_fred';
   ```
   Debe mostrar el cursor actualizado.

3. **Si no se guarda:**
   - Verificar que la tabla existe (paso 1)
   - Verificar permisos de escritura en Turso
   - Revisar logs de `saveJobState()` para errores

4. **Si el cursor no avanza:**
   - Verificar que `nextCursor = series.id` se ejecuta después de cada serie procesada
   - Verificar que no hay `break` prematuro que evite actualizar el cursor

---

### 5.4 Assets sigue dando timeout incluso con batch=1

**Causa:** Un solo asset está tomando > 300s (probablemente fetch de Yahoo o upsert masivo).

**Soluciones:**

**A) Verificar qué asset está causando el problema:**
En logs, buscar:
```
Ingesting SYMBOL ...
Hard limit reached before upsert for SYMBOL
```

**B) Añadir timeout a fetch de Yahoo:**
```typescript
// En fetchYahooOHLCV
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000) // 30s
try {
  const r = await fetch(url, { 
    signal: controller.signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    cache: 'no-store',
  })
  clearTimeout(timeout)
  // ...
} catch (error) {
  clearTimeout(timeout)
  if (error.name === 'AbortError') {
    logger.warn(`Yahoo fetch timeout for ${symbol}`)
    return []
  }
  throw error
}
```

**C) Reducir periodo de datos históricos:**
Cambiar de `5y` a `2y` o `1y`:
```typescript
const prices = await fetchYahooOHLCV(yahooSymbol, '2y') // En vez de '5y'
```

---

## 📊 Resultado esperado final

### ✅ Criterios de éxito

1. **FRED/Assets/Bias ejecutan en < 240s por llamada**
   - Verificar en logs: `durationMs: 45231` (< 240000)

2. **No hay 504**
   - Verificar en logs de Vercel: NO debe aparecer `Task timed out after 300 seconds`

3. **`job_state` tiene cursor actualizado y finalmente `done: true`**
   ```sql
   SELECT job_name, cursor, last_run_status FROM job_state;
   ```
   Debe mostrar `cursor: null` y `last_run_status: 'success'` cuando esté completo.

4. **Dashboards Eurozona/Global muestran datos actualizados**
   - Verificar en producción: `/dashboard`
   - Indicadores de Eurozona con valores (no "Dato pendiente")
   - Correlaciones pobladas (no "—")

---

## 🔄 Mantenimiento continuo

### Monitoreo diario

**Verificar estado de jobs:**
```sql
SELECT 
  job_name,
  cursor,
  last_run_status,
  last_run_duration_ms,
  updated_at
FROM job_state
WHERE updated_at > datetime('now', '-1 day')
ORDER BY updated_at DESC;
```

**Si algún job tiene `cursor != null` y `last_run_status = 'partial'`:**
- El job no terminó completamente
- Ejecutar manualmente con el cursor para continuar

### Ajustar batch sizes según necesidad

**Si los jobs terminan muy rápido (< 60s):**
- Aumentar batch size para reducir número de ejecuciones
- FRED: `batch=15` o `batch=20`
- Assets: `batch=3` o `batch=4`
- Bias: `batch=8` o `batch=10`

**Si los jobs aún dan timeout:**
- Reducir batch size
- FRED: `batch=5`
- Assets: `batch=1`
- Bias: `batch=3`

---

## 📝 Checklist final

- [ ] Tabla `job_state` creada en Turso (verificación SQL)
- [ ] Deploy `f1be7d5` en producción (verificar en Vercel)
- [ ] FRED ejecutado completamente (`done: true`)
- [ ] Assets ejecutado completamente (`done: true`)
- [ ] Bias ejecutado completamente (`done: true`)
- [ ] No hay errores 504 en logs
- [ ] `job_state` muestra `cursor: null` para todos los jobs
- [ ] Dashboard muestra datos de Eurozona
- [ ] Dashboard muestra correlaciones

---

## 🆘 Contacto / Escalación

Si después de seguir este runbook los problemas persisten:

1. **Revisar logs completos de Vercel** (últimas 24h)
2. **Verificar estado de `job_state` en DB**
3. **Ejecutar jobs manualmente con batch=1** para identificar el problema específico
4. **Revisar documentación:** `docs/MIGRACION-JOB-STATE.md`

---

**Última actualización:** 2025-01-15
**Versión:** 1.0
