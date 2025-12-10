# 🔍 Verificación de Datos Reales

## Objetivo

Este documento verifica que **todos los datos** del sistema provienen de **fuentes oficiales y reales**, no son datos simulados o de prueba.

---

## ✅ Fuentes de Datos Verificadas

### 1. Indicadores Económicos (FRED API)

**Fuente:** `https://api.stlouisfed.org` (Federal Reserve Economic Data - Oficial de la FED)

**Verificación:**
- ✅ Todos los indicadores económicos vienen de FRED API
- ✅ API oficial de la Reserva Federal de St. Louis
- ✅ Datos públicos y verificables

**Indicadores verificados:**
- CPI YoY (`CPIAUCSL`)
- Core CPI YoY (`CPILFESL`)
- Core PCE YoY (`PCEPILFE`)
- Nonfarm Payrolls (`PAYEMS`)
- Unemployment Rate (`UNRATE`)
- GDP (`GDPC1`)
- Fed Funds Rate (`FEDFUNDS`)
- 10Y-2Y Spread (`T10Y2Y`)

**Código de verificación:**
```typescript
// lib/fred.ts
const url = new URL('https://api.stlouisfed.org/fred/series/observations')
```

---

### 2. Correlaciones (Yahoo Finance + FRED DXY)

**Fuentes:**
- **Precios de pares:** `https://query1.finance.yahoo.com` (Yahoo Finance)
- **DXY (USD Index):** `https://api.stlouisfed.org/fred/series/DTWEXBGS` (FRED)

**Verificación:**
- ✅ Precios reales de mercado desde Yahoo Finance
- ✅ DXY desde FRED (oficial)
- ✅ Cálculo de correlación Pearson sobre log returns reales

**Código de verificación:**
```typescript
// lib/correlations/fetch.ts
async function fetchYahooDaily(symbol: string): Promise<PricePoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
  // ...
}

export async function fetchDXYDaily(): Promise<PricePoint[]> {
  const series = await fetchFredSeries('DTWEXBGS', {
    frequency: 'd',
    // ...
  })
}
```

---

### 3. Bias y Sesgos (Cálculos desde Datos Reales)

**Fuente:** Base de datos `macro_observations` (poblada desde FRED API)

**Verificación:**
- ✅ Bias calculado desde datos reales en BD
- ✅ BD poblada por job `/api/jobs/ingest/fred` que llama a FRED API
- ✅ No hay datos simulados o hardcodeados

**Flujo de datos:**
```
FRED API (oficial)
    ↓
/api/jobs/ingest/fred
    ↓
macro_observations (SQLite)
    ↓
getMacroDiagnosis() → getBiasState()
    ↓
Cálculos de bias/sesgos
```

**Código de verificación:**
```typescript
// domain/macro-engine/bias.ts
// Lee desde macro_observations (datos reales de FRED)
const diagnosis = await getMacroDiagnosis()
```

---

### 4. Diagnóstico Macro (Agregación de Datos Reales)

**Fuente:** Base de datos `macro_observations` (desde FRED)

**Verificación:**
- ✅ Todos los items vienen de `macro_observations`
- ✅ `macro_observations` se puebla desde FRED API
- ✅ Cálculos de z-scores, tendencias, posturas basados en datos reales

**Código de verificación:**
```typescript
// domain/diagnostic.ts
// Lee desde macro_observations (datos reales)
const observations = await getAllLatestMacroObservations()
```

---

## 🔍 Cómo Verificar

### Opción 1: Endpoint API

```bash
curl http://localhost:3000/api/verify/data
```

Respuesta esperada:
```json
{
  "summary": {
    "total": 15,
    "success": 15,
    "warnings": 0,
    "errors": 0
  },
  "results": [
    {
      "category": "Fuentes",
      "status": "✅",
      "message": "FRED API accesible",
      "details": {
        "url": "https://api.stlouisfed.org",
        "testSeries": "CPIAUCSL",
        "latestDate": "2025-12-01"
      }
    },
    // ... más resultados
  ],
  "verified": true,
  "timestamp": "2025-12-09T..."
}
```

### Opción 2: Verificación Manual

1. **Verificar FRED API directamente:**
```bash
curl "https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=TU_KEY&file_type=json&limit=1&sort_order=desc"
```

2. **Verificar datos en BD:**
```sql
SELECT series_id, date, value
FROM macro_observations
WHERE series_id = 'CPIAUCSL'
ORDER BY date DESC
LIMIT 1;
```

3. **Verificar correlaciones:**
```sql
SELECT symbol, corr12m, corr3m, asof
FROM correlations
WHERE symbol IN ('EURUSD', 'GBPUSD', 'USDJPY')
ORDER BY asof DESC
LIMIT 10;
```

---

## 📊 Resumen de Fuentes

| Categoría | Fuente | URL | Verificado |
|-----------|--------|-----|------------|
| Indicadores Económicos | FRED API | `api.stlouisfed.org` | ✅ |
| Precios de Pares | Yahoo Finance | `query1.finance.yahoo.com` | ✅ |
| DXY (USD Index) | FRED API | `api.stlouisfed.org/fred/series/DTWEXBGS` | ✅ |
| Correlaciones | Cálculo propio | Desde precios reales | ✅ |
| Bias/Sesgos | Cálculo propio | Desde datos FRED | ✅ |
| Diagnóstico Macro | Cálculo propio | Desde datos FRED | ✅ |

---

## ⚠️ Notas Importantes

1. **FRED API Key:** Requerida pero gratuita (obtener en https://fred.stlouisfed.org/docs/api/api_key.html)

2. **Yahoo Finance:** No requiere API key, pero puede tener rate limits

3. **Datos en BD:** Se actualizan mediante jobs cron:
   - `/api/jobs/ingest/fred` - Actualiza indicadores económicos
   - `/api/jobs/compute/correlations` - Calcula correlaciones desde precios reales
   - `/api/jobs/compute/bias` - Calcula bias desde datos reales

4. **No hay datos simulados:** Todo proviene de fuentes oficiales o cálculos basados en datos reales

---

## ✅ Conclusión

**Todos los datos son 100% reales y provienen de fuentes oficiales:**

- ✅ Indicadores económicos: FRED (oficial de la FED)
- ✅ Precios: Yahoo Finance (datos de mercado reales)
- ✅ DXY: FRED (oficial)
- ✅ Correlaciones: Calculadas desde precios reales
- ✅ Bias/Sesgos: Calculados desde datos FRED reales
- ✅ Diagnóstico: Agregación de datos FRED reales

**No hay datos simulados, hardcodeados o de prueba en producción.**

