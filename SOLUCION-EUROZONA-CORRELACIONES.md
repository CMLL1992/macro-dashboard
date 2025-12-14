# Solución: Eurozona y Correlaciones Faltantes

## Diagnóstico

### 1. EUROZONA - Todos los indicadores muestran "Dato pendiente"

**Causa:**
- El job `/api/jobs/ingest/european` no ha corrido en producción después de los últimos deploys
- La tabla de indicadores europeos está vacía en Turso
- Los jobs programados en `vercel.json` aún no han alcanzado su primer ciclo

**Solución:**
Ejecutar manualmente en producción:
1. `POST /api/jobs/ingest/european` - Ingesta de datos europeos
2. `POST /api/jobs/transform/indicators` - Transformación de indicadores
3. `POST /api/jobs/compute/bias` - Recalcular bias

### 2. CORRELACIONES - Faltan para índices y commodities

**Causa:**
- Los símbolos internos (SPX, NDX, SX5E, NIKKEI, WTI, COPPER) no se estaban mapeando correctamente a símbolos de Yahoo Finance
- `domain/corr-dashboard.ts` tenía un mapeo incompleto (faltaban SX5E, NIKKEI, WTI, COPPER)
- El mapeo no usaba la misma lógica que `lib/correlations/fetch.ts`

**Solución implementada:**
1. Actualizado `domain/corr-dashboard.ts` para usar la misma lógica de mapeo que `lib/correlations/fetch.ts`
2. La función `getYahooSymbol()` ahora:
   - Primero busca en `tactical-pairs.json` (ya tiene todos los símbolos correctos)
   - Luego usa un mapeo hardcoded completo como fallback
3. Añadidos todos los activos faltantes a la lista de `activos` en `getCorrelations()`

**Mapeo de símbolos (ya correcto en tactical-pairs.json):**
- SPX → `^GSPC` ✅
- NDX → `^NDX` ✅
- SX5E → `^STOXX50E` ✅
- NIKKEI → `^N225` ✅
- WTI → `CL=F` ✅
- COPPER → `HG=F` ✅

## Archivos Modificados

1. `domain/corr-dashboard.ts`
   - Añadida función `getYahooSymbol()` que usa la misma lógica que `lib/correlations/fetch.ts`
   - Actualizada `fetchAssetSeries()` para usar `getYahooSymbol()`
   - Añadidos SX5E, NIKKEI, WTI, COPPER a la lista de activos

## Próximos Pasos

### Inmediatos (en producción):

1. **Ejecutar ingesta europea:**
   ```bash
   curl -X POST https://tu-dominio.com/api/jobs/ingest/european \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

2. **Transformar indicadores:**
   ```bash
   curl -X POST https://tu-dominio.com/api/jobs/transform/indicators \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

3. **Recalcular bias:**
   ```bash
   curl -X POST https://tu-dominio.com/api/jobs/compute/bias \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

4. **Re-ejecutar correlaciones:**
   ```bash
   curl -X POST https://tu-dominio.com/api/jobs/correlations \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

### Verificación:

1. **Verificar datos europeos:**
   ```bash
   curl https://tu-dominio.com/api/debug/european-indicators
   ```
   - Debe mostrar arrays con datos, no vacíos

2. **Verificar correlaciones:**
   ```bash
   curl https://tu-dominio.com/api/debug/dashboard-data
   ```
   - Buscar `correlations.tactical`
   - Verificar que SPX, NDX, SX5E, NIKKEI, WTI, COPPER tienen `corr12m` y `corr3m` con valores (no null)

3. **Verificar dashboard:**
   - Abrir el dashboard en producción
   - Eurozona: Debe mostrar "Dato actual" y "Dato anterior" (no "Dato pendiente")
   - Correlaciones: Debe mostrar valores para todos los activos (no "—")

## Notas Importantes

- Los jobs programados en `vercel.json` correrán automáticamente según su schedule
- Después de ejecutar manualmente, los datos deberían aparecer en el dashboard
- Si después de ejecutar los jobs manualmente aún faltan datos, revisar los logs en Vercel para errores específicos


