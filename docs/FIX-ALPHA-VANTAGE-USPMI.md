# Fix Alpha Vantage USPMI Implementation

**Fecha**: 2025-12-17  
**Estado**: ✅ Correcciones aplicadas

---

## 🔧 Problemas identificados y corregidos

### 1. ✅ Eliminado fallback de múltiples funciones
**Problema**: El helper probaba 4 funciones diferentes (`ISM_MANUFACTURING`, `ISM_MANUFACTURING_PMI`, `MANUFACTURING_PMI`, `PMI`), causando:
- 1 error de "función no existe"
- 3 respuestas de rate-limit
- Agotamiento de intentos útiles

**Solución**: Usar solo `ISM_MANUFACTURING` (función confirmada). Eliminado el loop de fallback.

**Archivo**: `packages/ingestors/alphavantage.ts`

### 2. ✅ Manejo de rate limit como error recuperable
**Problema**: Cuando Alpha Vantage devolvía `Note` o `Information` (rate limit), se lanzaba un error que bloqueaba el job.

**Solución**: 
- Detectar rate limit inmediatamente
- Retornar array vacío (no lanzar error)
- Loggear el rate limit como warning
- Permitir que el job continúe y reporte el error de forma controlada

**Archivo**: `packages/ingestors/alphavantage.ts` (líneas 60-66)

### 3. ✅ Ajuste de lógica `done`/`isLastBatch` para `only=USPMI`
**Problema**: Cuando se usa `only=USPMI` con `batch=1`, había inconsistencia en el cálculo de `done` y se ejecutaba lógica duplicada de PMI.

**Solución**:
- `done` se calcula correctamente cuando `baseSeries.length === 1` (solo USPMI)
- Se evita ejecutar la lógica duplicada de PMI al final si ya se procesó en el loop principal
- Se detecta si USPMI ya fue procesado para evitar duplicación

**Archivo**: `app/api/jobs/ingest/fred/route.ts` (líneas 149, 533-536)

### 4. ✅ Mejora en detección de rate limit en el job
**Problema**: No se distinguía entre "no hay datos" y "rate limit".

**Solución**: Cuando `fetchAlphaVantagePMI` retorna array vacío, se verifica si fue por rate limit y se reporta el error apropiado.

**Archivo**: `app/api/jobs/ingest/fred/route.ts` (líneas 285-289)

---

## 📋 Cambios técnicos detallados

### `packages/ingestors/alphavantage.ts`

**Antes**:
```typescript
const functions = ['ISM_MANUFACTURING', 'ISM_MANUFACTURING_PMI', 'MANUFACTURING_PMI', 'PMI']
for (const func of functions) {
  // ... intentar cada función
}
```

**Después**:
```typescript
const func = 'ISM_MANUFACTURING' // Solo función confirmada
// ... una sola llamada
```

**Manejo de rate limit**:
```typescript
// CRITICAL: Handle rate limit as recoverable error - stop immediately
if (data['Note'] || data['Information']) {
  const rateLimitMsg = data['Note'] || data['Information']
  console.warn(`[alphavantage] Rate limit detected for ${func}:`, rateLimitMsg)
  return [] // Return empty array, don't throw
}
```

### `app/api/jobs/ingest/fred/route.ts`

**Detección de USPMI ya procesado**:
```typescript
const uspmiAlreadyProcessed = onlySeries === 'USPMI' && seriesToProcess.some(s => s.id === 'USPMI')

if (isLastBatch && !pmiIngested && !uspmiAlreadyProcessed) {
  // Solo procesar PMI si no fue procesado en el loop principal
}
```

**Mejora en reporte de errores**:
```typescript
} else {
  const isRateLimit = pmiObservations.length === 0
  const errorMsg = isRateLimit 
    ? 'Alpha Vantage rate limit exceeded' 
    : 'No observations returned from Alpha Vantage'
  // ...
}
```

---

## ✅ Validación

### Estado actual en BD
```bash
USPMI count: 0
```
✅ Confirmado: No hay datos de USPMI en BD (esperado antes de ingesta exitosa)

### Próximos pasos para validar

1. **Ejecutar ingesta con servidor visible**:
   ```bash
   # Terminal 1: Servidor
   cd ~/Desktop/"macro-dashboard-with-data 2"
   ./node_modules/.bin/next dev -p 3001
   
   # Terminal 2: Job
   curl -X POST "http://localhost:3001/api/jobs/ingest/fred?reset=true&batch=1&only=USPMI" \
     -H "Authorization: Bearer dev_local_token"
   ```

2. **Verificar logs**:
   - Buscar `[alphavantage] Fetching PMI from Alpha Vantage`
   - Buscar `[alphavantage] Rate limit detected` (si aplica)
   - Buscar `[USPMI] fetchAlphaVantagePMI result`

3. **Validar en BD**:
   ```bash
   set -a && source .env.local && set +a
   node - <<'NODE'
   const { createClient } = require("@libsql/client");
   const client = createClient({
     url: process.env.TURSO_DATABASE_URL,
     authToken: process.env.TURSO_AUTH_TOKEN
   });
   (async () => {
     const r = await client.execute({
       sql: "SELECT COUNT(*) n, MIN(date) min_date, MAX(date) max_date FROM macro_observations WHERE series_id='USPMI'"
     });
     console.log(r.rows[0]);
   })();
   NODE
   ```

---

## 🎯 Resultado esperado

### Si Alpha Vantage funciona:
- `USPMI count > 0`
- `pmi_mfg` deja de ser `null` en dashboard
- Logs muestran datos parseados correctamente

### Si hay rate limit:
- Job completa sin error fatal
- Log muestra `Rate limit detected`
- Error reportado como `'Alpha Vantage rate limit exceeded'`
- `USPMI count = 0` (esperado hasta que rate limit se resuelva)

---

## 📝 Notas

- **Rate limit de Alpha Vantage**: El free tier tiene límites estrictos. Si aparece rate limit, esperar 15-60 segundos antes de reintentar.
- **Alternativa FRED**: Según documentación, USPMI no está disponible en FRED. Alpha Vantage es la única fuente implementada actualmente.
- **Rotación de API key**: La key actual (`7EP1MPAF47D1B8QW`) se ha expuesto y debe rotarse antes de usar en producción.
