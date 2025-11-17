/**
 * Get queue status
 * GET /api/notifications/queue/status
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getQueueStatus } from '@/lib/notifications/queue'

export async function GET() {
  try {
    const status = getQueueStatus()
    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[notifications/queue/status] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

