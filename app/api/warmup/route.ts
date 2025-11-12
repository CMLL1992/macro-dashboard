export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getCorrelations } from '@/domain/corr-dashboard'

export async function GET() {
  try {
    await getMacroDiagnosis()
  } catch (e) {
    console.error('warmup macro diagnosis error', e)
  }
  try {
    await getCorrelations()
  } catch (e) {
    console.error('warmup correlations error', e)
  }
  return Response.json({ ok: true, ts: new Date().toISOString() })
}


