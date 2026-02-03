/**
 * API endpoint para preview de mensajes Telegram
 * Usa los builders compartidos con data real del macro stack
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { buildTelegramDailySummary, buildTelegramWeeklySummary, buildTelegramAlert } from '@/lib/notifications/telegram-builders'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'daily'
    const chatId = env.TELEGRAM_CHAT_ID || env.TELEGRAM_TEST_CHAT_ID || 'preview'

    let message: string

    switch (type) {
      case 'daily':
        message = await buildTelegramDailySummary(chatId)
        break
      case 'weekly':
        message = await buildTelegramWeeklySummary(chatId)
        break
      case 'alert':
        // Mock alert payload para preview
        message = await buildTelegramAlert(
          {
            type: 'regime_change',
            data: {
              from: 'Risk OFF',
              to: 'Risk ON',
              reason: 'Cambio en drivers de crecimiento e inflación',
              impact: 'Mayor apetito por riesgo y activos cíclicos',
            },
          },
          chatId
        )
        break
      default:
        return NextResponse.json({ error: 'Invalid type. Use daily, weekly, or alert' }, { status: 400 })
    }

    return NextResponse.json({ message, type })
  } catch (error) {
    console.error('[api/settings/telegram/preview] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
