import { z } from 'zod'

export const LABELS: Record<string, string> = {
  // Financieros / Curva
  T10Y2Y: 'Curva 10Y–2Y (spread %)',
  T10Y3M: '10Y–3M',
  T5YIE: 'Breakeven 5Y',
  NFCI: 'NFCI',
  DTWEXBGS: 'Broad USD (DXY proxy)',
  // Crecimiento / Actividad
  GDPC1: 'PIB Interanual (GDP YoY)',
  GDPC1_QOQ: 'PIB Trimestral (GDP QoQ Anualizado)',
  RSXFS: 'Ventas Minoristas (YoY)',
  INDPRO: 'Producción Industrial (YoY)',
  TCU: 'Capacity Utilization',
  DGEXFI: 'Durable Goods Orders YoY',
  TTLCONS: 'Construction YoY',
  USSLIND: 'Leading Index (LEI) YoY',
  // Mercado laboral
  PAYEMS: 'Nóminas No Agrícolas (NFP Δ miles)',
  UNRATE: 'Tasa de Desempleo (U3)',
  U6RATE: 'Unemployment U6 (%)',
  ICSA: 'Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas)',
  JTSQUR: 'Quits rate',
  JTSJOL: 'JOLTS job openings level',
  // Precios / Inflación
  PCEPI: 'Inflación PCE (YoY)',
  PCEPILFE: 'Inflación Core PCE (YoY)',
  CPIAUCSL: 'Inflación CPI (YoY)',
  CPILFESL: 'Inflación Core CPI (YoY)',
  PPIACO: 'Índice de Precios al Productor (PPI YoY)',
  // Vivienda
  HOUST: 'Housing Starts YoY',
  NAHB: 'NAHB',
  // Encuestas
  UMCSENT: 'Confianza del Consumidor',
  NFIBBUSI: 'NFIB Small Business Optimism',
  CONCCONF: 'Consumer Confidence (Conference Board)',
  USPMI: 'ISM Manufacturero (PMI)',
  PMI_SERV: 'ISM Servicios (PMI)',
  // Política Monetaria
  FEDFUNDS: 'Tasa Efectiva de Fondos Federales',
  // Confianza / Sentimiento
  VIXCLS: 'Índice de Volatilidad VIX',
}

export const labelOf = (key: string) => LABELS[key] ?? key

export function buildFredObservationsUrl(seriesId: string, apiKey: string, params?: Record<string, string | number | boolean>) {
  const url = new URL('https://api.stlouisfed.org/fred/series/observations')
  url.searchParams.set('series_id', seriesId)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('file_type', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export type SeriesPoint = { 
  date: string // realtime_start (fecha de publicación) para mostrar
  value: number
  observation_period?: string // observation_date (periodo del dato) para cálculos internos
}

const FredResponseSchema = z.object({
  observations: z.array(
    z.object({
      date: z.string(), // observation_date (periodo del dato)
      value: z.string(),
      realtime_start: z.string().optional().nullable(), // Fecha de publicación (puede no estar presente)
      realtime_end: z.string().optional().nullable(), // Fecha fin de publicación (puede no estar presente)
    }).passthrough() // Permitir campos adicionales que FRED pueda devolver
  ),
})

const isServer = typeof window === 'undefined'

// Rate limiting: FRED allows 120 requests per minute
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL_MS = 300 // ~200 requests per minute (más agresivo pero seguro)

async function rateLimitedFetch(url: string, retries: number = 1): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Rate limiting: ensure minimum interval between requests
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest))
    }
    lastRequestTime = Date.now()

    const res = await fetch(url, { 
      next: { revalidate: 0 },
    })

    // Handle rate limit (429)
    if (res.status === 429) {
      if (attempt < retries) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        continue
      }
      throw new Error(`FRED rate limit exceeded for ${url}`)
    }

    if (!res.ok) {
      if (attempt < retries && res.status >= 500) {
        // Retry on server errors with exponential backoff
        const delay = Math.min(300 * Math.pow(2, attempt), 2000)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw new Error(`FRED ${url} ${res.status}`)
    }

    return res
  }
  throw new Error(`FRED fetch failed after ${retries} retries`)
}

export async function fetchFredSeries(
  seriesId: string,
  params?: { observation_start?: string; observation_end?: string; frequency?: 'd' | 'm' | 'q'; units?: string }
): Promise<SeriesPoint[]> {
  const qs = new URLSearchParams({
    observation_start: params?.observation_start ?? '2010-01-01',
  })
  if (params?.observation_end) qs.set('observation_end', params.observation_end)
  if (params?.frequency) qs.set('frequency', params.frequency)
  if (params?.units) qs.set('units', params.units)
  // Añadir realtime_start y realtime_end para obtener fecha de publicación
  // FRED API requiere que si units != 'lin', entonces realtime_start debe igualar realtime_end
  const today = new Date().toISOString().split('T')[0]
  qs.set('realtime_start', today) // Obtener versión más reciente del dato
  // Si se usa units (transformación), realtime_end debe ser igual a realtime_start
  if (params?.units && params.units !== 'lin') {
    qs.set('realtime_end', today) // Requerido por FRED cuando units != 'lin'
  }

  let url: string
  if (isServer) {
    const key = process.env.FRED_API_KEY!
    url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&${qs.toString()}`
  } else {
    url = `/api/fred/${seriesId}?${qs.toString()}`
  }

  // Fetch with rate limiting and retries
  const res = await rateLimitedFetch(url)
  
  // Log response status para debugging (especialmente útil para FEDFUNDS)
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unable to read error response')
    throw new Error(`FRED API error for ${seriesId}: ${res.status} ${res.statusText} - ${errorText.substring(0, 200)}`)
  }
  
  const json = await res.json().catch((error) => {
    throw new Error(`Failed to parse FRED JSON response for ${seriesId}: ${error instanceof Error ? error.message : String(error)}`)
  })
  
  // Validar estructura de respuesta antes de parsear
  if (!json || typeof json !== 'object' || !Array.isArray(json.observations)) {
    throw new Error(`Invalid FRED response structure for ${seriesId}: expected {observations: []}, got ${JSON.stringify(json).substring(0, 200)}`)
  }
  
  // Parsear con manejo de errores más robusto
  let parsed
  try {
    parsed = FredResponseSchema.parse(json)
  } catch (parseError) {
    // Si falla el parseo, intentar parsear sin realtime_start/realtime_end
    console.warn(`[fetchFredSeries] Schema parse failed for ${seriesId}, trying fallback:`, parseError)
    // Intentar parsear solo con campos básicos
    const fallbackSchema = z.object({
      observations: z.array(
        z.object({
          date: z.string(),
          value: z.string(),
        }).passthrough()
      ),
    })
    try {
      parsed = fallbackSchema.parse(json)
    } catch (fallbackError) {
      // Si también falla el fallback, lanzar error original
      throw new Error(`Failed to parse FRED response for ${seriesId}: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }
  }

  // Agrupar por observation_date y tomar la versión más reciente (mayor realtime_start)
  const byObservationDate = new Map<string, typeof parsed.observations[0]>()
  
  for (const obs of parsed.observations) {
    if (obs.value === '.' || obs.value === null || obs.value === undefined) continue
    
    const existing = byObservationDate.get(obs.date)
    if (!existing) {
      byObservationDate.set(obs.date, obs)
    } else {
      // Si hay realtime_start, preferir la versión más reciente
      const existingRealtime = existing.realtime_start && typeof existing.realtime_start === 'string' ? new Date(existing.realtime_start).getTime() : 0
      const currentRealtime = obs.realtime_start && typeof obs.realtime_start === 'string' ? new Date(obs.realtime_start).getTime() : 0
      if (currentRealtime > existingRealtime) {
        byObservationDate.set(obs.date, obs)
      }
    }
  }
  
  const items: SeriesPoint[] = Array.from(byObservationDate.values())
    .map((o): SeriesPoint | null => {
      const numValue = Number(o.value)
      if (!Number.isFinite(numValue)) return null
      
      // Para datos transformados (units != 'lin'), usar observation_date como fecha principal
      // porque los valores transformados son específicos del periodo, no de la fecha de publicación
      // Para datos de nivel (units='lin' o sin units), usar realtime_start como fecha de publicación
      const isTransformed = params?.units && params.units !== 'lin'
      
      if (isTransformed) {
        // Datos transformados: usar observation_date (periodo) como fecha principal
        return {
          date: o.date, // Periodo del dato (ej: 2025-09-01)
          value: numValue,
          observation_period: o.date, // Mismo que date para datos transformados
        }
      } else {
        // Datos de nivel: usar realtime_start como fecha de publicación
        const releaseDate = (typeof o.realtime_start === 'string' ? o.realtime_start : null) || o.date
        const observationPeriod = (typeof o.realtime_start === 'string' && o.realtime_start !== o.date) ? o.date : undefined
        return {
          date: releaseDate, // Fecha de publicación
          value: numValue,
          observation_period: observationPeriod, // Periodo del dato si difiere
        }
      }
    })
    .filter((o): o is SeriesPoint => o !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return items
}

// Helpers numéricos (funciones puras)
export function yoy(series: SeriesPoint[]): SeriesPoint[] {
  if (series.length === 0) return []
  const byDate = new Map(series.map(p => [p.date, p.value]))
  const out: SeriesPoint[] = []
  for (const p of series) {
    const year = p.date.slice(0, 4)
    const monthDay = p.date.slice(5)
    const prevDate = `${Number(year) - 1}-${monthDay}`
    const prev = byDate.get(prevDate)
    if (prev !== undefined && prev !== 0) {
      out.push({ date: p.date, value: ((p.value - prev) / Math.abs(prev)) * 100 })
    }
  }
  return out
}

export function mom(series: SeriesPoint[]): SeriesPoint[] {
  if (series.length < 2) return []
  const out: SeriesPoint[] = []
  for (let i = 1; i < series.length; i++) {
    const curr = series[i]
    const prev = series[i - 1]
    out.push({ date: curr.date, value: curr.value - prev.value })
  }
  return out
}

export function last(series: SeriesPoint[]): SeriesPoint | null {
  if (series.length === 0) return null
  return series[series.length - 1]
}

export function sma(series: SeriesPoint[], n: number): SeriesPoint[] {
  if (n <= 0) return []
  const out: SeriesPoint[] = []
  let sum = 0
  for (let i = 0; i < series.length; i++) {
    sum += series[i].value
    if (i >= n) sum -= series[i - n].value
    if (i >= n - 1) out.push({ date: series[i].date, value: sum / n })
  }
  return out
}

// Adaptadores por indicador
export type LatestPoint = { key: string; label: string; value: number | null; unit?: string; date?: string; note?: string }

async function latestValue(seriesId: string, opts?: { frequency?: 'd' | 'm' | 'q' }) {
  // Obtener datos frescos sin caché
  const s = await fetchFredSeries(seriesId, { 
    frequency: opts?.frequency,
    // Asegurar que obtenemos datos hasta hoy
    observation_end: new Date().toISOString().slice(0, 10)
  })
  // Ordenar por fecha descendente y tomar el último (más reciente)
  const sorted = [...s].sort((a, b) => b.date.localeCompare(a.date))
  return sorted[0] ?? null
}

export async function t10y2y(): Promise<LatestPoint> {
  try {
    const p = await latestValue('T10Y2Y', { frequency: 'd' })
    return { key: 't10y2y', label: labelOf('T10Y2Y'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch (e) {
    return { key: 't10y2y', label: 'Curva 10Y–2Y (spread %)', value: null, unit: '%', note: 'error' }
  }
}

export async function t10y3m(): Promise<LatestPoint> {
  try {
    const p = await latestValue('T10Y3M', { frequency: 'd' })
    return { key: 't10y3m', label: labelOf('T10Y3M'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 't10y3m', label: '10Y-3M', value: null, unit: '%', note: 'error' }
  }
}

export async function breakeven5y(): Promise<LatestPoint> {
  try {
    const p = await latestValue('T5YIE', { frequency: 'm' })
    return { key: 'breakeven5y', label: labelOf('T5YIE'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'breakeven5y', label: 'Breakeven 5Y', value: null, unit: '%', note: 'error' }
  }
}

export async function nfci(): Promise<LatestPoint> {
  try {
    const p = await latestValue('NFCI', { frequency: 'm' })
    return { key: 'nfci', label: labelOf('NFCI'), value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'nfci', label: 'NFCI', value: null, note: 'error' }
  }
}

export async function twex(): Promise<LatestPoint> {
  try {
    const p = await latestValue('DTWEXBGS', { frequency: 'm' })
    return { key: 'twex', label: labelOf('DTWEXBGS'), value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'twex', label: 'Broad USD (DXY proxy)', value: null, note: 'error' }
  }
}

export async function gdp_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('GDPC1', { 
      frequency: 'q',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'gdp_yoy', label: labelOf('GDPC1'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'gdp_yoy', label: 'PIB Interanual (GDP YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function retail_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('RSXFS', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'retail_yoy', label: labelOf('RSXFS'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'retail_yoy', label: 'Ventas Minoristas (YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function indpro_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('INDPRO', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'indpro_yoy', label: labelOf('INDPRO'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'indpro_yoy', label: 'Producción Industrial (YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function caputil(): Promise<LatestPoint> {
  try {
    const p = await latestValue('TCU', { frequency: 'm' })
    return { key: 'caputil', label: labelOf('TCU'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'caputil', label: 'Capacity Utilization', value: null, unit: '%', note: 'error' }
  }
}

export async function durables_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('DGEXFI', { frequency: 'm' })
    const y = yoy(s)
    const p = last(y)
    return { key: 'durables_yoy', label: labelOf('DGEXFI'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'durables_yoy', label: 'Durable Goods Orders YoY', value: null, unit: '%', note: 'error' }
  }
}

export async function construction_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('TTLCONS', { frequency: 'm' })
    const y = yoy(s)
    const p = last(y)
    return { key: 'construction_yoy', label: labelOf('TTLCONS'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'construction_yoy', label: 'Construction YoY', value: null, unit: '%', note: 'error' }
  }
}

export async function payems_delta(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('PAYEMS', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const m = mom(s)
    const p = last(m)
    const val = p ? p.value : null
    return { key: 'payems_delta', label: labelOf('PAYEMS'), value: val, unit: 'k', date: p?.date }
  } catch {
    return { key: 'payems_delta', label: 'Nóminas No Agrícolas (NFP Δ miles)', value: null, unit: 'k', note: 'error' }
  }
}

export async function unrate(): Promise<LatestPoint> {
  try {
    const p = await latestValue('UNRATE', { frequency: 'm' })
    return { key: 'unrate', label: labelOf('UNRATE'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'unrate', label: 'Tasa de Desempleo (U3)', value: null, unit: '%', note: 'error' }
  }
}

// Helper para añadir observation_end a todas las llamadas
function withTodayEnd<T extends { observation_end?: string }>(params: T): T & { observation_end: string } {
  return {
    ...params,
    observation_end: new Date().toISOString().slice(0, 10)
  }
}

export async function claims_4w(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('ICSA', { 
      frequency: 'w' as any,
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const s4 = sma(s, 4)
    const p = last(s4)
    return { key: 'claims_4w', label: labelOf('ICSA'), value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'claims_4w', label: 'Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas)', value: null, note: 'error' }
  }
}

export async function quits(): Promise<LatestPoint> {
  try {
    const p = await latestValue('JTSQUR')
    if (!p) return { key: 'quits', label: labelOf('JTSQUR'), value: null, note: 'pendiente' }
    return { key: 'quits', label: labelOf('JTSQUR'), value: p.value, date: p.date }
  } catch {
    return { key: 'quits', label: 'Quits rate', value: null, note: 'pendiente' }
  }
}

export async function jolts_ratio(): Promise<LatestPoint> {
  return { key: 'jolts_ratio', label: 'JOLTS job openings ratio', value: null, note: 'pendiente' }
}

export async function pce_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('PCEPI', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'pce_yoy', label: labelOf('PCEPI'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'pce_yoy', label: 'Inflación PCE (YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function corepce_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('PCEPILFE', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'corepce_yoy', label: labelOf('PCEPILFE'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'corepce_yoy', label: 'Inflación Core PCE (YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function cpi_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('CPIAUCSL', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'cpi_yoy', label: labelOf('CPIAUCSL'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'cpi_yoy', label: 'Inflación CPI (YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function corecpi_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('CPILFESL', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'corecpi_yoy', label: labelOf('CPILFESL'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'corecpi_yoy', label: 'Inflación Core CPI (YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function ppi_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('PPIACO', { 
      frequency: 'm',
      observation_end: new Date().toISOString().slice(0, 10) // Hasta hoy
    })
    const y = yoy(s)
    const p = last(y)
    return { key: 'ppi_yoy', label: labelOf('PPIACO'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'ppi_yoy', label: 'Índice de Precios al Productor (PPI YoY)', value: null, unit: '%', note: 'error' }
  }
}

export async function umich(): Promise<LatestPoint> {
  try {
    const p = await latestValue('UMCSENT', { frequency: 'm' })
    return { key: 'umich', label: labelOf('UMCSENT'), value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'umich', label: 'Confianza del Consumidor', value: null, note: 'error' }
  }
}

export async function nfib(): Promise<LatestPoint> {
  try {
    // Preferimos NFIBBUSI (optimismo de pequeñas empresas). Si falla, intentamos NFIBSL
    let p = await latestValue('NFIBBUSI', { frequency: 'm' })
    if (!p) p = await latestValue('NFIBSL', { frequency: 'm' })
    return { key: 'nfib', label: 'NFIB Small Business Optimism', value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'nfib', label: 'NFIB Small Business Optimism', value: null, note: 'error' }
  }
}

export async function pmi_mfg(): Promise<LatestPoint> {
  try {
    const p = await latestValue('USPMI', { frequency: 'm' })
    if (!p) return { key: 'pmi_mfg', label: labelOf('USPMI'), value: null, note: 'pendiente' }
    return { key: 'pmi_mfg', label: labelOf('USPMI'), value: p.value, date: p.date }
  } catch {
    return { key: 'pmi_mfg', label: 'ISM Manufacturero (PMI)', value: null, note: 'pendiente' }
  }
}

export async function pmi_svcs(): Promise<LatestPoint> {
  return { key: 'pmi_svcs', label: labelOf('PMI_SERV'), value: null, note: 'pendiente TradingEconomics' }
}

export async function housing_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('HOUST', { frequency: 'm' })
    const y = yoy(s)
    const p = last(y)
    return { key: 'housing_yoy', label: 'Housing Starts YoY', value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'housing_yoy', label: 'Housing Starts YoY', value: null, unit: '%', note: 'error' }
  }
}

export async function nahb(): Promise<LatestPoint> {
  try {
    const p = await latestValue('NAHB', { frequency: 'm' })
    return { key: 'nahb', label: 'NAHB', value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'nahb', label: 'NAHB', value: null, note: 'error' }
  }
}

export async function consumer_confidence(): Promise<LatestPoint> {
  try {
    const p = await latestValue('CONCCONF', { frequency: 'm' })
    if (!p) return { key: 'consumer_confidence', label: 'Consumer Confidence (Conference Board)', value: null, note: 'pendiente' }
    return { key: 'consumer_confidence', label: 'Consumer Confidence (Conference Board)', value: p.value, date: p.date }
  } catch {
    return { key: 'consumer_confidence', label: 'Consumer Confidence (Conference Board)', value: null, note: 'pendiente' }
  }
}

// Leading Index (Conference Board) - YoY %
export async function lei_yoy(): Promise<LatestPoint> {
  try {
    const series = await fetchFredSeries('USSLIND', { frequency: 'm' })
    const yy = yoy(series)
    const lastPt = yy.at(-1)
    return { key: 'USSLIND', label: 'Leading Index (LEI) YoY', value: lastPt?.value ?? null, unit: '%', date: lastPt?.date }
  } catch {
    return { key: 'USSLIND', label: 'Leading Index (LEI) YoY', value: null, unit: '%', note: 'error' }
  }
}

// Underemployment U6 rate (%)
export async function u6rate(): Promise<LatestPoint> {
  try {
    const series = await fetchFredSeries('U6RATE', { frequency: 'm' })
    const lastPt = series.at(-1)
    return { key: 'U6RATE', label: 'Unemployment U6 (%)', value: lastPt?.value ?? null, unit: '%', date: lastPt?.date }
  } catch {
    return { key: 'U6RATE', label: 'Unemployment U6 (%)', value: null, unit: '%', note: 'error' }
  }
}

export async function jolts_openings_yoy(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('JTSJOL', { frequency: 'm' })
    const y = yoy(s)
    const p = last(y)
    return { key: 'jolts_openings_yoy', label: 'JOLTS Openings YoY', value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'jolts_openings_yoy', label: 'JOLTS Openings YoY', value: null, unit: '%', note: 'pendiente' }
  }
}

export type IndicatorKey =
  | 'cpi_yoy'
  | 'corecpi_yoy'
  | 'pce_yoy'
  | 'corepce_yoy'
  | 'ppi_yoy'
  | 'gdp_qoq'
  | 'gdp_yoy'
  | 'indpro_yoy'
  | 'retail_yoy'
  | 'payems_delta'
  | 'unrate'
  | 'claims_4w'
  | 't10y2y'
  | 'fedfunds'
  | 'vix'

// VIX helper (risk modulator)
export async function vix(): Promise<LatestPoint> {
  try {
    const p = await latestValue('VIXCLS', { frequency: 'd' })
    return { key: 'vix', label: labelOf('VIXCLS'), value: p?.value ?? null, date: p?.date }
  } catch {
    return { key: 'vix', label: 'Índice de Volatilidad VIX', value: null, note: 'error' }
  }
}

// GDP QoQ Annualized helper
export async function gdp_qoq_annualized(): Promise<LatestPoint> {
  try {
    const s = await fetchFredSeries('GDPC1', { frequency: 'q' })
    if (s.length < 2) return { key: 'gdp_qoq', label: labelOf('GDPC1_QOQ'), value: null, unit: '%', note: 'insufficient data' }
    const recent = s[s.length - 1]
    const prev = s[s.length - 2]
    if (recent && prev && prev.value !== 0) {
      const qoq = ((recent.value / prev.value) ** 4 - 1) * 100
      return { key: 'gdp_qoq', label: labelOf('GDPC1_QOQ'), value: qoq, unit: '%', date: recent.date }
    }
    return { key: 'gdp_qoq', label: labelOf('GDPC1_QOQ'), value: null, unit: '%', note: 'error' }
  } catch {
    return { key: 'gdp_qoq', label: labelOf('GDPC1_QOQ'), value: null, unit: '%', note: 'error' }
  }
}

// Fed Funds Rate helper
export async function fedfunds(): Promise<LatestPoint> {
  try {
    const p = await latestValue('FEDFUNDS', { frequency: 'm' })
    return { key: 'fedfunds', label: labelOf('FEDFUNDS'), value: p?.value ?? null, unit: '%', date: p?.date }
  } catch {
    return { key: 'fedfunds', label: 'Tasa Efectiva de Fondos Federales', value: null, unit: '%', note: 'error' }
  }
}

/**
 * Get only the 16 curated high-impact indicators
 * Based on globally recognized KPIs from ForexFactory, TradingEconomics, Investing.com
 */
export async function getAllLatest(): Promise<LatestPoint[]> {
  const tasks: Array<Promise<LatestPoint>> = [
    // Inflation (5) - añadido PCE YoY general
    cpi_yoy(),
    corecpi_yoy(),
    pce_yoy(),
    corepce_yoy(),
    ppi_yoy(),
    // Growth (4)
    gdp_qoq_annualized(),
    gdp_yoy(),
    indpro_yoy(),
    retail_yoy(),
    // Employment (3)
    payems_delta(),
    unrate(),
    claims_4w(),
    // Monetary Policy (2) - añadido Curva 10Y-2Y
    t10y2y(),
    fedfunds(),
    // Risk Modulator (1)
    vix(),
  ]
  // Cada adaptador ya maneja sus propios errores devolviendo value:null
  const results = await Promise.all(tasks)
  return results
}



