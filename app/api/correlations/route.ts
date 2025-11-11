import { getCorrelations } from '@/domain/corr-dashboard'
import { saveCorrelations } from '@/domain/correlations'

export const revalidate = 10800

export async function GET() {
  const rows = await getCorrelations()
  return Response.json(rows, { headers: { 'Cache-Control': 's-maxage=10800' } })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!Array.isArray(body)) return Response.json({ error: 'Formato inválido' }, { status: 400 })
    await saveCorrelations(body)
    return Response.json({ ok: true, count: body.length })
  } catch (e: any) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}


