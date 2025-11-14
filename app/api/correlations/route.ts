import { getCorrelations } from '@/domain/corr-dashboard'
import { saveCorrelations } from '@/domain/correlations'

export const revalidate = 10800

export async function GET() {
  try {
    // Timeout de 15 segundos para evitar que se quede colgado
    const rows = await Promise.race([
      getCorrelations(),
      new Promise<any[]>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: getCorrelations took too long')), 15000)
      )
    ])
    return Response.json(rows, { headers: { 'Cache-Control': 's-maxage=10800' } })
  } catch (error) {
    console.error('[api/correlations] Error:', error)
    // Retornar array vacío en lugar de error 500
    return Response.json([], { 
      status: 200,
      headers: { 'Cache-Control': 's-maxage=300' } 
    })
  }
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


