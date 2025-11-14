/**
 * GET /api/notifications/settings - Get all settings
 * POST /api/notifications/settings - Update a setting
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllNotificationSettings, getDefaultSettings, setNotificationSetting } from '@/lib/notifications/settings'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'

export async function GET() {
  try {
    const settings = getAllNotificationSettings()
    const defaults = getDefaultSettings()

    return NextResponse.json({
      settings,
      defaults,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

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
    const body = await request.json()
    const { key, value, min_value, max_value, description } = body

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'key and value are required' },
        { status: 400 }
      )
    }

    setNotificationSetting(key, String(value), min_value, max_value, description)

    return NextResponse.json({
      success: true,
      key,
      value,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    )
  }
}




