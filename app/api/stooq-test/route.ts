import { stooqSeries } from '@/lib/markets/stooq'

export async function GET() {
  const symbols = ['eurusd', 'gbpusd', 'xauusd', 'spx', 'ndx']
  const out: any = {}
  for (const s of symbols) {
    try {
      const data = await stooqSeries(s, 'm')
      out[s] = { ok: data.length > 0, last: data.at(-1) }
    } catch (e: any) {
      out[s] = { ok: false, error: String(e) }
    }
  }
  return Response.json(out)
}


