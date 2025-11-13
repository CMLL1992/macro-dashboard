import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/schema'

export const runtime = 'nodejs'

// Store user notification preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId, preferences } = body

    if (!chatId || !/^-?\d+$/.test(String(chatId).trim())) {
      return NextResponse.json(
        { error: 'Chat ID inválido' },
        { status: 400 }
      )
    }

    const db = getDB()

    // Store user preferences
    db.prepare(`
      INSERT INTO user_notification_preferences (chat_id, preferences_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(chat_id) DO UPDATE SET
        preferences_json = excluded.preferences_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(chatId, JSON.stringify(preferences || []))

    return NextResponse.json({
      success: true,
      message: 'Preferencias guardadas correctamente',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[user-config] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID requerido' },
        { status: 400 }
      )
    }

    const db = getDB()
    const row = db.prepare(`
      SELECT preferences_json, updated_at
      FROM user_notification_preferences
      WHERE chat_id = ?
    `).get(chatId) as { preferences_json: string; updated_at: string } | undefined

    if (!row) {
      return NextResponse.json({
        preferences: [],
        updatedAt: null,
      })
    }

    return NextResponse.json({
      preferences: JSON.parse(row.preferences_json || '[]'),
      updatedAt: row.updated_at,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

