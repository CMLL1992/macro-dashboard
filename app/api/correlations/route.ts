import { getCorrelations } from '@/domain/corr-dashboard'
import { saveCorrelations } from '@/domain/correlations'
import { getAllCorrelationsFromDB } from '@/lib/db/read'
import { signalOf } from '@/domain/corr-dashboard'

export const revalidate = 10800

export async function GET() {
  try {
    // PRIORITY 1: Leer de la base de datos (rápido, confiable)
    try {
      const dbRows = await getAllCorrelationsFromDB('DXY')
      
      // Si hay datos en BD con valores no-null, usarlos
      const hasData = dbRows.some(row => row.corr12 !== null || row.corr3 !== null)
      
      if (hasData && dbRows.length > 0) {
        // Convertir formato de BD a formato esperado por el frontend
        const formatted = dbRows.map(row => {
          const corr12 = row.corr12
          const corr3 = row.corr3
          const señal = signalOf(corr12 ?? row.corr24)
          const c12 = corr12 != null ? corr12.toFixed(2) : 'n/a'
          const comentario = `12m ${c12} vs DXY${corr12 != null && corr12 < 0 ? ' (relación inversa)' : ''}`
          
          return {
            activo: row.activo,
            corr12: corr12,
            corr24: row.corr24,
            corr6: row.corr6,
            corr3: corr3,
            señal: señal,
            comentario: comentario || (corr12 == null ? '12m n/a vs DXY' : comentario)
          }
        })
        
        console.log(`[api/correlations] Returning ${formatted.length} correlations from database`)
        return Response.json(formatted, { headers: { 'Cache-Control': 's-maxage=10800' } })
      }
    } catch (dbError) {
      console.warn('[api/correlations] Error reading from DB, falling back to real-time calculation:', dbError)
    }
    
    // PRIORITY 2: Fallback a cálculo en tiempo real (más lento, puede fallar)
    console.log('[api/correlations] No DB data found, calculating in real-time...')
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


