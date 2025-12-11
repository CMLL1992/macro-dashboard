/**
 * Fetch daily price data for assets and DXY
 */

import { fetchFredSeries } from '@/lib/fred'
import type { PricePoint } from './calc'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'

/**
 * Yahoo Finance daily data
 */
async function fetchYahooDaily(symbol: string, period: string = '5y'): Promise<PricePoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(period)}&includePrePost=false`
  // Forzar fetch fresco para obtener datos actualizados
  const r = await fetch(url, { 
    headers: { 'User-Agent': UA, Accept: 'application/json' }, 
    cache: 'no-store',
    next: { revalidate: 0 }
  })
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`)
  const j = await r.json()
  const res = j?.chart?.result?.[0]
  if (!res?.timestamp || !res?.indicators?.quote?.[0]?.close) return []
  const ts: number[] = res.timestamp
  const cl: (number | null)[] = res.indicators.quote[0].close
  const out: PricePoint[] = []
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    const c = cl[i]
    if (c == null || Number.isNaN(c)) continue
    const d = new Date(t * 1000)
    const date = d.toISOString().slice(0, 10) // YYYY-MM-DD
    out.push({ date, value: +c })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Map of symbols to Yahoo Finance symbols
 */
const YAHOO_MAP: Record<string, string | string[]> = {
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  AUDUSD: 'AUDUSD=X',
  USDJPY: 'USDJPY=X',
  USDCAD: 'USDCAD=X',
  XAUUSD: ['XAUUSD=X', 'GC=F'],
  SPX: '^GSPC',
  NDX: '^NDX',
  BTCUSDT: 'BTC-USD',
  BTCUSD: 'BTC-USD',
  ETHUSDT: 'ETH-USD',
  ETHUSD: 'ETH-USD',
}

/**
 * Fetch daily DXY data from FRED (DTWEXBGS)
 */
export async function fetchDXYDaily(): Promise<PricePoint[]> {
  try {
    // Obtener datos diarios de DXY (5 años de histórico para correlaciones)
    // Usar fetchFredSeries directamente con parámetros específicos para obtener datos históricos completos
    const { fetchFredSeries } = await import('@/lib/fred')
    const apiKey = process.env.FRED_API_KEY
    if (!apiKey) {
      throw new Error('FRED_API_KEY not configured')
    }
    
    // Construir URL directamente para evitar realtime_start que limita resultados
    const observationStart = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const observationEnd = new Date().toISOString().slice(0, 10)
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${apiKey}&file_type=json&frequency=d&observation_start=${observationStart}&observation_end=${observationEnd}`
    
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`FRED API error for DXY: ${res.status}`)
    }
    
    const json = await res.json()
    if (!json || !Array.isArray(json.observations)) {
      throw new Error('Invalid FRED response for DXY')
    }
    
    const series = json.observations
      .map((obs: any) => ({
        date: obs.date,
        value: obs.value === '.' ? null : parseFloat(obs.value),
      }))
      .filter((obs: any) => obs.value != null && Number.isFinite(obs.value))
      .map((obs: any) => ({ date: obs.date, value: obs.value }))
    // Filtrar solo datos válidos
    const valid = series
      .map((p: { date: string; value: number | null }) => ({ date: p.date, value: p.value }))
      .filter((p: { date: string; value: number | null }) => p.value != null && Number.isFinite(p.value))
    
    // Deduplicar por fecha: si hay múltiples valores para la misma fecha, tomar el primero (más reciente)
    const byDate = new Map<string, number>()
    for (const p of valid) {
      if (!byDate.has(p.date)) {
        byDate.set(p.date, p.value)
      }
    }
    
    // Convertir a array y ordenar ascendente por fecha
    const result = Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return result
  } catch (error) {
    console.error('Error fetching DXY:', error)
    return []
  }
}

/**
 * Get Yahoo Finance symbol from database or config
 */
async function getYahooSymbol(symbol: string): Promise<string | string[] | null> {
  const normalized = symbol.toUpperCase()
  
  // First try database (most up-to-date)
  try {
    const { getUnifiedDB, isUsingTurso } = await import('@/lib/db/unified-db')
    const { getDB } = await import('@/lib/db/schema')
    
    let row: any = null
    if (isUsingTurso()) {
      const db = getUnifiedDB()
      row = await db.prepare('SELECT yahoo_symbol FROM asset_metadata WHERE symbol = ?').get(normalized)
    } else {
      const db = getDB()
      row = db.prepare('SELECT yahoo_symbol FROM asset_metadata WHERE symbol = ?').get(normalized) as any
    }
    
    if (row?.yahoo_symbol) {
      return row.yahoo_symbol
    }
  } catch (error) {
    // Fall through to config file
  }
  
  // Fallback to config file
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const configPath = path.join(process.cwd(), 'config', 'assets.config.json')
    const raw = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(raw)
    
    // Search in all categories
    for (const category of ['forex', 'indices', 'metals', 'crypto']) {
      const assets = config[category] || []
      const asset = assets.find((a: any) => a.symbol === normalized)
      if (asset?.yahoo_symbol) {
        return asset.yahoo_symbol
      }
    }
  } catch (error) {
    // Fall through to hardcoded map
  }
  
  // Final fallback to hardcoded map
  return YAHOO_MAP[normalized] || null
}

/**
 * Fetch daily asset price data
 * PRIORITY 1: Read from database (fast, cached)
 * PRIORITY 2: Fallback to Yahoo Finance API (slower, can fail)
 */
export async function fetchAssetDaily(symbol: string): Promise<PricePoint[]> {
  const normalized = symbol.toUpperCase()
  
  // PRIORITY 1: Try to read from database first
  try {
    const { getUnifiedDB, isUsingTurso } = await import('@/lib/db/unified-db')
    const { getDB } = await import('@/lib/db/schema')
    
    let rows: Array<{ date: string; close: number }>
    if (isUsingTurso()) {
      const db = getUnifiedDB()
      rows = await db.prepare(
        'SELECT date, close FROM asset_prices WHERE symbol = ? ORDER BY date ASC'
      ).all(normalized) as Array<{ date: string; close: number }>
    } else {
      const db = getDB()
      rows = db.prepare(
        'SELECT date, close FROM asset_prices WHERE symbol = ? ORDER BY date ASC'
      ).all(normalized) as Array<{ date: string; close: number }>
    }
    
    if (rows.length >= 30) {
      // We have enough data from DB, use it
      return rows.map(r => ({ date: r.date, value: r.close }))
    }
  } catch (dbError) {
    console.warn(`[fetchAssetDaily] Could not read ${symbol} from DB, falling back to Yahoo:`, dbError)
  }
  
  // PRIORITY 2: Fallback to Yahoo Finance API
  const yahooSymbol = await getYahooSymbol(normalized)

  if (!yahooSymbol) {
    // Try to construct Yahoo symbol from symbol pattern
    // Forex: EURUSD -> EURUSD=X
    if (normalized.length === 6 && /^[A-Z]{6}$/.test(normalized)) {
      const trySymbol = `${normalized}=X`
      try {
        const data = await fetchYahooDaily(trySymbol, '5y')
        if (data.length >= 30) return data
      } catch {}
    }
    // Crypto: BTCUSDT -> BTC-USD (try common patterns)
    if (normalized.endsWith('USDT')) {
      const base = normalized.replace('USDT', '')
      const trySymbol = `${base}-USD`
      try {
        const data = await fetchYahooDaily(trySymbol, '5y')
        if (data.length >= 30) return data
      } catch {}
    }
    // Indices: SPX -> ^GSPC (already in map)
    console.warn(`No Yahoo mapping found for ${symbol}, tried auto-construction`)
    return []
  }

  try {
    if (Array.isArray(yahooSymbol)) {
      // Try multiple symbols
      for (const sym of yahooSymbol) {
        try {
          const data = await fetchYahooDaily(sym, '2y')
          if (data.length >= 30) return data
        } catch {}
      }
      return []
    } else {
      return await fetchYahooDaily(yahooSymbol, '5y')
    }
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error)
    return []
  }
}

/**
 * Get list of active symbols from universe
 * Now reads from asset_metadata table in database
 */
export async function getActiveSymbols(): Promise<string[]> {
  try {
    // Try to get from database first (most up-to-date)
    const { getUnifiedDB, isUsingTurso } = await import('@/lib/db/unified-db')
    const { getDB } = await import('@/lib/db/schema')
    
    if (isUsingTurso()) {
      const db = getUnifiedDB()
      const result = await db.prepare('SELECT symbol FROM asset_metadata ORDER BY symbol').all()
      const symbols = (result as Array<{ symbol: string }>).map(r => r.symbol)
      if (symbols.length > 0) {
        return symbols
      }
    } else {
      const db = getDB()
      const rows = db.prepare('SELECT symbol FROM asset_metadata ORDER BY symbol').all() as Array<{ symbol: string }>
      if (rows.length > 0) {
        return rows.map(r => r.symbol)
      }
    }
  } catch (error) {
    console.warn('Could not get symbols from database, falling back to config file:', error)
  }

  // Fallback to config file
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const configPath = path.join(process.cwd(), 'config', 'universe.assets.json')
    const raw = await fs.readFile(configPath, 'utf8')
    const assets = JSON.parse(raw) as Array<{ symbol: string }>
    return assets.map(a => a.symbol)
  } catch {
    // Final fallback to hardcoded list
    return ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'USDCAD', 'XAUUSD', 'SPX', 'NDX', 'BTCUSDT', 'ETHUSDT']
  }
}

