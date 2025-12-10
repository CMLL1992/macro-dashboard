/**
 * POST /api/jobs/digest
 * Manually trigger daily digest
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendDailyDigest } from '@/lib/notifications/digest'
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

  // Skip during Vercel build (SSR/SSG)
  if (process.env.VERCEL === "1") {
    return NextResponse.json({ skip: "build" });
  }

  try {
    const result = await sendDailyDigest()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Daily digest sent',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: result.error === 'Already sent today' ? 200 : 500 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}




