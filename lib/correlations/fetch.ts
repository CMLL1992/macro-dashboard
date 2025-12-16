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
  // Use only cache: 'no-store' (not both cache and next.revalidate)
  const r = await fetch(url, { 
    headers: { 'User-Agent': UA, Accept: 'application/json' }, 
    cache: 'no-store'
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
 * Updated to prioritize Yahoo Finance for all correlations
 */
const YAHOO_MAP: Record<string, string | string[]> = {
  // FX Majors (G10)
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  AUDUSD: 'AUDUSD=X',
  USDJPY: 'USDJPY=X',
  USDCAD: 'USDCAD=X',
  USDCHF: 'USDCHF=X',
  NZDUSD: 'NZDUSD=X',
  // FX EM
  USDCNH: 'CNH=X',
  USDBRL: 'BRL=X',
  USDMXN: 'MXN=X',
  // Commodities
  XAUUSD: ['XAUUSD=X', 'GC=F'], // Gold
  WTI: 'CL=F', // Crude Oil WTI
  COPPER: 'HG=F', // Copper
  // Indices
  SPX: '^GSPC',
  NDX: '^NDX',
  SX5E: '^STOXX50E', // Euro Stoxx 50
  NIKKEI: '^N225', // Nikkei 225
  // Crypto
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
}

/**
 * Fetch daily DTWEXBGS data from FRED (Trade Weighted U.S. Dollar Index: Broad)
 * Note: This is NOT the classic DXY (ICE), but serves as a proxy for USD strength
 */
export async function fetchDXYDaily(): Promise<PricePoint[]> {
  try {
    // Obtener datos diarios de DTWEXBGS (5 años de histórico para correlaciones)
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
      throw new Error(`FRED API error for DTWEXBGS: ${res.status}`)
    }
    
    const json = await res.json()
    if (!json || !Array.isArray(json.observations)) {
      throw new Error('Invalid FRED response for DTWEXBGS')
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
    console.error('Error fetching DTWEXBGS:', error)
    return []
  }
}

/**
 * Get Yahoo Finance symbol from database or config
 */
export async function getYahooSymbol(symbol: string): Promise<string | string[] | null> {
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
  
  // Fallback to tactical-pairs.json (reduced list)
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const tacticalPath = path.join(process.cwd(), 'config', 'tactical-pairs.json')
    const tacticalRaw = await fs.readFile(tacticalPath, 'utf8')
    const tacticalPairs = JSON.parse(tacticalRaw) as Array<{ symbol: string; yahoo_symbol?: string }>
    const pair = tacticalPairs.find(p => p.symbol.toUpperCase() === normalized)
    if (pair?.yahoo_symbol) {
      return pair.yahoo_symbol
    }
  } catch (error) {
    // Fall through to assets.config.json
  }

  // Fallback to assets.config.json
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const configPath = path.join(process.cwd(), 'config', 'assets.config.json')
    const raw = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(raw)
    
    // Search in all categories
    for (const category of ['forex', 'indices', 'metals', 'commodities', 'crypto']) {
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
      const points = rows.map(r => ({ date: r.date, value: r.close }))
      console.log(`[fetchAssetDaily] ${symbol}`, {
        source: 'db',
        points: points.length,
      })
      return points
    } else {
      // DB has data but <30 rows, log and fall through to Yahoo
      console.log(`[fetchAssetDaily] ${symbol}`, {
        source: 'db',
        points: rows.length,
        note: 'falling back to Yahoo (DB has <30 rows)',
      })
    }
  } catch (dbError) {
    console.warn(`[fetchAssetDaily] Could not read ${symbol} from DB, falling back to Yahoo:`, dbError)
  }
  
  // PRIORITY 2: Fallback to Yahoo Finance API
  const yahooSymbol = await getYahooSymbol(normalized)

  if (!yahooSymbol) {
    console.warn(`[fetchAssetDaily] No Yahoo symbol mapping found for ${symbol}`, {
      symbol: normalized,
      tried_db: true,
      tried_tactical_pairs: true,
      tried_assets_config: true,
      tried_hardcoded_map: true,
    })
    
    // Try to construct Yahoo symbol from symbol pattern (last resort)
    // Forex: EURUSD -> EURUSD=X
    if (normalized.length === 6 && /^[A-Z]{6}$/.test(normalized)) {
      const trySymbol = `${normalized}=X`
      try {
        const data = await fetchYahooDaily(trySymbol, '5y')
        if (data.length >= 30) {
          console.log(`[fetchAssetDaily] Auto-constructed Yahoo symbol worked for ${symbol}`, {
            symbol: normalized,
            yahoo_symbol: trySymbol,
            points: data.length,
          })
          return data
        }
      } catch (err) {
        console.warn(`[fetchAssetDaily] Auto-construction failed for ${symbol}`, {
          symbol: normalized,
          tried_yahoo: trySymbol,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    // Crypto: BTCUSDT -> BTC-USD (try common patterns)
    if (normalized.endsWith('USDT')) {
      const base = normalized.replace('USDT', '')
      const trySymbol = `${base}-USD`
      try {
        const data = await fetchYahooDaily(trySymbol, '5y')
        if (data.length >= 30) {
          console.log(`[fetchAssetDaily] Auto-constructed Yahoo symbol worked for ${symbol}`, {
            symbol: normalized,
            yahoo_symbol: trySymbol,
            points: data.length,
          })
          return data
        }
      } catch (err) {
        console.warn(`[fetchAssetDaily] Auto-construction failed for ${symbol}`, {
          symbol: normalized,
          tried_yahoo: trySymbol,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return []
  }

  try {
    if (Array.isArray(yahooSymbol)) {
      // Try multiple symbols
      const errors: string[] = []
      for (const sym of yahooSymbol) {
        try {
          const data = await fetchYahooDaily(sym, '2y')
          if (data.length >= 30) {
            console.log(`[fetchAssetDaily] ${symbol}`, {
              source: 'yahoo',
              points: data.length,
              yahoo_symbol: sym,
            })
            return data
          }
        } catch (err) {
          errors.push(`${sym}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      console.warn(`[fetchAssetDaily] All Yahoo symbols failed for ${symbol}`, {
        symbol,
        yahoo_symbols: yahooSymbol,
        errors,
      })
      return []
    } else {
      const data = await fetchYahooDaily(yahooSymbol, '5y')
      console.log(`[fetchAssetDaily] ${symbol}`, {
        source: 'yahoo',
        points: data.length,
        yahoo_symbol: yahooSymbol,
      })
      return data
    }
  } catch (error) {
    console.error(`[fetchAssetDaily] Error fetching ${symbol} (yahoo: ${yahooSymbol})`, {
      symbol,
      yahoo_symbol: yahooSymbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return []
  }
}

/**
 * Get list of active symbols from tactical pairs config
 * Reduced list to optimize system performance
 */
export async function getActiveSymbols(): Promise<string[]> {
  // Priority 1: Read from tactical-pairs.json (reduced list)
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const configPath = path.join(process.cwd(), 'config', 'tactical-pairs.json')
    const raw = await fs.readFile(configPath, 'utf8')
    const tacticalPairs = JSON.parse(raw) as Array<{ symbol: string; type?: string; yahoo_symbol?: string }>
    if (tacticalPairs.length > 0) {
      return tacticalPairs.map(p => p.symbol.toUpperCase())
    }
  } catch (error) {
    console.warn('Could not read tactical-pairs.json, falling back to hardcoded list:', error)
  }

  // Fallback to hardcoded reduced list
  return [
    'BTCUSD', 'ETHUSD',
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
    'USDCNH', 'USDBRL', 'USDMXN',
    'SPX', 'NDX', 'SX5E', 'NIKKEI',
    'XAUUSD', 'WTI', 'COPPER'
  ]
}

