# Fix Completo: Correlaciones (Solo BTCUSD → Casi Todos)

## 🐛 Causa Raíz Identificada

### Bug 1 - "Gate" demasiado estricto ⭐ **CRÍTICO**
- **Problema:** Exigía `aligned.length >= windowDays` (252 para 12m)
- **Efecto:** 
  - BTC (crypto) tiene >252 puntos (7 días/semana) → ✅ pasa
  - FX/índices/commodities tienen ~248-251 puntos (festivos, gaps) → ❌ **falla y devuelve null**
- **Resultado:** Solo BTCUSD tenía correlaciones calculadas

### Bug 2 - Forward-fill cronológico roto
- **Problema:** `last1Date/last2Date` se seteaban al final al construir maps
- **Efecto:** Forward-fill no funcionaba para huecos internos (daysDiff negativo)
- **Resultado:** Reducción del solape y agravamiento del problema

---

## ✅ Cambios Implementados

### A) `lib/correlations/calc.ts` - Fixes Obligatorios

#### 1. Normalización de Fechas
- ✅ Función `normalizeDate()`: `dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr`
- ✅ Función `normalizeSeries()`: Normaliza, filtra inválidos, ordena
- ✅ Aplicado al inicio de `calculateCorrelation()`:
  ```typescript
  const asset = normalizeSeries(assetPrices)
  const base = normalizeSeries(basePrices)
  ```

#### 2. Arreglo de `alignSeries()` - Forward-Fill Cronológico
**Antes:**
```typescript
let last1: number | null = null
let last1Date: string | null = null
for (const p of series1) {
  map1.set(p.date, p.value)
  last1 = p.value        // ❌ Se setea al final
  last1Date = p.date    // ❌ Se setea al final
}
```

**Después:**
```typescript
// Forward-fill cronológico: last1/last2 se actualizan mientras recorremos fechas
let last1: number | null = null
let last1Date: string | null = null
let last2: number | null = null
let last2Date: string | null = null

for (const date of validDates) {
  let v1 = map1.get(date)
  let v2 = map2.get(date)

  // Update last values if we have data ✅
  if (v1 != null) {
    last1 = v1
    last1Date = date
  }
  // ... forward-fill usando last1/last1Date ...
}
```

#### 3. Eliminación del "Gate" Estricto ⭐ **CRÍTICO**

**Antes:**
```typescript
if (aligned.length < windowDays) return null
const window = aligned.slice(-windowDays)
```

**Después:**
```typescript
// FIX BUG 1: Quitar el "gate" de aligned.length < windowDays
// Tomar window (si hay menos que windowDays, coge lo que haya)
const window = aligned.slice(-windowDays)

// Exigir solo min_obs después del slice
const requiredObs = minObs ?? (windowDays >= 200 ? 150 : 40)

if (window.length < requiredObs) {
  return {
    correlation: null,
    n_obs: window.length,
    reasonNull: 'TOO_FEW_POINTS',
    // ...
  }
}
```

**Efecto:**
- 12m calcula si hay >=150 obs (aunque no llegues a 252)
- 3m calcula si hay >=40 obs (aunque no llegues a 63)
- **Esto es lo que más estaba matando las correlaciones**

#### 4. Staleness: 30 Días Calendario
- ✅ Cambiado de 20 días hábiles a 30 días calendario
- ✅ Validación separada para activo y DXY
- ✅ Más permisivo con activos con cierres retrasados

---

### B) `lib/correlations/fetch.ts` - Ajustes Recomendados

#### 1. Eliminación de BTCUSDT del YAHOO_MAP
**Antes:**
```typescript
// Crypto
BTCUSDT: 'BTC-USD',  // ❌ Ruido, puede colarse por error
BTCUSD: 'BTC-USD',
ETHUSD: 'ETH-USD',
```

**Después:**
```typescript
// Crypto
BTCUSD: 'BTC-USD',
ETHUSD: 'ETH-USD',
```

#### 2. Logging de Source (db/yahoo) + Points
**Añadido en `fetchAssetDaily()`:**
```typescript
// Cuando viene de BD
console.log(`[fetchAssetDaily] ${symbol}`, {
  source: 'db',
  points: points.length,
})

// Cuando viene de Yahoo
console.log(`[fetchAssetDaily] ${symbol}`, {
  source: 'yahoo',
  points: data.length,
  yahoo_symbol: yahooSymbol,
})
```

**Efecto:** Permite ver qué símbolos usan qué fuente y cuántos puntos tienen.

#### 3. Renombrado "DXY" a "DTWEXBGS" en Logs
- ✅ Comentarios actualizados: "Trade Weighted U.S. Dollar Index: Broad"
- ✅ Nota: "This is NOT the classic DXY (ICE), but serves as a proxy"
- ✅ Logs de error ahora dicen "DTWEXBGS" en lugar de "DXY"

---

## 📊 Resultado Esperado

### Antes:
- ❌ Solo BTCUSD tiene correlaciones
- ❌ Resto: `null` por gate estricto (248-251 puntos < 252)

### Después:
- ✅ Casi todos los símbolos tienen correlaciones calculadas
- ✅ 1-3 pueden seguir null por falta real de datos/ticker
- ✅ Logs claros explicando cada caso (`reasonNull`, `diagnostic`)

---

## 🧪 Próximos Pasos

1. **Ejecutar el job de correlaciones:**
   ```bash
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/correlations \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

2. **Revisar logs:**
   - Ver `reasonNull` para cada símbolo
   - Verificar `source` (db/yahoo) y `points` en logs
   - Identificar cualquier problema restante

3. **Verificar resultados:**
   - Dashboard debe mostrar correlaciones para casi todos los símbolos
   - Solo 1-3 pueden seguir null por problemas reales de datos

---

## 📝 Archivos Modificados

1. ✅ `lib/correlations/calc.ts` - Fixes obligatorios (gate, forward-fill, staleness)
2. ✅ `lib/correlations/fetch.ts` - Ajustes recomendados (BTCUSDT, logging, DTWEXBGS)

---

## ✅ Checklist de Verificación

- [x] Eliminado `if (aligned.length < windowDays) return null`
- [x] Reemplazado por `window.length < requiredObs` (150/40)
- [x] Arreglado `alignSeries()` para forward-fill cronológico
- [x] Staleness cambiado a 30 días calendario
- [x] Eliminado BTCUSDT del YAHOO_MAP
- [x] Añadido logging de source (db/yahoo) + points
- [x] Renombrado "DXY" a "DTWEXBGS" en logs/comentarios
- [x] Sin errores de linter
- [ ] Job ejecutado y logs revisados
- [ ] Dashboard verificado (casi todos tienen correlaciones)
