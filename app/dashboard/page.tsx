import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTable, getBiasTableTactical } from '@/domain/bias'
import { getCorrMap } from '@/domain/corr-bridge'
import InfoTooltip from '@/components/InfoTooltip'
import CorrelationTooltip from '@/components/CorrelationTooltip'
import ConfidenceTooltip from '@/components/ConfidenceTooltip'
import { getCorrelations } from '@/domain/corr-dashboard'
import { CATEGORY_ORDER } from '@/domain/categories'
import { Fragment } from 'react'
import { detectScenarios } from '@/domain/scenarios'
import { isStaleByFrequency, getFrequencyLabel, SLA_BY_FREQUENCY } from '@/lib/utils/freshness'
import Link from 'next/link'
import DateDisplay from '@/components/DateDisplay'
import { getIndicatorSource } from '@/lib/sources'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Fetch bias data with validation and error handling
 */
async function fetchBias() {
  const startTime = Date.now()
  // En server components de Next.js, necesitamos usar URL absoluta
  // Construir la URL base desde las variables de entorno o usar localhost en desarrollo
  let baseUrl = 'http://localhost:3000'
  if (process.env.APP_URL) {
    baseUrl = process.env.APP_URL
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  }
  const endpoint = `${baseUrl}/api/bias`
  
  console.log('[Dashboard] fetchBias - using endpoint', {
    endpoint,
    hasAppUrl: !!process.env.APP_URL,
    hasVercelUrl: !!process.env.VERCEL_URL,
    nodeEnv: process.env.NODE_ENV,
  })

  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const duration = Date.now() - startTime

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error')
      console.error('[Dashboard] API error', {
        endpoint,
        status: res.status,
        statusText: res.statusText,
        duration_ms: duration,
        error: errorText,
      })
      throw new Error(`API error: ${res.status} ${res.statusText} - ${endpoint}`)
    }

    const data = await res.json().catch((error) => {
      console.error('[Dashboard] JSON parse error', {
        endpoint,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(`Invalid JSON response from ${endpoint}`)
    })

    // Log successful fetch
    console.log('[Dashboard] API fetch success', {
      endpoint,
      status: res.status,
      duration_ms: duration,
      items_count: Array.isArray(data?.items) ? data.items.length : 0,
    })

    return data
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error('[Dashboard] Fetch failed', {
      endpoint,
      duration_ms: duration,
      error: errorMessage,
    })

    // Re-throw to be caught by error boundary
    throw new Error(`Failed to fetch bias data: ${errorMessage}`)
  }
}

// Minimum required counts
const MIN_ITEMS = 15
const MIN_CORRELATIONS = 9
const MIN_OBSERVATIONS = 1

export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  // Normalizar searchParams
  const safeSearchParams = searchParams || {}
  
  // 1. Fetch bias data - NO lanzar error, usar valores por defecto si falla
  let apiBias: any = null
  try {
    apiBias = await fetchBias()
  } catch (error) {
    console.error('[Dashboard] fetchBias failed, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    })
    apiBias = { items: [], health: { hasData: false, observationCount: 0, biasCount: 0, correlationCount: 0 } }
  }

  // Normalizar apiBias
  if (!apiBias || typeof apiBias !== 'object') {
    apiBias = { items: [], health: { hasData: false, observationCount: 0, biasCount: 0, correlationCount: 0 } }
  }
  if (!Array.isArray(apiBias.items)) {
    apiBias.items = []
  }
  if (!apiBias.health || typeof apiBias.health !== 'object') {
    apiBias.health = { hasData: false, observationCount: 0, biasCount: 0, correlationCount: 0 }
  }
  
  // 2. Get macro diagnosis - NO lanzar error, usar valores por defecto si falla
  let data: any = null
  try {
    data = await getMacroDiagnosisWithDelta()
  } catch (error) {
    console.error('[Dashboard] getMacroDiagnosisWithDelta failed, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    })
    data = { items: [], regime: 'Neutral', score: 0, threshold: 0.3, counts: { total: 0, withValue: 0, nulls: 0 }, improving: 0, deteriorating: 0, categoryCounts: {} }
  }

  // Normalizar data
  if (!data || typeof data !== 'object') {
    console.warn('[Dashboard] Invalid data structure from getMacroDiagnosisWithDelta, using defaults')
    data = { items: [], regime: 'Neutral', score: 0, threshold: 0.3, counts: { total: 0, withValue: 0, nulls: 0 }, improving: 0, deteriorating: 0, categoryCounts: {} }
  }
  if (!Array.isArray(data.items)) {
    data.items = []
  }
  if (typeof data.regime !== 'string') {
    data.regime = 'Neutral'
  }
  if (typeof data.score !== 'number') {
    data.score = 0
  }
  if (typeof data.threshold !== 'number') {
    data.threshold = 0.3
  }
  if (!data.counts || typeof data.counts !== 'object') {
    data.counts = { total: 0, withValue: 0, nulls: 0 }
  }
  if (typeof data.improving !== 'number') {
    data.improving = 0
  }
  if (typeof data.deteriorating !== 'number') {
    data.deteriorating = 0
  }
  if (!data.categoryCounts || typeof data.categoryCounts !== 'object') {
    data.categoryCounts = {}
  }

  const CONFIDENCE_TOOLTIP = `\nConfianza = probabilidad de que el activo se mueva según el sesgo macro actual.\n\n• Alta: ~70–80% (correlación fuerte y régimen claro)\n• Media: ~50–60%\n• Baja: <50%\n\nEjemplo: Si el USD está fuerte y EUR/USD tiene confianza Alta, hay alta probabilidad de que EUR/USD caiga.\n`
  const showKeys = (safeSearchParams?.showKeys ?? '') === '1'
  
  // Tipo simple para las filas de la tabla
  type DashboardRow = {
    key: string
    label: string
    category: string
    previous: number | null
    value: number | null
    trend: string | null
    posture: string | null
    weight: number | null
    date: string | null
    originalKey?: string
    unit?: string
  }
  
  // Construir las filas directamente desde apiBias.items
  // IMPORTANTE: Mantener orden determinista para evitar errores de hidratación
  // El orden de los items debe ser el mismo en servidor y cliente
  const apiItems = Array.isArray(apiBias?.items) ? apiBias.items : []
  
  // Mapear items a rows de forma determinista (sin ordenar, mantener orden original)
  // CAUSA RAÍZ DE HIDRATACIÓN: Si se ordena o filtra de forma diferente en servidor vs cliente,
  // React detecta diferencias en el HTML y lanza errores #422 y #425
  // 
  // CAUSA RAÍZ DE TABLA VACÍA: Los datos llegan correctamente desde /api/bias, pero el mapeo
  // debe preservar exactamente los campos que vienen de la API (value, value_previous, date, etc.)
  const rows: DashboardRow[] = apiItems.map((item: any): DashboardRow => {
    // Preservar valores numéricos explícitamente, incluyendo 0
    const value = item.value !== undefined && item.value !== null ? Number(item.value) : null
    const previous = item.value_previous !== undefined && item.value_previous !== null ? Number(item.value_previous) : null
    
    return {
      key: item.key ?? item.seriesId ?? '',
      label: item.label ?? item.originalKey ?? '',
      category: item.category ?? 'Otros',
      previous: previous,
      value: value,
      trend: item.trend ?? null,
      posture: item.posture ?? null,
      weight: item.weight !== undefined && item.weight !== null ? Number(item.weight) : null,
      date: item.date ?? item.latestDate ?? null,
      originalKey: item.originalKey ?? null,
      unit: (item as any).unit ?? null,
    }
  })
  
  // Para cálculos (usdBias, macroQuadrant, etc.) usar apiItems directamente
  const itemsForCalculations = apiItems.map((item: any) => ({
    key: item.key ?? item.seriesId ?? '',
    seriesId: item.seriesId ?? item.key ?? '',
    label: item.label ?? '',
    value: item.value ?? null,
    value_previous: item.value_previous ?? null,
    date: item.date ?? undefined,
    date_previous: item.date_previous ?? undefined,
    trend: item.trend ?? undefined,
    posture: item.posture ?? undefined,
    weight: item.weight ?? undefined,
    category: item.category ?? 'Otros',
    originalKey: item.originalKey ?? item.key ?? undefined,
    unit: (item as any).unit ?? undefined,
  })) as any[]
  
  // Calcular regime y score una sola vez para usar en múltiples lugares
  const regime = apiBias?.regime || data?.regime || 'Neutral'
  const score = apiBias?.score ?? data?.score ?? 0
  
  // 3. Calcular usd, quad, biasRows - pueden fallar, envolver en try-catch
  // Usar items para cálculos (pueden venir de apiBias o data)
  let usd: 'Fuerte' | 'Débil' | 'Neutral' = 'Neutral'
  let quad = 'expansion'
  let biasRows: any[] = []
  
  try {
    usd = usdBias(itemsForCalculations)
    quad = macroQuadrant(itemsForCalculations)
    biasRows = getBiasTable(regime, usd, quad)
  } catch (error) {
    console.warn('[Dashboard] Error calculating usd/quad/biasRows, using defaults', error)
    usd = 'Neutral'
    quad = 'expansion'
    biasRows = []
  }
  
  // Normalizar biasRows
  if (!Array.isArray(biasRows)) {
    biasRows = []
  }
  
  // 4. Get corrMap - ya tiene try-catch
  let corrMap = new Map()
  try {
    corrMap = await getCorrMap()
  } catch (error) {
    console.warn('[Dashboard] getCorrMap failed, using empty map', error)
    corrMap = new Map()
  }
  
  // Normalizar corrMap
  if (!(corrMap instanceof Map)) {
    corrMap = new Map()
  }
  
  // 5. Get tactical rows - puede fallar
  // IMPORTANTE: Mantener orden determinista para evitar errores de hidratación
  let tacticalRows: any[] = []
  try {
    tacticalRows = await getBiasTableTactical(itemsForCalculations, regime, usd, score, [], corrMap)
  } catch (error) {
    console.warn('[Dashboard] getBiasTableTactical failed, using empty array', error)
    tacticalRows = []
  }
  
  // Normalizar tacticalRows
  if (!Array.isArray(tacticalRows)) {
    tacticalRows = []
  }
  
  const color = regime === 'RISK ON' ? 'text-green-600' : regime === 'RISK OFF' ? 'text-red-600' : 'text-gray-600'
  const SHOW_CORR_ON_DASH = false
  const strongCorr: string[] = []
  
  // 6. Detect scenarios - puede fallar
  let scenarios: any[] = []
  try {
    scenarios = detectScenarios(itemsForCalculations, regime)
  } catch (error) {
    console.warn('[Dashboard] detectScenarios failed, using empty array', error)
    scenarios = []
  }
  
  // Normalizar scenarios
  if (!Array.isArray(scenarios)) {
    scenarios = []
  }
  
  // 7. getCorrelations - ya tiene try-catch y timeout
  let corrs: any[] = []
  try {
    corrs = await Promise.race([
      getCorrelations(),
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 10000)) // Timeout de 10s
    ])
  } catch (error) {
    console.warn('[Dashboard] getCorrelations failed, continuing without correlations', error)
    corrs = []
  }
  
  // Normalizar corrs
  if (!Array.isArray(corrs)) {
    corrs = []
  }

  // Calcular si está inicializando (para mostrar aviso, no para bloquear)
  const health = apiBias?.health
  const isInitializing =
    !health?.hasData &&
    (health?.biasCount ?? 0) === 0 &&
    (health?.observationCount ?? 0) === 0 &&
    rows.length === 0

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {isInitializing && (
          <div className="rounded-lg border bg-yellow-50 p-6 text-yellow-900">
            <h2 className="text-lg font-semibold">Inicializando datos…</h2>
            <p className="mt-2 text-sm">
              Estamos preparando la base de datos y recalculando correlaciones y sesgos. 
              El dashboard se actualizará automáticamente cuando los datos estén listos.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-xs">Verificando estado del sistema...</span>
            </div>
          </div>
        )}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Régimen actual del mercado</h1>
            <span title="Score ponderado: Dovish=+1, Neutral=0, Hawkish=−1, umbral |0.30| para RISK ON/OFF. Pesos configurables." className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs text-muted-foreground">i</span>
            <Link href="/ayuda#tecnico" className="text-sm text-muted-foreground hover:text-primary underline">
              ¿Cómo interpretar esto?
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${color}`}>Régimen: <strong>{regime}</strong> ({score.toFixed(2)})</span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">USD: <strong>{usd}</strong></span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">Cuadrante: <strong>{quad}</strong></span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Score: {score.toFixed(2)} | Umbral: {(data?.threshold ?? 0.3).toFixed(2)} | Activos: {data?.counts?.withValue ?? 0}/{data?.counts?.total ?? 0} | Mejoran: {data?.improving ?? 0} | Empeoran: {data?.deteriorating ?? 0}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5">
              <DateDisplay
                isoString={apiBias?.updatedAt}
                format="datetime"
                label="Última actualización de datos macro"
                showTimezone={true}
              />
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-2 py-0.5 text-sm text-muted-foreground">
              <DateDisplay
                isoString={apiBias?.latestDataDate ? `${apiBias.latestDataDate}T00:00:00` : null}
                format="date"
                label="Datos macro hasta"
              />
            </span>
            <a href={`?${new URLSearchParams({ ...safeSearchParams, showKeys: showKeys ? '0' : '1' } as any).toString()}`} className="inline-flex items-center gap-2 rounded border px-3 py-1">{showKeys ? 'Ocultar claves' : 'Mostrar claves'}</a>
            <a href="/api/export" className="ml-auto inline-flex items-center gap-2 rounded border px-3 py-1">Exportar CSV</a>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-2">Escenarios</h2>
          {scenarios.length ? (
            <ul className="space-y-2 text-sm">
              {scenarios
                // CAUSA RAÍZ DE HIDRATACIÓN: El sort debe ser determinista
                // Si dos escenarios tienen la misma severity, el orden debe ser consistente
                // SOLUCIÓN: Añadir criterio secundario (id o título) para garantizar orden determinista
                .sort((a, b) => {
                  const severityOrder = { 'alta': 0, 'media': 1, 'baja': 2 }
                  const aSev = severityOrder[a.severity as keyof typeof severityOrder] ?? 2
                  const bSev = severityOrder[b.severity as keyof typeof severityOrder] ?? 2
                  if (aSev !== bSev) return aSev - bSev
                  // Si misma severity, ordenar por id o título para mantener orden determinista
                  return (a.id || a.title || '').localeCompare(b.id || b.title || '')
                })
                .map((s) => (
                  <li key={s.id} className="rounded border p-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs rounded-full border px-2 py-0.5 ${s.severity === 'alta' ? 'text-red-600' : s.severity === 'media' ? 'text-yellow-600' : 'text-muted-foreground'}`}>{s.severity.toUpperCase()}</span>
                      <span className="font-medium">{s.title}</span>
                    </div>
                    <div className="text-muted-foreground mt-1">{s.why}</div>
                    <div className="mt-1">Sugerencia: <strong>{s.actionHint}</strong></div>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">Sin escenarios destacados.</div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-2">Insights</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Régimen: <strong>{regime}</strong> (score {score.toFixed(2)})</li>
            <li>USD: <strong>{usd}</strong></li>
            {SHOW_CORR_ON_DASH && (
              <li>Correlación 12m fuerte: {strongCorr.length ? strongCorr.join(', ') : '—'}</li>
            )}
          </ul>
          {data.categoryCounts && (() => {
            // Expected counts según indicadores activos definidos:
            // Financieros/Curva: solo T10Y2Y (1)
            // Crecimiento/Actividad: GDP YoY, GDP QoQ anualizado, INDPRO YoY, Retail YoY (4)
            // Mercado laboral: NFP Δ, U3, Claims 4w (3)
            // Precios/Inflación: CPI YoY, Core CPI YoY, PCE YoY, Core PCE YoY, PPI YoY (5)
            // Otros: VIX + FEDFUNDS (2)
            const expectedCounts: Record<string, number> = {
              'Financieros / Curva': 1,
              'Crecimiento / Actividad': 4,
              'Mercado laboral': 3,
              'Precios / Inflación': 5,
              'Otros': 2,
            }
            const hasInconsistency = CATEGORY_ORDER.some(cat => {
              const c = (data.categoryCounts as any)[cat]
              if (!c || c.total === 0) return false
              const expected = expectedCounts[cat]
              return typeof expected === 'number' && c.total !== expected
            })
            
            return (
              <>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {CATEGORY_ORDER.map(cat => {
                    const c = (data.categoryCounts as any)[cat]
                    if (!c || c.total === 0) return null
                    return <span key={cat} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">{cat}: {c.withValue}/{c.total}</span>
                  })}
                </div>
                {hasInconsistency && (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ⚠️ Mapa-categorías inconsistente: verificar configuración
                  </div>
                )}
              </>
            )
          })()}
        </div>


        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Indicadores macro</h2>
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">No hay datos de indicadores todavía.</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Variable</th>
                  <th className="px-3 py-2 text-left">Dato anterior</th>
                  <th className="px-3 py-2 text-left">Dato actual</th>
                  <th className="px-3 py-2 text-left" title="Comparación entre el último dato y el anterior. Interpretación basada en el criterio macroeconómico del indicador.">Evolución</th>
                  <th className="px-3 py-2 text-left">Postura</th>
                  <th className="px-3 py-2 text-left">Peso</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map(cat => {
                  const categoryRows = rows.filter((row: DashboardRow) => row.category === cat)
                  
                  // SIEMPRE renderizar la categoría, aunque esté vacía
                  if (!categoryRows.length) {
                    return (
                      <Fragment key={cat}>
                        <tr className="bg-muted/50 border-t">
                          <td colSpan={7} className="text-sm font-semibold uppercase tracking-wide py-2 px-3">{cat}</td>
                        </tr>
                        <tr className="border-t">
                          <td colSpan={7} className="px-3 py-2 text-center text-muted-foreground text-sm">
                            No hay indicadores en esta categoría
                          </td>
                        </tr>
                      </Fragment>
                    )
                  }
                  return (
                    <Fragment key={cat}>
                      <tr className="bg-muted/50 border-t">
                        <td colSpan={7} className="text-sm font-semibold uppercase tracking-wide py-2 px-3">{cat}</td>
                      </tr>
                      {categoryRows
                        // Deduplicación determinista: mantener solo la primera ocurrencia de cada key
                        // Esto asegura que el orden sea consistente entre servidor y cliente
                        .filter((() => {
                          const seen = new Set<string>()
                          return (x: DashboardRow) => {
                            const k = String(x.key)
                            if (seen.has(k)) return false
                            seen.add(k)
                            return true
                          }
                        })())
                        // IMPORTANTE: No ordenar aquí - mantener orden original para consistencia SSR/CSR
                        .map((row: DashboardRow) => {
                        const isPayemsDelta = typeof row.label === 'string' && row.label.includes('Payrolls Δ')
                        const formatValue = (v: number | null | undefined) => {
                          // Verificar explícitamente null y undefined
                          if (v === null || v === undefined) return '—'
                          if (!Number.isFinite(v)) return String(v)
                          return isPayemsDelta ? Math.round(v).toString() : v.toFixed(2)
                        }
                        const valCurrent = formatValue(row.value)
                        const valPrevious = formatValue(row.previous)
                        const p = row.posture ?? 'Neutral'
                        const trend = row.trend
                        const trendColor = trend === 'Mejora' ? 'text-green-600' : trend === 'Empeora' ? 'text-red-600' : trend === 'Estable' ? 'text-gray-500' : 'text-muted-foreground'
                        const trendBadge = trend === 'Mejora' ? 'bg-green-600/10 text-green-700' : trend === 'Empeora' ? 'bg-red-600/10 text-red-700' : trend === 'Estable' ? 'bg-gray-500/10 text-gray-700' : 'bg-gray-500/10 text-gray-500'
                        // Obtener metadata de fuente para auditoría
                        const sourceInfo = getIndicatorSource(row.key)
                        
                        return (
                          <tr key={String(row.key)} className="border-t">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span>{row.label}</span>
                                {sourceInfo && (
                                  <a
                                    href={sourceInfo.sourceUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground"
                                    title={`Fuente: ${sourceInfo.source} (${sourceInfo.seriesId})${row.date ? ` | Dato a cierre de ${(() => {
                                      // CAUSA RAÍZ DE HIDRATACIÓN: toLocaleDateString puede generar diferentes resultados
                                      // entre servidor y cliente debido a diferencias de timezone o locale.
                                      // SOLUCIÓN: Usar formato determinista basado en UTC que no dependa de locale
                                      try {
                                        const date = new Date(row.date)
                                        if (isNaN(date.getTime())) return ''
                                        // Formato determinista: mes en español hardcodeado + año UTC
                                        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
                                        const month = monthNames[date.getUTCMonth()]
                                        const year = date.getUTCFullYear()
                                        return `${month} ${year}`
                                      } catch {
                                        return ''
                                      }
                                    })()}` : ''} - ${sourceInfo.description || ''}`}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </a>
                                )}
                                {showKeys ? <span className="text-muted-foreground text-xs"> {' ' }[{row.key}]</span> : null}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{valPrevious}{row.previous != null && row.unit ? ` ${row.unit}` : ''}</td>
                            <td className="px-3 py-2">{valCurrent}{row.value != null && row.unit ? ` ${row.unit}` : ''}</td>
                            <td className="px-3 py-2">
                              {trend ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${trendBadge}`}>
                                  {trend}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{p}</td>
                            <td className="px-3 py-2">{row.weight != null ? row.weight.toFixed(2) : '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span>{row.date ?? '—'}</span>
                                {row.date && (() => {
                                  // Use originalKey for freshness (e.g., 'gdp_yoy', 'cpi_yoy') instead of weightKey (e.g., 'GDPC1')
                                  const indicatorKey = row.originalKey || row.key.toLowerCase()
                                  const freshness = isStaleByFrequency(row.date, indicatorKey)
                                  if (freshness.isStale) {
                                    const freqLabel = getFrequencyLabel(freshness.frequency)
                                    const sla = SLA_BY_FREQUENCY[freshness.frequency]
                                    const slaLabel = sla.useBusinessDays ? `${sla.maxDays} días hábiles` : `${sla.maxDays} días naturales`
                                    return (
                                      <span 
                                        className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5" 
                                        title={`Serie ${freqLabel}; último dato: ${row.date}; SLA: ${slaLabel}`}
                                      >
                                        Desactualizado
                                      </span>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b"><h2 className="font-semibold">Sesgo por par</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Par / Activo</th>
                  <th className="px-3 py-2 text-left">Sesgo macro</th>
                  <th className="px-3 py-2 text-left">Acción recomendada</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {biasRows.map(r => (
                  <tr key={r.par} className="border-t">
                    <td className="px-3 py-2">{r.par}</td>
                    <td className="px-3 py-2">{r.sesgoMacro}</td>
                    <td className="px-3 py-2">{r.accion}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Mapa de sesgos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Par / Activo</th>
                  <th className="px-3 py-2 text-left">Tendencia</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-left">Confianza <InfoTooltip text={CONFIDENCE_TOOLTIP} /></th>
                  <th className="px-3 py-2 text-left" title="Correlación de Pearson entre rendimientos diarios (activo vs. DXY)">Corr. 12m (ref)</th>
                  <th className="px-3 py-2 text-left" title="Correlación de Pearson entre rendimientos diarios (activo vs. DXY)">Corr. 3m</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {tacticalRows.map(r => {
                  // IMPORTANTE: Render determinista - no usar valores que cambien entre servidor y cliente
                  const badge = r.tactico === 'Alcista' ? 'bg-emerald-600/10 text-emerald-700' : r.tactico === 'Bajista' ? 'bg-rose-600/10 text-rose-700' : 'bg-gray-500/10 text-gray-700'
                  const confBadge = r.confianza === 'Alta' ? 'bg-green-600/10 text-green-700' : r.confianza === 'Media' ? 'bg-amber-600/10 text-amber-700' : 'bg-gray-500/10 text-gray-700'
                  const corrIntensity = (v?: number | null) => {
                    if (v == null) return { color: 'text-muted-foreground', label: '—' }
                    const abs = Math.abs(v)
                    // |ρ| ≥ 0.60 → fuerte (verde si +, rojo si –)
                    if (abs >= 0.60) return { color: v > 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold', label: 'fuerte' }
                    // 0.30 ≤ |ρ| < 0.60 → moderada
                    if (abs >= 0.30) return { color: v > 0 ? 'text-green-600' : 'text-red-600', label: 'moderada' }
                    // |ρ| < 0.30 → débil (gris)
                    return { color: 'text-gray-500', label: 'débil' }
                  }
                  const corr12Int = corrIntensity(r.corr12m)
                  const corr3Int = corrIntensity(r.corr3m)
                  
                  const formatCorr = (v: number | null | undefined, window: '3m' | '12m', symbol: string, row: any) => {
                    if (v == null) {
                      return (
                        <span className="text-muted-foreground" title="Correlación no disponible o datos insuficientes">
                          —
                        </span>
                      )
                    }
                    const corrColor = corrIntensity(v).color
                    return (
                      <CorrelationTooltip 
                        correlation={v} 
                        symbol={symbol} 
                        window={window} 
                        usdBias={usd}
                        corr12m={row.corr12m}
                        corr3m={row.corr3m}
                      >
                        <span className={corrColor}>
                          {v.toFixed(2)} (DXY)
                        </span>
                      </CorrelationTooltip>
                    )
                  }
                  
                  return (
                    <tr key={r.par} className="border-t">
                      <td className="px-3 py-2">
                        <Link href={`/narrativas/${r.par.replace('/', '')}`} className="hover:text-primary underline">
                          {r.par}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badge}`}>{r.tactico}</span></td>
                      <td className="px-3 py-2">{r.accion}</td>
                      <td className="px-3 py-2">
                        <ConfidenceTooltip
                          pair={r.par}
                          confianza={r.confianza || 'Baja'}
                          usdBias={usd}
                          corr12m={r.corr12m ?? null}
                          corr3m={r.corr3m ?? null}
                        >
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${confBadge} cursor-help`}>
                            {r.confianza || 'Baja'}
                          </span>
                        </ConfidenceTooltip>
                        <div className="text-[11px] text-muted-foreground">
                          {r.accion === 'Buscar ventas' ? '→ Mayor prob. de caída' : r.accion === 'Buscar compras' ? '→ Mayor prob. de subida' : '→ Prob. de rango lateral'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {formatCorr(r.corr12m, '12m', r.par, r)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCorr(r.corr3m, '3m', r.par, r)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.motivo}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {SHOW_CORR_ON_DASH ? (
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b"><h2 className="font-semibold">Correlaciones con USD amplio (mensual)</h2></div>
            <div className="overflow-x-auto">
              {/* Contenido oculto por flag */}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}


