export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getCorrMap } from '@/domain/corr-bridge'
import { variants, norm } from '@/lib/symbols'

const PAIRS = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/JPY', 'USD/CAD', 'XAU/USD', 'BTCUSDT', 'ETHUSDT', 'SPX', 'NDX']

export async function GET() {
  const map = await getCorrMap()
  const out = PAIRS.map(p => {
    const vars = variants(p)
    const found = vars.find(v => map.has(v)) || (map.has(norm(p)) ? norm(p) : null)
    const val = found ? map.get(found)! : null
    return { pair: p, tried: vars, used: found ?? null, value: val }
  })
  return Response.json(out)
}

