/**
 * Manual trigger for weekly narrative summary
 * POST /api/jobs/weekly-narrative
 * 
 * Can be called manually or by scheduler
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyNarrativeSummary } from '@/lib/notifications/narrative-weekly'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'

export async function POST(request: NextRequest) {
  // Allow Vercel cron jobs (they send x-vercel-cron header)
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  
  // Validate ingest key (production) or cron token (admin/manual in dev)
  const ingestValid = validateIngestKeyWithError(request)
  
  // In production, INGEST_KEY is required (unless it's a Vercel cron)
  if (process.env.NODE_ENV === 'production' && !ingestValid.valid && !isVercelCron) {
    return NextResponse.json(
      { error: ingestValid.error || 'INGEST_KEY is required in production' },
      { status: 400 }
    )
  }
  
  // In development, allow CRON_TOKEN as fallback
  const cronValid = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TELEGRAM_TESTS === 'true'
    ? validateCronToken(request)
    : false
  
  // Allow if: valid ingest key, valid cron token (dev), or Vercel cron
  if (!ingestValid.valid && !cronValid && !isVercelCron) {
    return NextResponse.json(
      { error: ingestValid.error || 'Unauthorized. Provide X-INGEST-KEY header' + (process.env.NODE_ENV !== 'production' ? ' or CRON_TOKEN (dev only)' : '') + ' or call from Vercel cron' },
      { status: 401 }
    )
  }

  try {
    const result = await sendWeeklyNarrativeSummary()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        changeCount: result.changeCount,
        message: 'Weekly narrative summary sent',
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[jobs/weekly-narrative] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

