export type OHLC = { date: string; open: number; high: number; low: number; close: number; volume?: number }

// Reemplazo según especificación del usuario: devuelve { date, close }
export async function stooqSeries(symbol: string, interval: 'd' | 'w' | 'm' = 'm') {
  const sym = symbol.toLowerCase().replace(/[^a-z0-9^]/g, '')
  const urls = [
    `https://stooq.pl/q/d/l/?s=${sym}&i=${interval}`,
    `https://stooq.com/q/d/l/?s=${sym}&i=${interval}`,
  ]

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'text/csv,application/xhtml+xml',
        },
        cache: 'no-store',
      })
      if (!r.ok) continue

      const text = await r.text()
      if (!text.includes('Date')) continue

      const lines = text.trim().split('\n').slice(1)
      const data = lines
        .map(l => {
          const [date, open, high, low, close] = l.split(',')
          return { date, close: parseFloat(close) }
        })
        .filter(d => !isNaN(d.close))

      if (data.length > 5) return data
    } catch (err) {
      continue
    }
  }

  console.warn('STOOQ vacío o inaccesible para', symbol)
  return []
}

export const STOOQ = {
  EURUSD: 'eurusd',
  GBPUSD: 'gbpusd',
  AUDUSD: 'audusd',
  USDJPY: 'usdjpy',
  USDCAD: 'usdcad',
  XAUUSD: 'xauusd',
  SPX: '^spx',
  NDX: '^ndx',
} as const


