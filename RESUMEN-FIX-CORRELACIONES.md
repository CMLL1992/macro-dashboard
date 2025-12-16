# 🔧 Resumen: Fix de Correlaciones (Solo BTCUSD tenía valores)

**Fecha:** 16 de Diciembre de 2025  
**Estado:** ✅ IMPLEMENTADO - Pendiente de ejecutar job y verificar logs

---

## 🎯 Problema Identificado

**Síntoma:** Solo BTCUSD tiene correlaciones calculadas (12m y 3m). El resto de los 19 símbolos tienen `corr12m: null` y `corr3m: null`.

**Hipótesis:** El cálculo está devolviendo null por una validación/merge que falla para casi todos los activos:
- Fechas no alineadas
- Serie de DXY distinta
- Timezone issues
- "Last date" demasiado estricta
- Demasiados NaN tras el join

---

## 🐛 Causa Raíz Identificada

**Bug 1 - "Gate" demasiado estricto:**
- Exigía `aligned.length >= windowDays` (252 para 12m)
- BTC (crypto) tiene >252 puntos (7 días/semana) → pasa
- FX/índices/commodities tienen ~248-251 puntos (festivos, gaps) → **falla y devuelve null**

**Bug 2 - `alignSeries()` no hace forward-fill cronológico:**
- Inicializaba `last1Date` al último punto de la serie
- Esto rompía el forward-fill en fechas anteriores (daysDiff negativo)
- Reducía el solape y agravaba el problema

---

## ✅ Cambios Implementados (Parche Exacto)

### A) Normalización de Fechas a YYYY-MM-DD

**Archivo:** `lib/correlations/calc.ts`

**Añadido:**
- ✅ Función `normalizeDate()`: `dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr`
- ✅ Función `normalizeSeries()`: Normaliza, filtra inválidos, ordena
- ✅ Aplicado al inicio de `calculateCorrelation()`:
  ```typescript
  const asset = normalizeSeries(assetPrices)
  const base = normalizeSeries(basePrices)
  ```

**Efecto:** Evita que timestamps tipo `2025-12-16T00:00:00Z` rompan el merge.

### B) Arreglo de `alignSeries()` para Forward-Fill Cronológico

**Archivo:** `lib/correlations/calc.ts`

**Cambios:**
- ✅ Normaliza series antes de construir maps
- ✅ `last1/last2` se actualizan **mientras** recorremos fechas (no al final)
- ✅ Forward-fill cronológico correcto: `daysDiff > 0 && daysDiff <= maxDays`

**Efecto:** Forward-fill funciona correctamente para huecos internos.

### C) Quitar el "Gate" de `aligned.length < windowDays` ⭐ **CRÍTICO**

**Archivo:** `lib/correlations/calc.ts`

**Antes:**
```typescript
if (aligned.length < windowDays) return null
const window = aligned.slice(-windowDays)
```

**Después:**
```typescript
const window = aligned.slice(-windowDays) // si hay menos, coge lo que haya
const requiredObs = minObs ?? (windowDays >= 200 ? 150 : 40)
if (window.length < requiredObs) {
  return { correlation: null, reasonNull: 'TOO_FEW_POINTS', ... }
}
```

**Efecto:**
- 12m calcula si hay >=150 obs (aunque no llegues a 252)
- 3m calcula si hay >=40 obs (aunque no llegues a 63)
- **Esto es lo que más estaba matando las correlaciones**

### D) Staleness: 30 Días Calendario

**Archivo:** `lib/correlations/calc.ts`

**Cambio:**
- ✅ Antes: 20 días hábiles
- ✅ Ahora: 30 días calendario
- ✅ Validación separada para activo y DXY

**Efecto:** Más permisivo con activos con cierres retrasados.

### 1. Instrumentación de Diagnóstico en `calculateCorrelation()`

**Archivo:** `lib/correlations/calc.ts`

**Mejoras:**
- ✅ Función `normalizeDate()`: Normaliza todas las fechas a `YYYY-MM-DD` (UTC, sin hora)
- ✅ Retorna `reasonNull` con códigos específicos:
  - `NO_DATA`: Sin datos del activo o DXY
  - `STALE_ASSET`: Datos del activo > 30 días
  - `STALE_DXY`: Datos de DXY > 30 días
  - `NO_OVERLAP`: No hay suficientes puntos tras el merge
  - `TOO_FEW_POINTS`: Menos de 150 (12m) o 40 (3m) puntos tras merge
  - `NAN_AFTER_JOIN`: NaN/Infinity en retornos tras el join
  - `EXCEPTION`: Error en cálculo de Pearson
- ✅ Retorna `diagnostic` con métricas:
  - `assetPoints`: Número de puntos del activo
  - `dxyPoints`: Número de puntos de DXY
  - `alignedPoints`: Puntos tras alineamiento
  - `overlapPoints12m`: Puntos comunes en ventana 12m
  - `overlapPoints3m`: Puntos comunes en ventana 3m
  - `assetLastDate`: Última fecha del activo
  - `dxyLastDate`: Última fecha de DXY

### 2. Normalización de Fechas

**Archivo:** `lib/correlations/calc.ts`

**Cambios:**
- ✅ Todas las fechas se normalizan a `YYYY-MM-DD` antes del merge
- ✅ `alignSeries()` ahora trabaja con fechas normalizadas
- ✅ `calculateLogReturns()` usa fechas normalizadas
- ✅ Merge por fecha normalizada (no por timestamp exacto)

### 3. Ajuste de Validación de Staleness

**Archivo:** `lib/correlations/calc.ts`

**Cambios:**
- ✅ **Antes:** 20 días hábiles
- ✅ **Ahora:** 30 días calendario (más permisivo)
- ✅ Validación separada para activo y DXY
- ✅ Retorna `STALE_ASSET` o `STALE_DXY` según cuál falle

### 4. Logging Detallado en Job

**Archivo:** `app/api/jobs/correlations/route.ts`

**Mejoras:**
- ✅ Log por símbolo con:
  - `symbol`: Símbolo interno
  - `yahoo_symbol`: Símbolo de Yahoo usado
  - `assetPoints`: Número de puntos del activo
  - `dxyPoints`: Número de puntos de DXY
  - `assetLastDate`: Última fecha del activo
  - `dxyLastDate`: Última fecha de DXY
  - `corr12m`, `corr12m_n_obs`, `corr12m_reasonNull`, `corr12m_diagnostic`
  - `corr3m`, `corr3m_n_obs`, `corr3m_reasonNull`, `corr3m_diagnostic`

### 5. Mejora de Manejo de Errores en Fetch

**Archivo:** `lib/correlations/fetch.ts`

**Mejoras:**
- ✅ Logging explícito cuando no se encuentra `yahoo_symbol`
- ✅ Logging de éxito cuando se obtienen datos
- ✅ Logging de errores con stack trace
- ✅ No más errores silenciosos (`catch -> return []` sin explicación)

### 6. Verificación de Uso de `yahoo_symbol`

**Archivo:** `lib/correlations/fetch.ts`

**Estado:**
- ✅ `getYahooSymbol()` ya prioriza `tactical-pairs.json`
- ✅ Orden de prioridad:
  1. Base de datos (`asset_metadata`)
  2. `tactical-pairs.json` ← **Source of truth**
  3. `assets.config.json`
  4. Mapa hardcodeado

---

## 📊 Criterios de Mínimo de Datos

**Ventana 12m:**
- Mínimo: 150 puntos tras merge (≈ 6-7 meses de días hábiles)
- Trading days: 252

**Ventana 3m:**
- Mínimo: 40 puntos tras merge
- Trading days: 63

**Si no se cumple:** Retorna `null` con `reasonNull = "TOO_FEW_POINTS"`

---

## 🧪 Próximos Pasos

### 1. Ejecutar Job de Correlaciones

```bash
curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/correlations \
  -H "Authorization: Bearer ${CRON_TOKEN}"
```

### 2. Revisar Logs de Vercel

Buscar en logs:
- `[correlations/route] Correlation calculation for SYMBOL`
- Verificar `reasonNull` para cada símbolo
- Verificar `diagnostic` para entender el problema

### 3. Interpretar Resultados

**Si muchos dicen `"NO_OVERLAP"`:**
- Problema en el join de fechas
- Revisar normalización de fechas
- Verificar que DXY y activos tienen fechas comunes

**Si muchos dicen `"NO_DATA"`:**
- Problema en fetch de datos
- Verificar `yahoo_symbol` en logs
- Revisar si Yahoo Finance tiene datos para ese símbolo

**Si muchos dicen `"STALE_ASSET"` o `"STALE_DXY"`:**
- Datos demasiado antiguos
- Verificar última fecha en logs
- Puede ser problema de timezone o retraso en actualización

**Si muchos dicen `"TOO_FEW_POINTS"`:**
- No hay suficientes datos históricos
- Verificar `overlapPoints12m` y `overlapPoints3m` en diagnostic
- Puede necesitar más datos históricos

**Si muchos dicen `"NAN_AFTER_JOIN"`:**
- Problema en cálculo de retornos
- Verificar que los precios son válidos
- Revisar lógica de `calculateLogReturns()`

---

## 📝 Archivos Modificados

1. ✅ `lib/correlations/calc.ts`
   - Función `normalizeDate()` añadida
   - `calculateCorrelation()` mejorada con diagnóstico
   - Validación de staleness ajustada (30 días calendario)
   - Normalización de fechas en todo el flujo

2. ✅ `app/api/jobs/correlations/route.ts`
   - Logging detallado por símbolo
   - Incluye `yahoo_symbol`, `reasonNull`, `diagnostic`

3. ✅ `lib/correlations/fetch.ts`
   - Mejor manejo de errores (no silencioso)
   - Logging explícito de éxito/fallo
   - Verificación de `yahoo_symbol`

---

## 🎯 Resultado Esperado

**Antes:**
- Solo BTCUSD tiene correlaciones
- Resto: `corr12m: null`, `corr3m: null`

**Después (esperado):**
- Casi todos los símbolos tienen correlaciones calculadas
- 1-3 símbolos pueden seguir null por falta real de datos/ticker
- Logs claros explicando por qué cada símbolo tiene o no correlación

---

## 🔍 Diagnóstico Rápido

Después de ejecutar el job, revisar logs y buscar:

```bash
# En logs de Vercel, buscar:
grep "reasonNull" logs.txt

# Contar por tipo:
grep -o "reasonNull.*" logs.txt | sort | uniq -c
```

**Interpretación:**
- Si mayoría es `NO_OVERLAP` → Problema de join (normalización de fechas)
- Si mayoría es `NO_DATA` → Problema de fetch (yahoo_symbol o API)
- Si mayoría es `STALE_*` → Problema de actualización de datos
- Si mayoría es `TOO_FEW_POINTS` → Necesita más datos históricos

---

**Última actualización:** 2025-12-16
