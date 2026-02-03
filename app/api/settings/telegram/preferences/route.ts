/**
 * API endpoint para gestionar preferencias de notificaciones Telegram
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { env } from '@/lib/env'

type TelegramPreferences = {
  dailySummary: boolean
  dailySummaryTime: string
  weeklySummary: boolean
  weeklySummaryDay: string
  weeklySummaryTime: string
  autoAlerts: boolean
}

// Obtener preferencias
export async function GET() {
  try {
    const db = getUnifiedDB()
    const usingTurso = isUsingTurso()
    const chatId = env.TELEGRAM_CHAT_ID || env.TELEGRAM_TEST_CHAT_ID

    if (!chatId) {
      return NextResponse.json({ preferences: null, error: 'No chat ID configured' }, { status: 400 })
    }

    let row: { preferences_json: string } | undefined
    if (usingTurso) {
      row = (await db.prepare('SELECT preferences_json FROM user_notification_preferences WHERE chat_id = ?').get(chatId)) as
        | { preferences_json: string }
        | undefined
    } else {
      row = db.prepare('SELECT preferences_json FROM user_notification_preferences WHERE chat_id = ?').get(chatId) as
        | { preferences_json: string }
        | undefined
    }

    if (row) {
      const preferences = JSON.parse(row.preferences_json) as TelegramPreferences
      return NextResponse.json({ preferences })
    }

    // Retornar preferencias por defecto si no existen (Opción A: diario 08:00, semanal domingo 09:00 Madrid)
    const defaultPreferences: TelegramPreferences = {
      dailySummary: true,
      dailySummaryTime: '08:00',
      weeklySummary: true,
      weeklySummaryDay: 'sunday',
      weeklySummaryTime: '09:00',
      autoAlerts: true,
    }

    return NextResponse.json({ preferences: defaultPreferences })
  } catch (error) {
    console.error('[api/settings/telegram/preferences] GET error:', error)
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
  }
}

// Guardar preferencias
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { preferences } = body as { preferences: TelegramPreferences }

    if (!preferences) {
      return NextResponse.json({ error: 'Preferences are required' }, { status: 400 })
    }

    const db = getUnifiedDB()
    const usingTurso = isUsingTurso()
    const chatId = env.TELEGRAM_CHAT_ID || env.TELEGRAM_TEST_CHAT_ID

    if (!chatId) {
      return NextResponse.json({ error: 'No chat ID configured' }, { status: 400 })
    }

    const preferencesJson = JSON.stringify(preferences)

    if (usingTurso) {
      await db
        .prepare(
          `
        INSERT INTO user_notification_preferences (chat_id, preferences_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(chat_id) DO UPDATE SET
          preferences_json = excluded.preferences_json,
          updated_at = CURRENT_TIMESTAMP
      `
        )
        .run(chatId, preferencesJson)
    } else {
      db.prepare(
        `
        INSERT INTO user_notification_preferences (chat_id, preferences_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(chat_id) DO UPDATE SET
          preferences_json = excluded.preferences_json,
          updated_at = CURRENT_TIMESTAMP
      `
      ).run(chatId, preferencesJson)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/settings/telegram/preferences] POST error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
