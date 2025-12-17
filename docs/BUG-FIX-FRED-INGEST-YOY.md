# ✅ Bug cerrado — Ingesta FRED / YoY mensuales

**Fecha de cierre**: 2025-12-17  
**Estado**: ✅ Resuelto y validado

---

## Estado final

Todos los YoY mensuales funcionan correctamente en el dashboard:

- **cpi_yoy** → 3.02%
- **corecpi_yoy** → 3.03%
- **corepce_yoy** → 2.83%
- **ppi_yoy** → 3.82%
- **indpro_yoy** → 1.62%
- **gdp_yoy** → 2.08%
- **pmi_mfg** → `null` (esperado: `USPMI` no viene de FRED; depende de Alpha Vantage o input manual)

---

## 🧠 Root cause (confirmado)

### Archivo afectado
- **`lib/fred.ts`**
- **Función**: `parseFredResponse()` (bloque ~L263–L348)

### Problema técnico

Para series de **nivel** (sin `units` transform), la lógica hacía:

- Usar **`realtime_start`** como fecha principal (`date`)
- En lugar de **`observation_date`** (`o.date`)

### Efecto observado

1. Todas las observaciones históricas terminaban con la **misma fecha** (la fecha de publicación más reciente, p.ej. `2025-12-17`)
2. El `UPSERT` en `macro_observations` es:
   ```sql
   ON CONFLICT(series_id, date) DO UPDATE
   ```
3. Como todas las filas tenían el mismo `(series_id, date)`, cada insert **sobrescribía la anterior**
4. → En Turso quedaba **1 sola fila** tras `reset=true`
5. Por eso, aunque FRED devolvía `~189` observaciones, en BD solo aparecía una

### Síntomas observados

- Tras ejecutar `reset=true&only=CPIAUCSL`, Turso tenía solo **1 observación** (última fecha)
- Los logs mostraban:
  - `fetchFredSeries result: observationsLength=189` ✅
  - `firstObs.date: "2025-12-17"` ❌ (debería ser `2010-01-01`)
  - `lastObs.date: "2025-12-17"` ❌ (debería ser `2025-09-01`)
- Todos los YoY mensuales aparecían como `null` en el dashboard

---

## 🛠 Fix aplicado

### Cambio en `parseFredResponse()`

**Antes** (código problemático):
```typescript
if (isTransformed) {
  return {
    date: o.date, // Periodo del dato
    value: numValue,
    observation_period: o.date,
  }
} else {
  // ❌ BUG: Usaba realtime_start como fecha principal
  const releaseDate = (typeof o.realtime_start === 'string' ? o.realtime_start : null) || o.date
  return {
    date: releaseDate, // Fecha de publicación (misma para todas)
    value: numValue,
    observation_period: o.date,
  }
}
```

**Ahora** (código corregido):
```typescript
// ✅ FIX: Siempre usar observation_date como fecha principal
return {
  date: o.date, // observation_date (periodo del dato)
  value: numValue,
  // Store realtime_start as observation_period only if it differs
  observation_period:
    (typeof o.realtime_start === 'string' && o.realtime_start !== o.date)
      ? o.realtime_start
      : undefined,
}
```

### Cambios clave

1. **Eliminada la distinción** entre datos transformados y de nivel para la fecha principal
2. **Siempre usar `observation_date`** (`o.date`) como `date` del `SeriesPoint`
3. `realtime_start` se conserva solo como metadato opcional (`observation_period`) cuando difiere
4. **Ya no define la clave temporal** del punto

### Resultado

Las observaciones históricas se insertan con fechas correctas:
- `2010-01-01`, `2010-02-01`, …, `2025-09-01`

El `ON CONFLICT(series_id, date)` funciona como se espera:
- → **1 fila por periodo** (no sobrescribe)

---

## 🔎 Validación

### CPIAUCSL en Turso (endpoint de test)

```bash
curl "http://localhost:3001/api/test/yoy?series_id=CPIAUCSL"
```

**Resultado**:
- `totalObservations`: **189** ✅
- `firstDate`: **2010-01-01** ✅
- `lastDate`: **2025-09-01** ✅
- `yoyResultsCount`: **177** ✅
- Último YoY ≈ **3.02%** en `2025-09-01` ✅

### Dashboard (`/api/dashboard`)

```bash
curl -s http://localhost:3001/api/dashboard | jq '.data.indicators[] | select(.key | test("_yoy"))'
```

**Resultado**:
- `cpi_yoy`, `corecpi_yoy`, `corepce_yoy`, `ppi_yoy`, `indpro_yoy`, `gdp_yoy` → **todos con valor numérico** ✅
- `pmi_mfg` sigue `null` (comportamiento esperado, depende de `USPMI` fuera de FRED)

---

## 📌 Conclusión

### Lo que NO era el problema

- ❌ No era un problema del cálculo **YoY** (la función `yoy()` ya estaba correcta)
- ❌ No era un problema de **Turso** (la configuración era correcta)
- ❌ No era un problema del **job incremental** ni del `reset` (la lógica era correcta)
- ❌ No era un problema del **fetch a FRED** (FRED devolvía los datos correctos)

### Lo que SÍ era el problema

- ✅ Era una **fecha mal elegida en `parseFredResponse()`**: usar `realtime_start` como `date` para datos de nivel

### Impacto del fix

Con el fix aplicado:

1. La ingesta FRED **puebla correctamente el histórico** mensual desde 2010-01-01
2. Los YoY mensuales se **calculan y muestran de forma consistente**
3. El sistema queda **correcto y estable**

---

## 📝 Archivos modificados

- `lib/fred.ts` - Función `parseFredResponse()` (líneas ~316-343)

## 🔗 Referencias relacionadas

- Fix previo: `lib/fred.ts` - Eliminación de `realtime_start` automático en `fetchFredSeries()` (líneas ~147-156)
- Fix previo: `lib/fred.ts` - Función `yoy()` robusta con alineación a mes (líneas ~350-385)
- Instrumentación: `app/api/jobs/ingest/fred/route.ts` - Logs de diagnóstico añadidos

---

**Ticket cerrado.** ✅
