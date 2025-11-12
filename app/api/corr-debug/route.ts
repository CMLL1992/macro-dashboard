export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getCorrMap } from '@/domain/corr-bridge'

export async function GET() {
  const m = await getCorrMap()
  const out: any[] = []
  for (const [k, v] of m.entries()) out.push({ key: k, ...v })
  return Response.json(out)
}


