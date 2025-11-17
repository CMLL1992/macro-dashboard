/**
 * Fetch daily price data for assets and DXY
 */

import { fetchFredSeries } from '@/lib/fred'
import type { PricePoint } from './calc'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'

/**
 * Yahoo Finance daily data
 */
async function fetchYahooDaily(symbol: string, period: string = '2y'): Promise<PricePoint[]> {
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
    // Obtener datos diarios de DXY hasta hoy, sin caché
    const series = await fetchFredSeries('DTWEXBGS', {
      frequency: 'd',
      observation_start: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      observation_end: new Date().toISOString().slice(0, 10), // Hasta hoy
    })
    // Ordenar por fecha descendente y filtrar solo datos válidos
    const sorted = series
      .map(p => ({ date: p.date, value: p.value }))
      .filter(p => p.value != null && Number.isFinite(p.value))
      .sort((a, b) => b.date.localeCompare(a.date)) // Más reciente primero
    return sorted.reverse() // Volver a ordenar ascendente para cálculos
  } catch (error) {
    console.error('Error fetching DXY:', error)
    return []
  }
}

/**
 * Fetch daily asset price data
 */
export async function fetchAssetDaily(symbol: string): Promise<PricePoint[]> {
  const normalized = symbol.toUpperCase()
  const yahooSymbol = YAHOO_MAP[normalized]

  if (!yahooSymbol) {
    console.warn(`No Yahoo mapping for ${symbol}`)
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
      return await fetchYahooDaily(yahooSymbol, '2y')
    }
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error)
    return []
  }
}

/**
 * Get list of active symbols from universe
 */
export async function getActiveSymbols(): Promise<string[]> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const configPath = path.join(process.cwd(), 'config', 'universe.assets.json')
    const raw = await fs.readFile(configPath, 'utf8')
    const assets = JSON.parse(raw) as Array<{ symbol: string }>
    return assets.map(a => a.symbol)
  } catch {
    // Fallback to hardcoded list
    // IMPORTANTE: Usar BTCUSDT y ETHUSDT (con T) para consistencia con domain/bias.ts que usa 'BTC/USDT' y 'ETH/USDT'
    // La función norm() convierte 'BTC/USDT' a 'BTCUSDT', así que deben coincidir
    return ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'USDCAD', 'XAUUSD', 'SPX', 'NDX', 'BTCUSDT', 'ETHUSDT']
  }
}

