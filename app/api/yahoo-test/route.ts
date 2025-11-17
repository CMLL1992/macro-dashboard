import { yahooSeriesMonthly, yahooSeriesMonthlyAny } from '@/lib/markets/yahoo'

export async function GET() {
  const syms = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDCAD=X', 'XAUUSD=X', '^GSPC', '^NDX']
  const out: any = {}
  for (const s of syms) {
    try {
      const rows = await yahooSeriesMonthly(s, '10y')
      out[s] = { ok: rows.length > 24, last: rows.at(-1) }
    } catch (e: any) {
      out[s] = { ok: false, error: String(e?.message || e) }
    }
  }
  const goldSyms = ['XAUUSD=X', 'GC=F']
  const g = await yahooSeriesMonthlyAny(goldSyms, '20y')
  out['XAUUSD'] = { ok: g.rows.length > 24, used: g.symbol, last: g.rows.at(-1) }
  return Response.json(out)
}


