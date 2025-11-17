export type YahooPoint = { date: string; close: number }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'

// Devuelve cierres mensuales (date normalizado a YYYY-MM-01)
export async function yahooSeriesMonthly(symbol: string, range: string = '20y'): Promise<YahooPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=${encodeURIComponent(range)}&includePrePost=false`
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`)
  const j = await r.json()
  const res = j?.chart?.result?.[0]
  if (!res?.timestamp || !res?.indicators?.quote?.[0]?.close) return []
  const ts: number[] = res.timestamp
  const cl: (number | null)[] = res.indicators.quote[0].close
  const out: YahooPoint[] = []
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    const c = cl[i]
    if (c == null || Number.isNaN(c)) continue
    const d = new Date(t * 1000)
    const y = d.getUTCFullYear()
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
    out.push({ date: `${y}-${m}-01`, close: +c })
  }
  const map = new Map<string, number>()
  for (const p of out) map.set(p.date, p.close)
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close }))
}

export async function yahooSeriesMonthlyAny(symbols: string[], range = '20y') {
  for (const s of symbols) {
    try {
      const rows = await yahooSeriesMonthly(s, range)
      if (rows.length >= 24) return { symbol: s, rows }
    } catch {}
  }
  return { symbol: symbols[0], rows: [] as YahooPoint[] }
}


