/**
 * GET /api/notifications/metrics
 * Returns notification metrics (counters)
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAllMetrics, getAggregatedMetrics } from '@/lib/notifications/metrics'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

export async function GET() {
  try {
    const metrics = await getAllMetrics()
    const aggregated = await getAggregatedMetrics()

    // Get last sent timestamps
    const db = getUnifiedDB()
    const usingTurso = isUsingTurso()
    let lastNewsSentAt: string | null = null
    let lastNarrativeChangeAt: string | null = null
    let weeklyLastSentAt: string | null = null
    let dailyLastSentAt: string | null = null

    try {
      // Last news notification
      let lastNews: { sent_at: string } | undefined
      if (usingTurso) {
        lastNews = await db.prepare(`
          SELECT sent_at FROM notification_history
          WHERE tipo = 'news' AND status = 'sent'
          ORDER BY sent_at DESC LIMIT 1
        `).get() as { sent_at: string } | undefined
      } else {
        lastNews = await db.prepare(`
          SELECT sent_at FROM notification_history
          WHERE tipo = 'news' AND status = 'sent'
          ORDER BY sent_at DESC LIMIT 1
        `).get() as { sent_at: string } | undefined
      }
      lastNewsSentAt = lastNews?.sent_at || null

      // Last narrative change
      let lastNarrative: { cambiado_en: string } | undefined
      if (usingTurso) {
        lastNarrative = await db.prepare(`
          SELECT cambiado_en FROM narrative_state
          WHERE narrativa_anterior IS NOT NULL
          ORDER BY cambiado_en DESC LIMIT 1
        `).get() as { cambiado_en: string } | undefined
      } else {
        lastNarrative = await db.prepare(`
          SELECT cambiado_en FROM narrative_state
          WHERE narrativa_anterior IS NOT NULL
          ORDER BY cambiado_en DESC LIMIT 1
        `).get() as { cambiado_en: string } | undefined
      }
      lastNarrativeChangeAt = lastNarrative?.cambiado_en || null

      // Weekly last sent
      let weeklySent: { sent_at: string } | undefined
      if (usingTurso) {
        weeklySent = await db.prepare(`
          SELECT sent_at FROM weekly_sent
          ORDER BY sent_at DESC LIMIT 1
        `).get() as { sent_at: string } | undefined
      } else {
        weeklySent = await db.prepare(`
          SELECT sent_at FROM weekly_sent
          ORDER BY sent_at DESC LIMIT 1
        `).get() as { sent_at: string } | undefined
      }
      weeklyLastSentAt = weeklySent?.sent_at || null

      // Daily digest last sent
      let dailySent: { sent_at: string } | undefined
      if (usingTurso) {
        dailySent = await db.prepare(`
          SELECT sent_at FROM daily_digest_sent
          ORDER BY sent_at DESC LIMIT 1
        `).get() as { sent_at: string } | undefined
      } else {
        dailySent = await db.prepare(`
          SELECT sent_at FROM daily_digest_sent
          ORDER BY sent_at DESC LIMIT 1
        `).get() as { sent_at: string } | undefined
      }
      dailyLastSentAt = dailySent?.sent_at || null
    } catch (err) {
      console.warn('[notifications/metrics] Error getting last sent timestamps:', err)
    }

    return NextResponse.json({
      metrics,
      aggregated: {
        ...aggregated,
        last_news_sent_at: lastNewsSentAt,
        last_narrative_change_at: lastNarrativeChangeAt,
        weekly_last_sent_at: weeklyLastSentAt,
        daily_last_sent_at: dailyLastSentAt,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

