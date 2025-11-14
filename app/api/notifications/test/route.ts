/**
 * POST /api/notifications/test
 * Send a test notification message
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'

export async function POST(request: NextRequest) {
  // Auth: require INGEST_KEY or CRON_TOKEN
  const ingestValid = validateIngestKeyWithError(request)
  const cronValid = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TELEGRAM_TESTS === 'true'
    ? validateCronToken(request)
    : false

  if (!ingestValid.valid && !cronValid) {
    return NextResponse.json(
      { error: ingestValid.error || 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const testMessage = '🧪 Test notification\n\nThis is a test message from the admin panel.\n\nTimestamp: ' + new Date().toISOString()

    const result = await sendTelegramMessage(testMessage, { noParseMode: true })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent',
        messageId: result.messageId,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}




