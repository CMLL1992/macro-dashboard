/**
 * Insert news item and trigger notification
 * POST /api/news/insert
 */

import { NextRequest, NextResponse } from 'next/server'
import { insertNewsItem, type NewsItem } from '@/lib/notifications/news'
import { processNewsForNarrative } from '@/lib/notifications/narrative'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'

export async function POST(request: NextRequest) {
  // Validate ingest key (production) or cron token (admin/manual in dev)
  const ingestValid = validateIngestKeyWithError(request)
  
  // In production, INGEST_KEY is required
  if (process.env.NODE_ENV === 'production' && !ingestValid.valid) {
    return NextResponse.json(
      { error: ingestValid.error || 'INGEST_KEY is required in production' },
      { status: 400 }
    )
  }
  
  // In development, allow CRON_TOKEN as fallback
  const cronValid = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TELEGRAM_TESTS === 'true'
    ? validateCronToken(request)
    : false
  
  if (!ingestValid.valid && !cronValid) {
    return NextResponse.json(
      { error: ingestValid.error || 'Unauthorized. Provide X-INGEST-KEY header' + (process.env.NODE_ENV !== 'production' ? ' or CRON_TOKEN (dev only)' : '') },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.id_fuente || !body.fuente || !body.titulo || !body.impacto || !body.published_at) {
      return NextResponse.json(
        { error: 'Missing required fields: id_fuente, fuente, titulo, impacto, published_at' },
        { status: 400 }
      )
    }

    // Validate impacto
    if (!['low', 'med', 'high'].includes(body.impacto)) {
      return NextResponse.json(
        { error: 'impacto must be one of: low, med, high' },
        { status: 400 }
      )
    }

    const newsItem: NewsItem = {
      id_fuente: body.id_fuente,
      fuente: body.fuente,
      pais: body.pais,
      tema: body.tema,
      titulo: body.titulo,
      impacto: body.impacto,
      published_at: body.published_at, // Should be UTC ISO string
      resumen: body.resumen,
      valor_publicado: body.valor_publicado,
      valor_esperado: body.valor_esperado,
    }

    // Insert and notify
    const result = await insertNewsItem(newsItem)

    // Process for narrative changes (async, don't wait)
    if (result.inserted) {
      processNewsForNarrative({
        titulo: newsItem.titulo,
        tema: newsItem.tema,
        valor_publicado: newsItem.valor_publicado,
        valor_esperado: newsItem.valor_esperado,
        published_at: newsItem.published_at,
      }).catch(err => {
        console.error('[news/insert] Error processing narrative:', err)
      })
    }

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      notified: result.notified,
      error: result.error,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[news/insert] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

