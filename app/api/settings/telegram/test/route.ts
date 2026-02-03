/**
 * POST /api/settings/telegram/test — Enviar mensaje de prueba a Telegram
 * Requiere chatId (env o body). Rate limit: 1 cada 30s por chatId.
 * Mensaje genérico (sin datos inventados).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { buildTelegramTestMessage } from '@/lib/notifications/telegram-builders'

const TEST_RATE_LIMIT_MS = 30_000
const lastSentByChatId: Record<string, number> = {}

function getRateLimitKey(chatId: string): string {
  return `test:${chatId}`
}

export async function POST(request: NextRequest) {
  try {
    let chatId: string | undefined
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json()
        chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : undefined
      } catch {
        // body vacío o inválido
      }
    }
    if (!chatId) {
      chatId = env.TELEGRAM_CHAT_ID || env.TELEGRAM_TEST_CHAT_ID
    }
    if (!chatId) {
      return NextResponse.json(
        { error: 'No Chat ID', details: 'Indica tu Chat ID en el cuerpo { "chatId": "..." } o configura TELEGRAM_CHAT_ID en el servidor.' },
        { status: 400 }
      )
    }

    const key = getRateLimitKey(chatId)
    const now = Date.now()
    const last = lastSentByChatId[key]
    if (last != null && now - last < TEST_RATE_LIMIT_MS) {
      const waitSec = Math.ceil((TEST_RATE_LIMIT_MS - (now - last)) / 1000)
      return NextResponse.json(
        { error: 'Rate limit', details: `Espera ${waitSec}s antes de enviar otra prueba.` },
        { status: 429 }
      )
    }

    const text = buildTelegramTestMessage()
    const result = await sendTelegramMessage(text, {
      overrideChatId: chatId,
      bypassRateLimit: true,
      noParseMode: true,
    })

    if (result.success) {
      lastSentByChatId[key] = now
      return NextResponse.json({ success: true, message: 'Mensaje de prueba enviado' })
    }

    return NextResponse.json(
      { error: result.error || 'Error al enviar', details: result.details || 'Revisa Chat ID y token del bot.' },
      { status: 400 }
    )
  } catch (err) {
    console.error('[api/settings/telegram/test]', err)
    return NextResponse.json(
      { error: 'Error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
