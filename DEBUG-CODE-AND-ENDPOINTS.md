# CÓDIGO COMPLETO Y ENDPOINTS DE DEBUG

## 1️⃣ CÓDIGO COMPLETO DE FUNCIONES CRÍTICAS

### `domain/diagnostic.ts` - getMacroDiagnosis() y getMacroDiagnosisWithDelta()

```typescript
export async function getMacroDiagnosis() {
  // Primary: read from SQLite
  let data: LatestPoint[] = getAllLatestFromDB()
  
  // Fallback: if enabled and data is missing, try FRED for missing indicators
  if (USE_LIVE_SOURCES && data.some(d => d.value == null)) {
    try {
      const fredData = await getAllLatest()
      // Merge: use FRED data only for indicators missing from DB
      const dbMap = new Map(data.map(d => [d.key, d]))
      for (const fredPoint of fredData) {
        if (!dbMap.has(fredPoint.key) || dbMap.get(fredPoint.key)?.value == null) {
          data = data.filter(d => d.key !== fredPoint.key)
          data.push(fredPoint)
        }
      }
    } catch (error) {
      // FRED failed, continue with DB data only
      console.warn('FRED fallback failed, using DB data only:', error)
    }
  }
  
  // De-duplicate by key
  const uniqueByKey = new Map<string, LatestPoint>()
  for (const d of data) {
    uniqueByKey.set(d.key, d)
  }
  data = Array.from(uniqueByKey.values())
  
  // Update histories with current values
  for (const point of data) {
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[point.key] ?? point.key
    if (point.value != null && (point as any).date) {
      upsertIndicatorHistory({
        indicatorKey: weightKey,
        value: point.value,
        date: (point as any).date,
      })
    }
  }
  
  // Get updated histories after upserts
  const updatedHistories = getAllIndicatorHistories()
  
  const items = data.map(d => {
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[d.key] ?? d.key
    const history = updatedHistories.get(weightKey)
    
    // Use value from getAllLatestFromDB, fallback to indicator_history if null/undefined
    let value = (d.value != null) ? d.value : (history?.value_current ?? null)
    let value_previous = history?.value_previous ?? null
    let date = ((d as any).date != null) ? (d as any).date : (history?.date_current ?? null)
    let date_previous = history?.date_previous ?? null
    
    // If still null and we have a different key, try looking up by original key
    if (value == null && d.key !== weightKey) {
      const historyByOriginalKey = updatedHistories.get(d.key.toUpperCase())
      if (historyByOriginalKey?.value_current != null) {
        value = historyByOriginalKey.value_current
        value_previous = historyByOriginalKey.value_previous
        date = historyByOriginalKey.date_current ?? date
        date_previous = historyByOriginalKey.date_previous ?? date_previous
      }
    }
    
    const posture = postureOf(d.key, value)
    const weight = WEIGHTS[weightKey] ?? 0
    
    // Calculate trend
    const trend = calculateTrend(
      weightKey,
      value ?? null,
      value_previous ?? null
    )
    
    return {
      key: weightKey, // ID único (FRED series id canónico)
      seriesId: weightKey,
      label: d.label,
      value,
      value_previous,
      date,
      date_previous,
      trend,
      posture,
      numeric: value == null ? 0 : toNumeric(posture),
      weight,
      category: categoryFor(weightKey),
      originalKey: d.key, // Preserve original key (e.g., 'gdp_yoy', 'cpi_yoy')
    }
  })

  // ... sorting and other logic ...
  
  return { 
    items, 
    score, 
    regime, 
    threshold: 0.3, 
    lastUpdated, 
    counts: { total, withValue, nulls }, 
    freshness: { fredRevalidateHours }, 
    categoryCounts,
    improving,
    deteriorating,
  }
}

export async function getMacroDiagnosisWithDelta() {
  const base = await getMacroDiagnosis()
  // improving y deteriorating ya están calculados en getMacroDiagnosis()
  return base
}
```

### `domain/macro-engine/bias.ts` - getBiasRaw() y getBiasState()

```typescript
export async function getBiasRaw(): Promise<BiasRawPayload> {
  const diagnosis = await getMacroDiagnosisWithDelta()
  const latestPoints = diagnosis.items as LatestPoint[]
  // ... tactical rows logic ...
  
  const observations = getLatestMacroObservations()
  const updatedAt = diagnosis.lastUpdated?.length
    ? new Date(diagnosis.lastUpdated)
    : observations.latestDate
      ? new Date(observations.latestDate)
      : new Date()

  const table: BiasRow[] = latestPoints.map((item: any) => {
    // Ensure date is converted from undefined to null for consistency
    const dateValue = item.date ?? null
    const datePreviousValue = item.date_previous ?? null
    
    return {
      key: item.key,
      label: item.label,
      value: item.value ?? null,
      value_previous: item.value_previous ?? null,
      trend: item.trend ?? null,
      posture: item.posture ?? null,
      weight: item.weight ?? null,
      category: item.category ?? categoryFor(item.key ?? item.originalKey ?? ''),
      date: dateValue,
      date_previous: datePreviousValue,
      originalKey: item.originalKey ?? item.key ?? null,
      unit: item.unit ?? null,
    }
  })

  return {
    latestPoints,
    table,
    tableTactical: tacticalRows,
    latestObservations: observations,
    updatedAt,
  }
}

export async function getBiasState(): Promise<BiasState> {
  try {
    const raw = await getBiasRaw()
    const usd = getUSDBias(raw.latestPoints)
    const quad = getQuad(raw.table)
    const liquidity = getLiquidityRegime(raw.latestObservations)
    const credit = getCreditStress(raw.table, raw.latestObservations)
    const risk = getRiskAppetite({
      usdScore: usd.score,
      usdRegime: usd.regime,
      liquidityScore: liquidity.score,
      liquidityRegime: liquidity.regime,
      quadScore: quad.score,
      quadRegime: quad.regime,
      creditScore: credit.score,
      creditRegime: credit.regime,
    })

    const table = getBiasTable(raw.table)
    const tableTactical = raw.tableTactical

    return {
      updatedAt: raw.updatedAt,
      regime: {
        overall: risk.regime,
        usd_direction: usd.regime,
        quad: quad.regime,
        liquidity: liquidity.regime,
        credit: credit.regime,
        risk: risk.regime,
      },
      metrics: {
        usdScore: usd.score,
        quadScore: quad.score,
        liquidityScore: liquidity.score,
        creditScore: credit.score,
        riskScore: risk.score,
      },
      table,
      tableTactical,
    }
  } catch (error) {
    logger.error('[macro-engine/bias] Failed to build BiasState', { error })
    throw error
  }
}

export function getBiasTable(rows: BiasRow[]): BiasRow[] {
  return rows.map((row) => ({
    ...row,
    trend: row.trend ?? null,
    posture: row.posture ?? null,
    value: row.value ?? null,
    value_previous: row.value_previous ?? null,
    category: row.category ?? 'Otros',
    label: row.label ?? row.key ?? '',
    date: row.date ?? null,
    weight: row.weight ?? null,
    originalKey: row.originalKey ?? row.key ?? null,
    unit: row.unit ?? null,
  }))
}
```

### `app/dashboard/page.tsx` - Dashboard Mapping

```typescript
export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  void searchParams

  const [biasState, correlationState] = await Promise.all([
    getBiasState(),
    getCorrelationState(),
  ])

  // DEBUG: Log biasState.table to inspect data structure
  const sampleRow = biasState.table?.find((r: any) => r.key === 'CPIAUCSL')
  console.log('[Dashboard DEBUG] Sample row from biasState.table:', JSON.stringify({
    key: sampleRow?.key,
    label: sampleRow?.label,
    value: sampleRow?.value,
    value_previous: sampleRow?.value_previous,
    date: sampleRow?.date,
    date_previous: sampleRow?.date_previous,
    full_row: sampleRow,
  }, null, 2))

  const indicatorRows = buildIndicatorRows(
    Array.isArray(biasState.table) ? biasState.table : []
  )

  // ... rest of component ...
}

const buildIndicatorRows = (table: any[]): IndicatorRow[] =>
  table.map((row) => ({
    key: row.key ?? row.originalKey ?? '',
    label: row.label ?? row.key ?? '',
    category: row.category ?? 'Otros',
    previous: row.value_previous ?? row.previous ?? null,
    value: row.value ?? null,
    trend: row.trend ?? null,
    posture: row.posture ?? null,
    weight: row.weight ?? null,
    date: row.date ?? null,
    originalKey: row.originalKey ?? row.key ?? null,
    unit: row.unit ?? null,
  }))

// In the render:
{categoryRows.map((row) => {
  const formatValue = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '—'
    if (!Number.isFinite(v)) return String(v)
    return isPayemsDelta ? Math.round(v).toString() : v.toFixed(2)
  }

  const valCurrent = formatValue(row.value)
  const valPrevious = formatValue(row.previous)
  
  // ... render table row ...
})}
```

---

## 2️⃣ COMANDOS PARA EJECUTAR ENDPOINTS DE DEBUG

Una vez desplegado en producción, ejecuta estos comandos:

### A. Verificar indicator_history para CPIAUCSL

```bash
curl "https://macro-dashboard-seven.vercel.app/api/debug/indicator-history?key=CPIAUCSL"
```

### B. Ver getMacroDiagnosis() para CPIAUCSL

```bash
curl "https://macro-dashboard-seven.vercel.app/api/debug/macro-diagnosis" | jq '.sample_indicators[] | select(.key == "CPIAUCSL")'
```

### C. Trazar cadena completa para CPIAUCSL

```bash
curl "https://macro-dashboard-seven.vercel.app/api/debug/bias-chain?key=CPIAUCSL" | jq '.'
```

### D. Ver snapshot del Dashboard

1. Abre `https://macro-dashboard-seven.vercel.app/dashboard`
2. Busca el bloque DEBUG amarillo arriba de la tabla
3. Expande "🔍 DEBUG: biasState.table (first 3 rows)"
4. Copia el JSON mostrado

O revisa los logs de Vercel para ver los console.log del dashboard.

---

## 3️⃣ ESTRUCTURA ESPERADA DE RESPUESTAS

### `/api/debug/macro-diagnosis` - Para CPIAUCSL

```json
{
  "sample_indicators": [
    {
      "key": "CPIAUCSL",
      "label": "Inflación CPI (YoY)",
      "value": 3.02,
      "value_previous": 3.03,
      "date": "2025-09-01",
      "date_previous": "2025-08-01",
      "trend": "Estable",
      "posture": "Hawkish",
      "weight": 0.1,
      "category": "Precios / Inflación",
      "originalKey": "cpi_yoy"
    }
  ]
}
```

### `/api/debug/bias-chain?key=CPIAUCSL` - Paso a paso

```json
{
  "target_key": "CPIAUCSL",
  "per_step_data": {
    "step1_getMacroDiagnosis": {
      "key": "CPIAUCSL",
      "value": 3.02,
      "value_previous": 3.03,
      "date": "2025-09-01",
      "date_previous": "2025-08-01"
    },
    "step2_getMacroDiagnosisWithDelta": {
      "key": "CPIAUCSL",
      "value": 3.02,
      "value_previous": 3.03,
      "date": "2025-09-01",
      "date_previous": "2025-08-01"
    },
    "step3_getBiasRaw_table": {
      "key": "CPIAUCSL",
      "value": 3.02,
      "value_previous": 3.03,
      "date": "2025-09-01",
      "date_previous": "2025-08-01"
    },
    "step4_getBiasState_table": {
      "key": "CPIAUCSL",
      "value": 3.02,
      "value_previous": 3.03,
      "date": "2025-09-01",
      "date_previous": "2025-08-01"
    }
  },
  "summary": {
    "step1_items_with_value": 15,
    "step4_rows_with_value": 15,
    "value_lost_between_steps": 0
  }
}
```

### Dashboard - biasState.table (primeras 3 filas)

```json
[
  {
    "key": "T10Y2Y",
    "label": "Curva 10Y–2Y (spread %)",
    "value": 0.52,
    "value_previous": 0.52,
    "date": "2025-11-14",
    "date_previous": "2025-11-14",
    "trend": "Estable",
    "posture": "Neutral",
    "weight": 0.06,
    "category": "Financieros / Curva",
    "originalKey": "t10y2y"
  },
  {
    "key": "GDPC1",
    "label": "PIB Interanual (GDP YoY)",
    "value": 2.08,
    "value_previous": 3.84,
    "date": "2025-04-01",
    "date_previous": "2025-04-01",
    "trend": "Empeora",
    "posture": "Neutral",
    "weight": 0.22,
    "category": "Crecimiento / Actividad",
    "originalKey": "gdp_yoy"
  },
  {
    "key": "CPIAUCSL",
    "label": "Inflación CPI (YoY)",
    "value": 3.02,
    "value_previous": 3.03,
    "date": "2025-09-01",
    "date_previous": "2025-08-01",
    "trend": "Estable",
    "posture": "Hawkish",
    "weight": 0.1,
    "category": "Precios / Inflación",
    "originalKey": "cpi_yoy"
  }
]
```

---

## 🎯 ANÁLISIS ESPERADO

Con estos datos podremos identificar:

1. **Si `getMacroDiagnosis()` devuelve valores:** Ver `step1_getMacroDiagnosis`
2. **Si `getMacroDiagnosisWithDelta()` preserva valores:** Comparar step1 vs step2
3. **Si `getBiasRaw()` preserva valores:** Comparar step2 vs step3
4. **Si `getBiasState()` preserva valores:** Comparar step3 vs step4
5. **Si el Dashboard recibe valores:** Ver el JSON del bloque DEBUG

**Si algún paso muestra `value: null` cuando el anterior tenía valor, ese es el punto donde se pierden los datos.**

