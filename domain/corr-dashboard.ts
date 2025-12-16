import { fetchFredSeries } from '@/lib/fred'
import { resampleToMonthly } from '@/lib/markets'
import { yahooSeriesMonthly, yahooSeriesMonthlyAny } from '@/lib/markets/yahoo'
import { pearson } from './correlation'

export type CorrRow = { activo: string; corr12: number | null; corr24: number | null; corr6?: number | null; corr3?: number | null; señal: 'Positiva' | 'Negativa' | 'Mixta'; comentario: string }

/**
 * Get Yahoo Finance symbol from tactical-pairs.json or fallback map
 * Uses the same logic as lib/correlations/fetch.ts for consistency
 */
async function getYahooSymbol(symbol: string): Promise<string | string[] | null> {
  const normalized = symbol.toUpperCase()
  
  // Priority 1: Read from tactical-pairs.json (reduced list)
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
    // Fall through to hardcoded map
  }

  // Fallback to hardcoded map (same as lib/correlations/fetch.ts)
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
  
  return YAHOO_MAP[normalized] || null
}

export function signalOf(r: number | null): 'Positiva' | 'Negativa' | 'Mixta' {
  if (r == null) return 'Mixta'
  if (r >= 0.3) return 'Positiva'
  if (r <= -0.3) return 'Negativa'
  return 'Mixta'
}

async function fetchAssetSeries(name: string): Promise<{ date: string; value: number }[] | null> {
  try {
    // All assets now use Yahoo Finance (including BTCUSD and ETHUSD)
    // This avoids Binance 451 errors in Vercel production
    const yahooSymbol = await getYahooSymbol(name)
    if (!yahooSymbol) {
      console.warn(`[corr-dashboard] No Yahoo symbol mapping for ${name}`)
      return null
    }
    
    if (Array.isArray(yahooSymbol)) {
      const { rows } = await yahooSeriesMonthlyAny(yahooSymbol, '20y')
      return rows.map(p => ({ date: p.date, value: p.close }))
    }
    
    const s = await yahooSeriesMonthly(yahooSymbol, '20y')
    return s.map(p => ({ date: p.date, value: p.close }))
  } catch (e) {
    // Log error but don't throw - return null to mark as INSUFFICIENT_DATA
    console.warn(`[corr-dashboard] Error fetching ${name}:`, e instanceof Error ? e.message : String(e))
    return null
  }
}

function buildMonthlyReturns(map: Map<string, number>): { month: string; ret: number }[] {
  const months = Array.from(map.keys()).sort()
  const out: { month: string; ret: number }[] = []
  for (let i = 1; i < months.length; i++) {
    const prev = map.get(months[i - 1])!
    const curr = map.get(months[i])!
    if (prev != null && curr != null) {
      const r = Math.log(curr / prev)
      if (Number.isFinite(r)) out.push({ month: months[i], ret: r })
    }
  }
  return out
}

export async function getCorrelations(): Promise<CorrRow[]> {
  const usd = await fetchFredSeries('DTWEXBGS', { frequency: 'm' }).catch(() => [])
  const usdMonthly = resampleToMonthly(usd)

  const rows: CorrRow[] = []
  // Use internal symbols from tactical-pairs.json - will be converted to Yahoo symbols in fetchAssetSeries
  const activos = ['EURUSD','GBPUSD','AUDUSD','USDJPY','USDCAD','XAUUSD','SPX','NDX','SX5E','NIKKEI','WTI','COPPER','BTCUSD','ETHUSD'] as const
  for (const name of activos) {
    const series = await fetchAssetSeries(name)
    if (!series || series.length === 0) {
      rows.push({ activo: name, corr12: null, corr24: null, corr6: null, corr3: null, señal: 'Mixta', comentario: 'Datos no disponibles' })
      continue
    }

    const a = resampleToMonthly(series)
    const refMap = new Map(resampleToMonthly(usdMonthly).map(p => [p.date.slice(0, 7), p.value] as [string, number]))
    const aMap = new Map(a.map(p => [p.date.slice(0, 7), p.value] as [string, number]))
    const months = Array.from(refMap.keys()).filter(m => aMap.has(m)).sort()
    const refVals = months.map(m => refMap.get(m)!)
    const aVals = months.map(m => aMap.get(m)!)
    const refRet = buildMonthlyReturns(new Map(months.map((m, i) => [m, refVals[i]] as [string, number])))
    const aRet = buildMonthlyReturns(new Map(months.map((m, i) => [m, aVals[i]] as [string, number])))
    const idx = new Set(refRet.map(r => r.month))
    const common = aRet.filter(r => idx.has(r.month)).map(r => r.month)
    const x = common.map(m => refRet.find(r => r.month === m)!.ret)
    const y = common.map(m => aRet.find(r => r.month === m)!.ret)
    const corr12 = x.length >= 12 ? pearson(x.slice(-12), y.slice(-12)) : null
    const corr6 = x.length >= 6 ? pearson(x.slice(-6), y.slice(-6)) : null
    const corr3 = x.length >= 3 ? pearson(x.slice(-3), y.slice(-3)) : null
    const corr24 = x.length >= 24 ? pearson(x.slice(-24), y.slice(-24)) : null
    const señal = signalOf(corr12 ?? corr24)
    const c12 = corr12 != null ? corr12.toFixed(2) : 'n/a'
    const comentario = `12m ${c12} vs DXY${corr12 != null && corr12 < 0 ? ' (relación inversa)' : ''}`
    rows.push({ activo: name, corr12, corr24, corr6, corr3, señal, comentario })
  }
  return rows
}


