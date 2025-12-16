# ✅ Fixes Aplicados al Job de Correlaciones

**Fecha:** 2025-12-16

---

## 🔧 Fixes Implementados

### 1. ✅ Exportar `getYahooSymbol` (FALLO IMPORTANTE)

**Problema:**
- `getYahooSymbol` no estaba exportado pero se importaba en el job
- Podía fallar en runtime en Vercel Node runtime

**Fix:**
```typescript
// Antes:
async function getYahooSymbol(...) { ... }

// Después:
export async function getYahooSymbol(...) { ... }
```

**Archivo:** `lib/correlations/fetch.ts`

---

### 2. ✅ Separar `errors` de `noDataCount` (Mejora)

**Problema:**
- `NO_DATA` se contaba como error, pero conceptualmente es un "warning"
- No permitía distinguir entre errores reales (excepciones) y falta de datos

**Fix:**
```typescript
// Antes:
let errors = 0
if (assetPoints === 0) {
  errors++  // ❌ NO_DATA contado como error
}

// Después:
let errors = 0
let noDataCount = 0
if (assetPoints === 0) {
  noDataCount++  // ✅ NO_DATA es warning, no error
}
// errors solo para excepciones en catch
```

**Archivo:** `app/api/jobs/correlations/route.ts`

---

### 3. ✅ Documentar `base: 'DXY'` vs `DTWEXBGS` (Detalle Semántico)

**Problema:**
- Se usa `base: 'DXY'` pero realmente es `DTWEXBGS` (FRED)
- Puede causar confusión en análisis/narrativas

**Fix:**
- Añadidos comentarios explicativos:
```typescript
// Note: base is stored as 'DXY' for backward compatibility, but it's actually DTWEXBGS (FRED)
base: 'DXY', // Stored as 'DXY' for backward compatibility (actually DTWEXBGS from FRED)
```

**Decisión:** Mantener `'DXY'` internamente para backward compatibility, pero documentado.

**Archivo:** `app/api/jobs/correlations/route.ts`

---

### 4. ✅ Mejorar Logging de Null Correlaciones

**Mejora:**
- Añadido tracking de `nullCorrelations` con detalles:
  - `symbol`
  - `assetPoints`
  - `assetLastDate`
  - `corr12m_reasonNull`
  - `corr3m_reasonNull`

**Output del job ahora incluye:**
```json
{
  "success": true,
  "processed": 19,
  "errors": 0,
  "noDataCount": 0,
  "nullCorrelationsCount": 1,
  "duration_ms": 11869,
  "nullCorrelations": [
    {
      "symbol": "USDCNH",
      "assetPoints": 0,
      "assetLastDate": null,
      "corr12m_reasonNull": "NO_DATA",
      "corr3m_reasonNull": "NO_DATA"
    }
  ]
}
```

**Archivo:** `app/api/jobs/correlations/route.ts`

---

## 📋 Checklist de Verificación

- [x] `getYahooSymbol` exportado
- [x] `errors` separado de `noDataCount`
- [x] `base: 'DXY'` documentado (es DTWEXBGS)
- [x] Logging mejorado con `nullCorrelations`
- [x] Sin errores de linter
- [ ] **Pendiente:** Deploy a Vercel para que los cambios surtan efecto

---

## 🚀 Próximo Paso: Deploy

**IMPORTANTE:** Los cambios están en local pero **NO están desplegados en Vercel**.

Para que los fixes surtan efecto:

1. **Commit y push:**
   ```bash
   git add lib/correlations/fetch.ts app/api/jobs/correlations/route.ts
   git commit -m "fix: export getYahooSymbol, separate errors from noDataCount, improve null correlation logging"
   git push origin main
   ```

2. **Esperar deploy automático en Vercel** (1-2 minutos)

3. **Ejecutar job nuevamente:**
   ```bash
   curl -X POST https://macro-dashboard-seven.vercel.app/api/jobs/correlations \
     -H "Authorization: Bearer ${CRON_TOKEN}"
   ```

4. **Revisar respuesta** que ahora incluirá:
   - `noDataCount`
   - `nullCorrelationsCount`
   - `nullCorrelations` (array con detalles)

---

## 📊 Resultado Esperado Después del Deploy

**Respuesta del job:**
```json
{
  "success": true,
  "processed": 19,
  "errors": 0,
  "noDataCount": 1,
  "nullCorrelationsCount": 1,
  "duration_ms": ~12000,
  "nullCorrelations": [
    {
      "symbol": "USDCNH",
      "assetPoints": 0,
      "assetLastDate": null,
      "corr12m_reasonNull": "NO_DATA",
      "corr3m_reasonNull": "NO_DATA"
    }
  ]
}
```

**Logs en Vercel:**
- `[correlations/route] Correlation calculation for BTCUSD` con `source: 'db' | 'yahoo'` y `points: n`
- `[correlations/route] Null correlations summary` con detalles de cada símbolo null

---

## ✅ Estado Actual

**Código:** ✅ Listo y sin errores  
**Deploy:** ⏳ Pendiente (necesita push a GitHub)
