export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getMacroDiagnosis } from '@/domain/diagnostic'

export async function GET() {
  const data = await getMacroDiagnosis()
  return Response.json(data, { headers: { 'Cache-Control': 's-maxage=10800' } })
}


