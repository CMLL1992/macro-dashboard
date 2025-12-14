# Solución Implementada: Eurozona y Correlaciones

## Cambios Implementados

### 1️⃣ EUROZONA - Centralización de Indicadores

**Problema identificado:**
- Los indicadores europeos existían en la DB (se veían en logs de `getAllLatestFromDBWithPrev`)
- El dashboard mostraba "Dato pendiente" porque `buildIndicatorRows()` los filtraba por peso
- No había una fuente centralizada para indicadores europeos

**Solución implementada:**

1. **Nuevo helper centralizado** (`domain/eurozone-indicators.ts`):
   - Función `getEuropeanIndicatorsForDashboard()` que usa `getAllLatestFromDBWithPrev()`
   - Misma fuente de datos que `/api/debug/european-indicators`
   - Garantiza consistencia entre debug endpoint y dashboard

2. **Modificación de `lib/dashboard-data.ts`**:
   - Importa y usa `getEuropeanIndicatorsForDashboard()`
   - Merge de indicadores europeos con datos de `biasState.table`
   - Excepción en filtro: indicadores `eu_*` siempre se incluyen (aunque peso = 0)
   - Los indicadores europeos se marcan con `section: 'EUROZONA'`

**Archivos modificados:**
- `domain/eurozone-indicators.ts` (nuevo)
- `lib/dashboard-data.ts`

### 2️⃣ CORRELACIONES - Normalización de Símbolos

**Problema identificado:**
- Los símbolos en el job de correlaciones no se normalizaban consistentemente
- Posible inconsistencia entre símbolos escritos en DB y símbolos leídos

**Solución implementada:**

1. **Normalización explícita en job** (`app/api/jobs/correlations/route.ts`):
   - Normaliza símbolos a `uppercase` antes de procesar
   - Asegura consistencia con cómo se almacenan en la tabla `correlations`
   - Mejora logging con símbolo normalizado

**Archivos modificados:**
- `app/api/jobs/correlations/route.ts`

## Próximos Pasos en Producción

### Paso 1: Verificar que el deploy se completó
- Verificar en Vercel Dashboard que el build pasó
- Revisar logs de build (ignorar warnings conocidos de better-sqlite3)

### Paso 2: Ejecutar jobs manualmente

**1. Ingesta Europea:**
```bash
curl -X POST https://tu-dominio.com/api/jobs/ingest/european \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**2. Transformar Indicadores:**
```bash
curl -X POST https://tu-dominio.com/api/jobs/transform/indicators \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**3. Recalcular Bias:**
```bash
curl -X POST https://tu-dominio.com/api/jobs/compute/bias \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

**4. Re-ejecutar Correlaciones:**
```bash
curl -X POST https://tu-dominio.com/api/jobs/correlations \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

### Paso 3: Verificación

**1. Verificar datos europeos:**
```bash
curl https://tu-dominio.com/api/debug/european-indicators
```
- Debe mostrar arrays con datos en `steps.getAllLatestFromDBWithPrev.europeanIndicators`
- Verificar que `value` y `value_previous` no son null

**2. Verificar dashboard data:**
```bash
curl https://tu-dominio.com/api/debug/dashboard-data
```
- Buscar en `indicators` los que tienen `section: "EUROZONA"`
- Verificar que tienen `value` y `previous` (no null)
- Verificar que `tacticalRows` tienen `corr12m` y `corr3m` con valores para SPX, NDX, SX5E, NIKKEI, WTI, COPPER

**3. Verificar dashboard en navegador:**
- Abrir el dashboard en producción
- **Eurozona**: Debe mostrar "Dato actual" y "Dato anterior" (no "Dato pendiente")
- **Correlaciones**: Debe mostrar valores numéricos para todos los activos (no "—")

## Notas Importantes

- Los indicadores europeos ahora se obtienen directamente de `getAllLatestFromDBWithPrev()`, la misma función que usa `getMacroDiagnosis()`
- Si después de ejecutar los jobs manualmente aún faltan datos, revisar los logs en Vercel para errores específicos
- Para correlaciones: Si algunos pares siguen mostrando "—", puede ser porque Yahoo Finance no tiene datos históricos suficientes (n_obs < min_obs). Esto es normal y el dashboard mostrará "—" correctamente.

## Archivos Creados/Modificados

1. `domain/eurozone-indicators.ts` (nuevo) - Helper centralizado
2. `lib/dashboard-data.ts` - Usa helper y merge de indicadores europeos
3. `app/api/jobs/correlations/route.ts` - Normalización de símbolos


