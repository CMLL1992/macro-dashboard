# Decision: Cálculo de Correlaciones

**Fecha:** 2025-12-16  
**Estado:** ✅ Implementado

---

## Problema

El cálculo de correlaciones fallaba para la mayoría de símbolos porque:
1. **Gate demasiado estricto:** Exigía `aligned.length >= windowDays` (252 para 12m)
2. **Forward-fill roto:** `alignSeries()` no hacía forward-fill cronológico correcto
3. **Staleness estricto:** 20 días hábiles era demasiado restrictivo

**Resultado:** Solo BTCUSD tenía correlaciones calculadas (18 símbolos devolvían `null`).

---

## Solución Implementada

### 1. Eliminación del Gate Estricto

**Antes:**
```typescript
if (aligned.length < windowDays) return null
const window = aligned.slice(-windowDays)
```

**Después:**
```typescript
const window = aligned.slice(-windowDays) // Si hay menos, coge lo que haya
const requiredObs = minObs ?? (windowDays >= 200 ? 150 : 40)

if (window.length < requiredObs) {
  return { correlation: null, reasonNull: 'TOO_FEW_POINTS', ... }
}
```

**Efecto:**
- 12m calcula si hay >=150 obs (aunque no llegues a 252)
- 3m calcula si hay >=40 obs (aunque no llegues a 63)
- **Esto es lo que más estaba matando las correlaciones**

### 2. Forward-Fill Cronológico Correcto

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
let last1: number | null = null
let last1Date: string | null = null

for (const date of validDates) {
  let v1 = map1.get(date)
  
  // Update last values if we have data ✅
  if (v1 != null) {
    last1 = v1
    last1Date = date
  }
  
  // Forward fill usando last1/last1Date actualizados
  if (v1 == null && last1 != null && last1Date != null) {
    const daysDiff = Math.floor(...)
    if (daysDiff > 0 && daysDiff <= maxDays) {
      v1 = last1
    }
  }
}
```

**Efecto:** Forward-fill funciona correctamente para huecos internos.

### 3. Staleness: 30 Días Calendario

**Antes:** 20 días hábiles  
**Después:** 30 días calendario

**Efecto:** Más permisivo con activos con cierres retrasados.

---

## Reglas de Cálculo

### Requisitos Mínimos

- **12m:** `min_obs = 150` (no requiere 252 puntos completos)
- **3m:** `min_obs = 40` (no requiere 63 puntos completos)

### Base de Correlación

**Importante:** El campo `base` se guarda como `'DXY'` en la base de datos, pero **realmente es DTWEXBGS (FRED)**.

- **DTWEXBGS:** Trade Weighted U.S. Dollar Index: Broad (FRED)
- **NO es el DXY clásico (ICE)**
- Se mantiene `'DXY'` internamente por **backward compatibility**

**Nota:** En logs y documentación se usa "DTWEXBGS" para precisión, pero en BD se guarda como `'DXY'`.

---

## Fallback para Símbolos Problemáticos

### USDCNH

**Problema:** `CNH=X` puede no funcionar o tener datos insuficientes.

**Solución:** Fallback múltiple:
```typescript
USDCNH: ['CNH=X', 'CNY=X', 'USDCNH=X']
```

**Persistencia:** Cuando un ticker funciona, se guarda en `asset_metadata.yahoo_symbol` para futuras consultas (evita probar todos los fallbacks cada vez).

---

## Tipo de Retorno

```typescript
export type CorrelationResult = {
  correlation: number | null
  n_obs: number
  last_asset_date: string | null
  last_base_date: string | null
  reasonNull?: 'NO_DATA' | 'STALE_ASSET' | 'STALE_DXY' | 'NO_OVERLAP' | 'TOO_FEW_POINTS' | 'NAN_AFTER_JOIN' | 'EXCEPTION'
  diagnostic?: {
    assetPoints: number
    dxyPoints: number
    alignedPoints: number
    overlapPoints12m: number
    overlapPoints3m: number
    assetLastDate: string | null
    dxyLastDate: string | null
  }
}
```

---

## Resultados

**Antes:**
- ❌ Solo 1 símbolo (BTCUSD) tenía correlaciones
- ❌ 18 símbolos devolvían `null`

**Después:**
- ✅ 19 de 19 símbolos tienen correlaciones calculadas
- ✅ 0 errores
- ✅ 0 símbolos sin datos

---

## Tests de Regresión

Ver `tests/correlations/regression.test.ts`:
- ✅ Verifica que `aligned.length < windowDays` pero `>= min_obs` calcula (no null)
- ✅ Verifica que USDCNH usa fallback múltiple
- ✅ Verifica que `reasonNull` y `diagnostic` están presentes

---

## Referencias

- `lib/correlations/calc.ts` - Lógica de cálculo
- `lib/correlations/fetch.ts` - Fetch de datos y fallback
- `app/api/jobs/correlations/route.ts` - Job de cálculo
- `config/correlations.config.json` - Configuración (windowDays, min_obs)
