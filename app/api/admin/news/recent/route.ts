/**
 * Get recent news items
 * GET /api/admin/news/recent?limit=5
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getRecentNewsItems } from '@/lib/notifications/news'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const news = getRecentNewsItems(limit)

    return NextResponse.json({
      success: true,
      news: news.map(n => ({
        id: n.id,
        titulo: n.titulo,
        fuente: n.fuente,
        pais: n.pais,
        tema: n.tema,
        impacto: n.impacto,
        published_at: n.published_at,
        notificado_at: n.notificado_at,
        valor_publicado: n.valor_publicado,
        valor_esperado: n.valor_esperado,
      })),
      count: news.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[admin/news/recent] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

