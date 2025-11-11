import { getAllLatest, type LatestPoint } from '@/lib/fred'
import { postureOf, weightedScore, diagnose, WEIGHTS, toNumeric } from './posture'
import { categoryFor, CATEGORY_ORDER, type Category } from './categories'
import { calculateTrend, type Trend } from './trend'
import { upsertIndicatorHistory } from '@/lib/db/upsert'
import { getAllIndicatorHistories } from '@/lib/db/read'
import { getAllLatestFromDB } from '@/lib/db/read-macro'

// Feature flag: desactivar llamadas directas a FRED por defecto
const USE_LIVE_SOURCES = process.env.USE_LIVE_SOURCES === 'true'

// Mapa para obtener el ID de serie correcto para pesos desde los keys internos
// Solo incluye los 16 indicadores curados de alto impacto
const MAP_KEY_TO_WEIGHT_KEY: Record<string, string> = {
  // Inflation (5) - añadido PCE YoY general
  cpi_yoy: 'CPIAUCSL',
  corecpi_yoy: 'CPILFESL',
  pce_yoy: 'PCEPI',
  corepce_yoy: 'PCEPILFE',
  ppi_yoy: 'PPIACO',
  // Growth (4)
  gdp_qoq: 'GDPC1',
  gdp_yoy: 'GDPC1',
  indpro_yoy: 'INDPRO',
  retail_yoy: 'RSXFS',
  // Employment (3)
  payems_delta: 'PAYEMS',
  unrate: 'UNRATE',
  claims_4w: 'ICSA',
  // Monetary Policy (2) - añadido Curva 10Y-2Y
  t10y2y: 'T10Y2Y',
  fedfunds: 'FEDFUNDS',
  // Risk Modulator (1) - no tiene peso, solo modula
  vix: 'VIX',
}

/**
 * Get macro diagnosis from SQLite (primary source)
 * Falls back to FRED only if USE_LIVE_SOURCES=true and data is missing
 */
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
  
  // De-duplicate by key (evita duplicados como GDP YoY apareciendo dos veces)
  const uniqueByKey = new Map<string, LatestPoint>()
  for (const d of data) {
    uniqueByKey.set(d.key, d)
  }
  data = Array.from(uniqueByKey.values())
  // Extra: asegurar que YoY y QoQ de GDP no comparten label
  for (const d of data) {
    if (d.key === 'gdp_yoy') d.label = 'PIB Interanual (GDP YoY)'
    if (d.key === 'gdp_qoq') d.label = 'PIB Trimestral (GDP QoQ Anualizado)'
  }
  
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
    const posture = postureOf(d.key, d.value)
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[d.key] ?? d.key
    const weight = WEIGHTS[weightKey] ?? 0
    const history = updatedHistories.get(weightKey)
    
    // Calculate trend
    const trend = calculateTrend(
      weightKey,
      d.value ?? null,
      history?.value_previous ?? null
    )
    
    return {
      key: weightKey, // ID único (FRED series id canónico)
      seriesId: weightKey,
      label: d.label,
      value: d.value,
      value_previous: history?.value_previous ?? null,
      date: (d as any).date,
      date_previous: history?.date_previous ?? null,
      trend,
      posture,
      numeric: d.value == null ? 0 : toNumeric(posture),
      weight,
      category: categoryFor(weightKey),
      originalKey: d.key, // Preserve original key (e.g., 'gdp_yoy', 'cpi_yoy') for freshness calculation
    }
  })

  // Debug: validar ausencia de duplicados por label
  ;(function assertNoDuplicates(list: any[]) {
    try {
      const labels = list.map(i => String(i.label))
      const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i)
      if (duplicates.length > 0) {
        console.error('DUPLICATED LABELS FOUND:', Array.from(new Set(duplicates)))
      }
    } catch {}
  })(items as any[])

  // Ordenar por categoría y luego por peso desc/label
  items.sort((a: any, b: any) => {
    const co = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (co !== 0) return co
    const w = (b.weight || 0) - (a.weight || 0)
    if (w !== 0) return w
    return String(a.label).localeCompare(String(b.label))
  })

  const { score } = weightedScore(items)
  const regime = diagnose(score)
  const dates = items.map(i => i as any).map(i => i.date).filter(Boolean) as string[]
  const lastUpdated = dates.length ? dates.sort().at(-1)! : ''
  const total = items.length
  const withValue = items.filter(i => i.value != null).length
  const nulls = total - withValue
  const fredRevalidateHours = 3

  // Calculate improving/deteriorating based on trends
  const improving = items.filter((i: any) => i.trend === 'Mejora').length
  const deteriorating = items.filter((i: any) => i.trend === 'Empeora').length

  // Resumen por categoría
  const categoryCounts: Record<Category, { total: number; withValue: number }> = {} as any
  for (const cat of CATEGORY_ORDER) categoryCounts[cat] = { total: 0, withValue: 0 }
  for (const it of items as any[]) {
    const cat = it.category as Category
    if (!categoryCounts[cat]) categoryCounts[cat] = { total: 0, withValue: 0 }
    categoryCounts[cat].total += 1
    if (it.value != null) categoryCounts[cat].withValue += 1
  }

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

export type Delta = { key: string; prev: number | null; curr: number | null; dir: 'up' | 'down' | 'flat' | 'na' }

// Snapshot con deltas: ahora usa la base de datos en lugar de JSON
export async function getMacroDiagnosisWithDelta() {
  const base = await getMacroDiagnosis()
  // improving y deteriorating ya están calculados en getMacroDiagnosis()
  return base
}


